import React, { useEffect, useRef, useState } from "react";
import { registerBiometricVector } from "../../api/biometricApi";
import { getApiErrorMessage } from "../../api/errorUtils";

export default function BiometricRegistration() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [rollNumber, setRollNumber] = useState("");
  const [phase, setPhase] = useState("idle");
  const [info, setInfo] = useState("");
  const [qualityReport, setQualityReport] = useState(null);

  const BRIGHTNESS_MIN = 65;
  const BRIGHTNESS_MAX = 210;
  const ENROLLMENT_SAMPLES = 3;
  const MIN_VALID_SAMPLES = 2;
  const FACE_AREA_MIN = 0.035;
  const CENTER_TOLERANCE_X = 0.28;
  const CENTER_TOLERANCE_Y = 0.30;

  useEffect(() => {
    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera access failed", err);
        setInfo("Camera access failed. Please allow camera permission.");
      }
    };

    startPreview();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const captureFrameAsBase64 = () => {
    if (!videoRef.current) {
      throw new Error("Camera preview is not ready");
    }
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to access canvas context");
    }
    ctx.drawImage(video, 0, 0, width, height);
    return {
      imageBase64: canvas.toDataURL("image/jpeg", 0.9),
      canvas,
    };
  };

  const analyzeBrightness = (canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return 0;
    }
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return sum / (data.length / 4);
  };

  const estimateCenteredFaceFallback = () => {
    // Fallback is intentionally permissive. Final validation still happens in backend
    // with OpenCV face detection during vector registration.
    return {
      centered: true,
      reason: "Using visual guide frame (browser face detector unavailable)",
      detectorAvailable: false,
    };
  };

  const detectCenteredFace = async (canvas) => {
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await detector.detect(canvas);
        if (!faces.length) {
          return {
            centered: false,
            reason: "No face detected. Look at camera directly.",
            detectorAvailable: true,
          };
        }

        const face = faces[0].boundingBox;
        const cx = face.x + face.width / 2;
        const cy = face.y + face.height / 2;
        const dx = Math.abs(cx - canvas.width / 2) / canvas.width;
        const dy = Math.abs(cy - canvas.height / 2) / canvas.height;
        const areaRatio = (face.width * face.height) / (canvas.width * canvas.height);

        if (areaRatio < FACE_AREA_MIN) {
          return {
            centered: false,
            reason: "Move closer to camera for better face capture.",
            detectorAvailable: true,
          };
        }

        if (dx > CENTER_TOLERANCE_X || dy > CENTER_TOLERANCE_Y) {
          return {
            centered: false,
            reason: "Center your face inside the guide frame.",
            detectorAvailable: true,
          };
        }

        return {
          centered: true,
          reason: "Face detected and centered",
          detectorAvailable: true,
        };
      } catch (err) {
        console.warn("FaceDetector check failed, using fallback", err);
      }
    }

    return estimateCenteredFaceFallback(canvas);
  };

  const runEnrollmentQualityChecks = async (canvas) => {
    const brightness = analyzeBrightness(canvas);
    const brightnessOk = brightness >= BRIGHTNESS_MIN && brightness <= BRIGHTNESS_MAX;
    const centeredFace = await detectCenteredFace(canvas);

    return {
      brightness,
      brightnessOk,
      centeredOk: centeredFace.centered,
      centeredReason: centeredFace.reason,
      detectorAvailable: centeredFace.detectorAvailable,
      passed: brightnessOk && centeredFace.centered,
    };
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleStart = async () => {
    const rollNo = rollNumber.trim();
    if (!rollNo) return;

    try {
      setPhase("capturing");
      setInfo("Capturing enrollment samples...");

      const validSamples = [];
      const reports = [];

      for (let i = 0; i < ENROLLMENT_SAMPLES; i += 1) {
        const { imageBase64, canvas } = captureFrameAsBase64();
        const report = await runEnrollmentQualityChecks(canvas);
        reports.push(report);

        if (report.passed) {
          validSamples.push(imageBase64);
        }

        if (i < ENROLLMENT_SAMPLES - 1) {
          await sleep(220);
        }
      }

      const brightnessAvg = reports.reduce((acc, r) => acc + r.brightness, 0) / reports.length;
      const brightnessOkCount = reports.filter((r) => r.brightnessOk).length;
      const centeredOkCount = reports.filter((r) => r.centeredOk).length;

      const aggregateReport = {
        brightness: brightnessAvg,
        brightnessOk: brightnessOkCount >= MIN_VALID_SAMPLES,
        centeredOk: centeredOkCount >= MIN_VALID_SAMPLES,
        detectorAvailable: reports.some((r) => r.detectorAvailable),
        centeredReason: `${validSamples.length}/${ENROLLMENT_SAMPLES} samples passed quality checks`,
        passed: validSamples.length >= MIN_VALID_SAMPLES,
        samplesPassed: validSamples.length,
        samplesTotal: ENROLLMENT_SAMPLES,
      };

      setQualityReport(aggregateReport);

      if (!aggregateReport.passed) {
        setPhase("idle");
        if (!aggregateReport.brightnessOk) {
          setInfo("Lighting is unstable across captures. Improve room light and retry.");
          return;
        }
        if (aggregateReport.detectorAvailable) {
          setInfo("Face alignment is inconsistent. Keep face fully inside the guide frame and retry.");
        } else {
          setInfo("Capture quality was inconsistent. Keep face inside guide frame, avoid movement, and retry.");
        }
        return;
      }

      setPhase("processing");
      setInfo("Registering stronger biometric profile...");

      const response = await registerBiometricVector({
        roll_no: rollNo,
        images_base64: validSamples,
      });

      setPhase("success");
      setInfo(
        `Vector saved for ${response.roll_no} (${response.vector_size} dimensions, ${response.samples_used} samples)`
      );
    } catch (err) {
      console.error("Biometric registration failed", err);
      setPhase("idle");
      const errorMessage = getApiErrorMessage(err, "Registration failed");
      const lower = errorMessage.toLowerCase();
      if (lower.includes("member with roll number") && lower.includes("not found")) {
        setInfo("Roll number not found in roster. Add this member first in Add Member, then register biometric.");
      } else {
        setInfo(errorMessage);
      }
    }
  };

  const isBusy = phase === "capturing" || phase === "processing";

  const statusText = {
    idle: "Ready for biometric capture",
    capturing: "Capturing face data...",
    processing: "Processing face model...",
    success: "Face Registered Successfully",
  }[phase];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.title}>Biometric Registration</div>
          <div style={styles.subtitle}>Secure face enrollment console</div>
        </div>

        <label style={styles.label} htmlFor="roll-number-input">
          Roll Number
        </label>
        <input
          id="roll-number-input"
          type="text"
          placeholder="Enter roll number"
          value={rollNumber}
          onChange={event => setRollNumber(event.target.value)}
          style={styles.input}
          disabled={isBusy}
        />

        <button
          type="button"
          onClick={handleStart}
          disabled={isBusy || !rollNumber.trim()}
          style={{
            ...styles.button,
            opacity: isBusy || !rollNumber.trim() ? 0.6 : 1,
          }}
        >
          {isBusy ? "Capturing..." : "Start Capture"}
        </button>

        <div style={styles.previewWrapper}>
          <video ref={videoRef} style={styles.video} muted playsInline />

          <div style={styles.guideOverlay}>
            <div style={styles.guideFrame} />
            <div style={styles.guideText}>Align face inside frame</div>
          </div>

          {isBusy && (
            <div style={styles.scanningOverlay}>
              <div style={styles.scanningRing} />
              <div style={styles.scanningText}>{statusText}</div>
            </div>
          )}
        </div>

        <div style={styles.statusRow}>
          <div style={styles.statusText}>{statusText}</div>
          {phase === "success" && (
            <div style={styles.successBadge}>
              <span style={styles.successIcon}>✓</span>
              Success
            </div>
          )}
        </div>

        {!!info && <div style={styles.infoText}>{info}</div>}

        {qualityReport && (
          <div style={styles.qualityPanel}>
            <div style={styles.qualityTitle}>Enrollment Quality Check</div>
            <div style={styles.qualityRow}>
              <span>Brightness:</span>
              <span style={{ color: qualityReport.brightnessOk ? "#22c55e" : "#f87171" }}>
                {qualityReport.brightness.toFixed(1)}
              </span>
            </div>
            <div style={styles.qualityRow}>
              <span>Face Centered:</span>
              <span style={{ color: qualityReport.centeredOk ? "#22c55e" : "#f87171" }}>
                {qualityReport.centeredOk ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.qualityRow}>
              <span>Valid Samples:</span>
              <span style={{ color: qualityReport.passed ? "#22c55e" : "#f87171" }}>
                {qualityReport.samplesPassed}/{qualityReport.samplesTotal}
              </span>
            </div>
            <div style={styles.qualityHint}>{qualityReport.centeredReason}</div>
            {!qualityReport.detectorAvailable && (
              <div style={styles.qualityHint}>
                Tip: Browser auto-face-check unavailable. Keep your face inside the white frame.
              </div>
            )}
          </div>
        )}

        <div style={styles.guideChecklist}>
          <div style={styles.guideChecklistTitle}>Capture Tips</div>
          <ul style={styles.guideChecklistList}>
            <li>Keep your full face inside the guide frame.</li>
            <li>Look straight at camera, avoid side angle.</li>
            <li>Stay still for 2-3 seconds during capture.</li>
            <li>Use even light on your face, avoid backlight.</li>
          </ul>
          </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #020617 100%)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  card: {
    width: "min(520px, 92vw)",
    maxHeight: "100%",
    background: "rgba(255, 255, 255, 0.08)",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.45)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    backdropFilter: "blur(18px)",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "0.5px",
  },
  subtitle: {
    fontSize: "14px",
    color: "rgba(226, 232, 240, 0.75)",
  },
  label: {
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "rgba(226, 232, 240, 0.7)",
  },
  input: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    borderRadius: "12px",
    padding: "12px 14px",
    color: "#f8fafc",
    fontSize: "16px",
    outline: "none",
  },
  button: {
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#f8fafc",
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    boxShadow: "0 12px 24px rgba(34, 197, 94, 0.25)",
  },
  previewWrapper: {
    position: "relative",
    borderRadius: "18px",
    overflow: "hidden",
    background: "rgba(15, 23, 42, 0.8)",
    minHeight: "clamp(160px, 28vh, 240px)",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(148, 163, 184, 0.25)",
  },
  placeholder: {
    fontSize: "14px",
    color: "rgba(226, 232, 240, 0.7)",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  guideOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  guideFrame: {
    width: "58%",
    height: "76%",
    border: "2px dashed rgba(248, 250, 252, 0.8)",
    borderRadius: "16px",
    boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.22)",
  },
  guideText: {
    position: "absolute",
    bottom: "14px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.5)",
    color: "#f8fafc",
    fontSize: "12px",
    padding: "5px 9px",
    borderRadius: "999px",
  },
  scanningOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  scanningRing: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "3px solid rgba(248, 250, 252, 0.25)",
    borderTopColor: "#22c55e",
    animation: "spin 1s linear infinite",
  },
  scanningText: {
    fontSize: "14px",
    color: "rgba(226, 232, 240, 0.85)",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "14px",
  },
  statusText: {
    color: "rgba(226, 232, 240, 0.8)",
  },
  infoText: {
    color: "rgba(226, 232, 240, 0.9)",
    fontSize: "13px",
    background: "rgba(15, 23, 42, 0.55)",
    padding: "8px 10px",
    borderRadius: "10px",
  },
  qualityPanel: {
    marginTop: "4px",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  qualityTitle: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    color: "rgba(226, 232, 240, 0.75)",
  },
  qualityRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#e2e8f0",
  },
  qualityHint: {
    fontSize: "12px",
    color: "rgba(226, 232, 240, 0.8)",
  },
  guideChecklist: {
    marginTop: "2px",
    background: "rgba(15, 23, 42, 0.45)",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    borderRadius: "10px",
    padding: "8px 10px",
  },
  guideChecklistTitle: {
    fontSize: "12px",
    color: "rgba(226, 232, 240, 0.9)",
    marginBottom: "4px",
    fontWeight: 600,
  },
  guideChecklistList: {
    margin: 0,
    paddingLeft: "16px",
    fontSize: "12px",
    color: "rgba(226, 232, 240, 0.82)",
    lineHeight: 1.35,
  },
  successBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
  },
  successIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "rgba(34, 197, 94, 0.2)",
  },
};
