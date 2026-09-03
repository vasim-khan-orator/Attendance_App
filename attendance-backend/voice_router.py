import asyncio
import threading
import queue
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import riva.client

voice_router = APIRouter()

RIVA_SERVER = os.getenv("RIVA_SERVER", "172.16.155.14:50051")
LANGUAGE = os.getenv("RIVA_LANGUAGE", "en-US")
SAMPLE_RATE = 16000

@voice_router.websocket("/ws/voice")
async def websocket_voice_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[Voice] WebSocket connected.")
    
    audio_queue = queue.Queue()
    result_queue = asyncio.Queue()
    running = True

    def audio_generator():
        while running:
            try:
                # blocking get with timeout to allow checking running flag
                chunk = audio_queue.get(timeout=0.1)
                yield chunk
            except queue.Empty:
                continue

    def run_riva():
        try:
            print(f"[Riva] Connecting to {RIVA_SERVER}...")
            auth = riva.client.Auth(uri=RIVA_SERVER)
            asr = riva.client.ASRService(auth)
            
            config = riva.client.StreamingRecognitionConfig(
                config=riva.client.RecognitionConfig(
                    encoding=riva.client.AudioEncoding.LINEAR_PCM,
                    sample_rate_hertz=SAMPLE_RATE,
                    language_code=LANGUAGE,
                    max_alternatives=1,
                    enable_automatic_punctuation=True
                ),
                interim_results=True
            )
            
            print("[Riva] Connected. Listening for audio chunks...")
            responses = asr.streaming_response_generator(
                audio_chunks=audio_generator(),
                streaming_config=config
            )
            
            for response in responses:
                if not running:
                    break
                if not response.results:
                    continue
                
                result = response.results[0]
                text = result.alternatives[0].transcript
                
                # Push result back to asyncio loop thread
                loop.call_soon_threadsafe(
                    result_queue.put_nowait, 
                    {"text": text, "is_final": result.is_final}
                )
                
            print("[Riva] Streaming response generator ended.")
        except Exception as e:
            print(f"[Riva Error] {e}")
            if running:
                loop.call_soon_threadsafe(
                    result_queue.put_nowait, 
                    {"error": str(e)}
                )

    loop = asyncio.get_running_loop()
    riva_thread = threading.Thread(target=run_riva, daemon=True)
    riva_thread.start()

    async def receive_audio():
        try:
            while running:
                # Receive binary audio chunks (PCM Int16)
                data = await websocket.receive_bytes()
                audio_queue.put(data)
        except WebSocketDisconnect:
            print("[Voice] WebSocket disconnected.")
        except Exception as e:
            print(f"[Voice] Receive error: {e}")

    async def send_results():
        try:
            while running:
                msg = await result_queue.get()
                if "error" in msg:
                    print(f"[Voice] Sending error to client: {msg['error']}")
                    await websocket.send_json({"error": msg["error"]})
                    break
                await websocket.send_json(msg)
        except Exception as e:
            print(f"[Voice] Send error: {e}")

    rx_task = asyncio.create_task(receive_audio())
    tx_task = asyncio.create_task(send_results())

    # Wait for either task to finish (e.g. client disconnects or Riva fails)
    done, pending = await asyncio.wait(
        [rx_task, tx_task],
        return_when=asyncio.FIRST_COMPLETED
    )
    
    running = False
    for task in pending:
        task.cancel()
    
    print("[Voice] Session closed.")
