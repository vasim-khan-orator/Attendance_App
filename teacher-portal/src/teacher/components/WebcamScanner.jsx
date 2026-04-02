// src/teacher/components/WebcamScanner.jsx
import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { markAttendance } from "../utils/attendanceStorage";
import { useMembers } from "../TeacherDashboard";
import { scanBiometric } from "../../api/biometricApi";
import { getApiErrorMessage } from "../../api/errorUtils";

const ROLL_COOLDOWN_MS = 3000;
const FRAME_INTERVAL_MS = 450;
const FACE_SCAN_INTERVAL_MS = 1800;
const FACE_MATCH_THRESHOLD = 0.70;

function extractRollFromQr(text) {
  const value = (text || "").trim();
  if (!value) return "";

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      return String(parsed.roll_no || parsed.rollNo || parsed.roll || "").trim();
    } catch {
      // ignore JSON parse errors and continue with other formats
    }
  }

  if (value.startsWith("ALLOWED-")) {
    const parts = value.split("-");
    return parts.length >= 2 ? parts[1] : "";
  }
  if (value.includes(":")) {
    return value.split(":").pop().trim();
  }
  if (value.includes("|")) {
    return value.split("|")[0].trim();
  }
  return value;
}

export default function WebcamScanner({ isScannerActive, onScanResult, reloadCurrentAttendance }) {
  const { members } = useMembers();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const busyRef = useRef(false);
  const lastFaceAttemptRef = useRef(0);
  const recentMarkedRef = useRef(new Map());
  const barcodeDetectorRef = useRef(null);

  const [message, setMessage] = useState("Start timer to enable scanner");
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFaceResult, setLastFaceResult] = useState(null);
  const [lastDetection, setLastDetection] = useState("NONE");
  const [lastFrameFaces, setLastFrameFaces] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch (err) {
        console.warn("BarcodeDetector init failed, fallback to jsQR", err);
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isScannerActive) {
      setAutoScanEnabled(false);
      setMessage("Start timer to enable scanner");
      setLastDetection("NONE");
    }
  }, [isScannerActive]);

  useEffect(() => {
    if (!isScannerActive || !autoScanEnabled) {
      stopAutoScanner();
      return;
    }

    startAutoScanner();
    return () => {
      stopAutoScanner();
    };
  }, [isScannerActive, autoScanEnabled]);

  const startAutoScanner = async () => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setMessage("Auto mode active: show QR or face to camera");
      loopRef.current = setInterval(() => {
        void scanFrame();
      }, FRAME_INTERVAL_MS);
    } catch (err) {
      console.error("Auto scanner start failed", err);
      setMessage(getApiErrorMessage(err, "Camera access failed"));
      setAutoScanEnabled(false);
    }
  };

  const stopAutoScanner = () => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsProcessing(false);
    busyRef.current = false;
  };

  const pruneRecentMarks = (nowMs) => {
    for (const [roll, ts] of recentMarkedRef.current.entries()) {
      if (nowMs - ts > ROLL_COOLDOWN_MS * 2) {
        recentMarkedRef.current.delete(roll);
      }
    }
  };

  const isCoolingDown = (rollNo, nowMs) => {
    const last = recentMarkedRef.current.get(rollNo) || 0;
    return nowMs - last < ROLL_COOLDOWN_MS;
  };

  const rememberMarked = (rollNo, nowMs) => {
    recentMarkedRef.current.set(rollNo, nowMs);
  };

  const getFrame = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      return null;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    if (!width || !height) {
      return null;
    }

    const canvas = canvasRef.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);

    return { width, height, imageData, imageBase64 };
  };

  const detectQrRolls = async (frame) => {
    const rolls = new Set();

    if (barcodeDetectorRef.current) {
      try {
        const results = await barcodeDetectorRef.current.detect(canvasRef.current);
        for (const item of results || []) {
          const roll = extractRollFromQr(item.rawValue || "");
          if (roll) rolls.add(roll);
        }
      } catch (err) {
        console.warn("BarcodeDetector detect failed", err);
      }
    }

    // Fallback when BarcodeDetector is unavailable or returns no results.
    if (rolls.size === 0) {
      const single = jsQR(frame.imageData.data, frame.width, frame.height, {
        inversionAttempts: "attemptBoth",
      });
      if (single?.data) {
        const roll = extractRollFromQr(single.data);
        if (roll) rolls.add(roll);
      }
    }

    return Array.from(rolls);
  };

  const emitScanResult = (rollNo, name, attendance) => {
    if (!onScanResult) return;
    onScanResult({
      roll_no: rollNo,
      name: name || "",
      time: attendance?.marked_at
        ? new Date(attendance.marked_at).toLocaleTimeString()
        : new Date().toLocaleTimeString(),
    });
  };

  const findMember = (rollNo) => members.find((m) => m.roll_no === rollNo || m.rollNo === rollNo);

  const markRoll = async (rollNo, source, nowMs, cycleMarkedSet) => {
    if (!rollNo || isCoolingDown(rollNo, nowMs) || cycleMarkedSet.has(rollNo)) {
      return null;
    }

    const attendance = await markAttendance(rollNo);
    rememberMarked(rollNo, nowMs);
    cycleMarkedSet.add(rollNo);

    const member = findMember(rollNo);
    const name = member?.name || attendance?.name || "";
    emitScanResult(rollNo, name, attendance);

    return {
      roll_no: rollNo,
      name,
      source,
      attendance,
    };
  };

  const processQrAttendanceBatch = async (rolls, nowMs, cycleMarkedSet) => {
    const uniqueRolls = Array.from(new Set((rolls || []).map((item) => String(item || "").trim()).filter(Boolean)));
    if (uniqueRolls.length === 0) {
      return { marked: [], errors: [] };
    }

    const settled = await Promise.allSettled(
      uniqueRolls.map((rollNo) => markRoll(rollNo, "QR", nowMs, cycleMarkedSet))
    );

    const marked = [];
    const errors = [];

    for (const result of settled) {
      if (result.status === "fulfilled") {
        if (result.value) {
          marked.push(result.value);
        }
      } else {
        errors.push(getApiErrorMessage(result.reason, "QR attendance failed"));
      }
    }

    return { marked, errors };
  };

  const processFaceAttendance = async (imageBase64, nowMs, cycleMarkedSet) => {
    try {
      const result = await scanBiometric({
        image_base64: imageBase64,
        status: "present",
      });

      const responseMatches = Array.isArray(result.matches) && result.matches.length > 0
        ? result.matches
        : (result.matched && result.roll_no
          ? [{
              roll_no: result.roll_no,
              name: result.name || "",
              similarity: typeof result.similarity === "number" ? result.similarity : 0,
              attendance: result.attendance || null,
            }]
          : []);

      if (responseMatches.length === 0) {
        const frameFaces = Array.isArray(result.face_results) ? result.face_results : [];
        const facesDetected = typeof result.faces_detected === "number" ? result.faces_detected : frameFaces.length;

        // Clear stale face data when no faces are in frame
        if (facesDetected === 0) {
          setLastFrameFaces([]);
          setLastFaceResult(null);
          return { marked: [], errors: [], detected: false };
        }

        setLastFrameFaces(frameFaces);
        setLastFaceResult({
          matched: false,
          similarity: typeof result.similarity === "number" ? result.similarity : 0,
          matchCount: 0,
          facesDetected,
          scannedAt: new Date().toISOString(),
        });
        return { marked: [], errors: [], detected: facesDetected > 0 };
      }

      const top = responseMatches[0];
      const frameFaces = Array.isArray(result.face_results) ? result.face_results : [];
      setLastFrameFaces(frameFaces);
      setLastFaceResult({
        matched: true,
        roll_no: top.roll_no,
        name: top.name || "Unknown",
        similarity: top.similarity,
        matchCount: responseMatches.length,
        facesDetected: typeof result.faces_detected === "number" ? result.faces_detected : frameFaces.length,
        scannedAt: new Date().toISOString(),
      });

      const marked = [];
      for (const item of responseMatches) {
        const rollNo = String(item.roll_no || "").trim();
        if (!rollNo || isCoolingDown(rollNo, nowMs) || cycleMarkedSet.has(rollNo)) {
          continue;
        }

        rememberMarked(rollNo, nowMs);
        cycleMarkedSet.add(rollNo);

        const member = findMember(rollNo);
        const name = item.name || member?.name || "";
        emitScanResult(rollNo, name, item.attendance || null);

        marked.push({
          roll_no: rollNo,
          name,
          source: "FACE",
          similarity: item.similarity,
          attendance: item.attendance || null,
        });
      }

      return { marked, errors: [], detected: true };
    } catch (err) {
      setLastFrameFaces([]);
      setLastFaceResult({
        matched: false,
        similarity: 0,
        matchCount: 0,
        facesDetected: 0,
        scannedAt: new Date().toISOString(),
      });
      return {
        marked: [],
        errors: [getApiErrorMessage(err, "Face attendance failed")],
        detected: false,
      };
    }
  };

  const scanFrame = async () => {
    if (busyRef.current || !isScannerActive || !autoScanEnabled) {
      return;
    }

    const frame = getFrame();
    if (!frame) {
      return;
    }

    busyRef.current = true;
    setIsProcessing(true);

    try {
      const now = Date.now();
      pruneRecentMarks(now);

      const cycleMarkedSet = new Set();
      const markedEntries = [];
      const allErrors = [];

      const qrRolls = await detectQrRolls(frame);
      const qrDetected = qrRolls.length > 0;
      const faceDue = now - lastFaceAttemptRef.current >= FACE_SCAN_INTERVAL_MS;
      let faceDetected = false;

      if (qrDetected) {
        const qrResult = await processQrAttendanceBatch(qrRolls, now, cycleMarkedSet);
        markedEntries.push(...qrResult.marked);
        allErrors.push(...qrResult.errors);
      }

      if (faceDue) {
        lastFaceAttemptRef.current = now;
        const faceResult = await processFaceAttendance(frame.imageBase64, now, cycleMarkedSet);
        faceDetected = faceResult.detected;
        markedEntries.push(...faceResult.marked);
        allErrors.push(...faceResult.errors);
      }

      if (qrDetected && faceDetected) {
        setLastDetection("QR + FACE");
      } else if (qrDetected) {
        setLastDetection("QR");
      } else if (faceDetected) {
        setLastDetection("FACE");
      }

      if (markedEntries.length > 0) {
        const summary = markedEntries
          .map((item) => `${item.roll_no}${item.name ? ` (${item.name})` : ""}`)
          .join(", ");
        setMessage(`Attendance marked: ${summary}`);
        if (reloadCurrentAttendance) {
          reloadCurrentAttendance();
        }
      } else if (allErrors.length > 0) {
        setMessage(allErrors[0]);
      } else if (qrDetected || faceDue) {
        setMessage("Detection running. Show QR or face clearly to mark attendance.");
      }
    } catch (err) {
      console.error("Auto scanner frame error", err);
      setMessage(getApiErrorMessage(err, "Scanner processing failed"));
    } finally {
      busyRef.current = false;
      setIsProcessing(false);
    }
  };

  const similarityPercent = (value) => {
    if (typeof value !== "number") {
      return "--";
    }
    const normalized = Math.max(0, Math.min(1, value));
    return `${(normalized * 100).toFixed(1)}%`;
  };

  return (
    <div style={{ padding: 10 }}>
      <h3>Smart Scanner</h3>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 220,
          background: "#f1f5f9",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#0f172a",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "58%",
              height: "76%",
              border: "2px dashed rgba(248, 250, 252, 0.85)",
              borderRadius: 14,
              boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.2)",
            }}
          />
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: 10 }}>{message}</p>

      <button
        onClick={() => setAutoScanEnabled((prev) => !prev)}
        disabled={!isScannerActive}
        style={{
          width: "100%",
          marginTop: 8,
          padding: "10px 12px",
          border: "none",
          borderRadius: 8,
          background: !isScannerActive
            ? "#94a3b8"
            : autoScanEnabled
              ? "#dc2626"
              : "#16a34a",
          color: "#ffffff",
          fontWeight: 700,
          cursor: !isScannerActive ? "not-allowed" : "pointer",
        }}
      >
        {!isScannerActive
          ? "Start timer first"
          : autoScanEnabled
            ? "Stop Auto Scan"
            : "Start Auto Scan"}
      </button>

      <div style={{ textAlign: "center", fontSize: 13, color: "#475569", marginTop: 8 }}>
        Auto mode detects QR and Face with one scanner
      </div>

      <div style={{ textAlign: "center", fontSize: 13, color: "#0f172a", marginTop: 6 }}>
        Last detection: <strong>{lastDetection}</strong>
      </div>

      {isProcessing && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#0f172a", marginTop: 6 }}>
          Processing current frame...
        </div>
      )}

      {lastFaceResult && (
        <div
          style={{
            marginTop: 10,
            borderRadius: 10,
            padding: 12,
            border: `1px solid ${lastFaceResult.matched ? "#22c55e" : "#f87171"}`,
            background: lastFaceResult.matched ? "#f0fdf4" : "#fef2f2",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
            Face Confidence Panel
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#1e293b" }}>
            Similarity: {similarityPercent(lastFaceResult.similarity)}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>
            Threshold: {similarityPercent(FACE_MATCH_THRESHOLD)}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>
            Matches in frame: {lastFaceResult.matchCount || 0}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#334155" }}>
            Faces detected: {lastFaceResult.facesDetected || 0}
          </div>

          {lastFaceResult.matched ? (
            <div
              style={{
                marginTop: 8,
                borderRadius: 8,
                background: "#ffffff",
                border: "1px solid #bbf7d0",
                padding: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b" }}>Matched Student</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                {lastFaceResult.name}
              </div>
              <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>
                Roll No: {lastFaceResult.roll_no}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Scanned: {new Date(lastFaceResult.scannedAt).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12, color: "#7f1d1d" }}>
              No face match yet. Keep face centered and look directly at camera.
            </div>
          )}

          {lastFrameFaces.length > 0 && (
            <div
              style={{
                marginTop: 10,
                borderTop: "1px solid #e2e8f0",
                paddingTop: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Faces scanned in this instance
              </div>
              {lastFrameFaces.map((face) => (
                <div
                  key={`face-${face.face_index}`}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "6px 8px",
                    marginBottom: 6,
                    background: "#ffffff",
                    fontSize: 12,
                    color: "#1e293b",
                  }}
                >
                  <div>
                    Face {face.face_index}: {face.matched
                      ? `${face.roll_no || "Unknown"}${face.name ? ` - ${face.name}` : ""}`
                      : "No confident match"}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 2 }}>
                    Similarity: {typeof face.similarity === "number" ? similarityPercent(face.similarity) : "--"}
                    {face.matched
                      ? ` | Attendance: ${face.attendance_recorded ? "Recorded" : "Already marked"}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
