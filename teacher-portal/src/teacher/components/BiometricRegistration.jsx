import React, { useEffect, useRef, useState } from "react";
import { registerBiometricVector } from "../../api/biometricApi";
import { getApiErrorMessage } from "../../api/errorUtils";

const POSES = [
  { key: "front", label: "Look Straight", icon: "⬤", instruction: "Face the camera directly" },
  { key: "left",  label: "Turn Left",     icon: "◀", instruction: "Turn your head slightly to the LEFT" },
  { key: "right", label: "Turn Right",    icon: "▶", instruction: "Turn your head slightly to the RIGHT" },
];

const BRIGHTNESS_MIN = 55;
const BRIGHTNESS_MAX = 220;
const COUNTDOWN_SECS = 3;

export default function BiometricRegistration() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [rollNumber, setRollNumber] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | capturing | processing | success
  const [poseIndex, setPoseIndex] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [info, setInfo] = useState("");
  const [qualityReport, setQualityReport] = useState(null);
  const countdownRef = useRef(null);

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
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const captureFrameAsBase64 = () => {
    if (!videoRef.current) throw new Error("Camera preview is not ready");
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to access canvas context");
    ctx.drawImage(video, 0, 0, width, height);
    return { imageBase64: canvas.toDataURL("image/jpeg", 0.9), canvas };
  };

  const analyzeBrightness = (canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (data.length / 4);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const runCountdown = () =>
    new Promise((resolve) => {
      let remaining = COUNTDOWN_SECS;
      setCountdown(remaining);
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          setCountdown(null);
          resolve();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    });

  const handleStart = async () => {
    const rollNo = rollNumber.trim();
    if (!rollNo) return;

    try {
      setPhase("capturing");
      setPoseIndex(0);
      setInfo("");
      setQualityReport(null);

      const samples = [];
      const poseKeys = [];

      for (let i = 0; i < POSES.length; i++) {
        setPoseIndex(i);
        setInfo(POSES[i].instruction);

        // Give user time to position their head
        await runCountdown();

        // Capture the frame
        const { imageBase64, canvas } = captureFrameAsBase64();
        const brightness = analyzeBrightness(canvas);

        if (brightness < BRIGHTNESS_MIN || brightness > BRIGHTNESS_MAX) {
          setPhase("idle");
          setInfo(
            `Brightness issue on "${POSES[i].label}" capture (${brightness.toFixed(0)}). ` +
            "Improve lighting and try again."
          );
          return;
        }

        samples.push(imageBase64);
        poseKeys.push(POSES[i].key);

        // Brief pause between captures
        if (i < POSES.length - 1) await sleep(300);
      }

      setQualityReport({
        samplesPassed: samples.length,
        samplesTotal: POSES.length,
        passed: true,
      });

      // Send to backend
      setPhase("processing");
      setInfo("Registering multi-pose biometric profile...");

      const response = await registerBiometricVector({
        roll_no: rollNo,
        images_base64: samples,
        poses: poseKeys,
      });

      setPhase("success");
      setInfo(
        `Vector saved for ${response.roll_no} — ` +
        `${response.vector_size}D × ${response.poses_stored} poses ` +
        `(${response.samples_used} samples)`
      );
    } catch (err) {
      console.error("Biometric registration failed", err);
      setPhase("idle");
      const errorMessage = getApiErrorMessage(err, "Registration failed");
      const lower = errorMessage.toLowerCase();
      if (lower.includes("member with roll number") && lower.includes("not found")) {
        setInfo(
          "Roll number not found in roster. Add this member first in Add Member, then register biometric."
        );
      } else {
        setInfo(errorMessage);
      }
    }
  };

  const isBusy = phase === "capturing" || phase === "processing";
  const currentPose = POSES[poseIndex] || POSES[0];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>Biometric Registration</div>
          <div style={styles.subtitle}>Multi-pose face enrollment console</div>
        </div>

        {/* Roll Number Input */}
        <label style={styles.label} htmlFor="roll-number-input">
          Roll Number
        </label>
        <input
          id="roll-number-input"
          type="text"
          placeholder="Enter roll number"
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
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
          {isBusy ? "Capturing..." : "Start 3-Pose Capture"}
        </button>

        {/* Step Progress Indicator */}
        {phase === "capturing" && (
          <div style={styles.stepsRow}>
            {POSES.map((pose, idx) => (
              <div
                key={pose.key}
                style={{
                  ...styles.stepDot,
                  ...(idx < poseIndex
                    ? styles.stepDone
                    : idx === poseIndex
                    ? styles.stepActive
                    : styles.stepPending),
                }}
              >
                <span style={styles.stepIcon}>
                  {idx < poseIndex ? "✓" : pose.icon}
                </span>
                <span style={styles.stepLabel}>{pose.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Camera Preview */}
        <div style={styles.previewWrapper}>
          <video ref={videoRef} style={styles.video} muted playsInline />

          <div style={styles.guideOverlay}>
            <div
              style={{
                ...styles.guideFrame,
                borderColor:
                  phase === "capturing"
                    ? currentPose.key === "front"
                      ? "rgba(34, 197, 94, 0.85)"
                      : currentPose.key === "left"
                      ? "rgba(96, 165, 250, 0.85)"
                      : "rgba(251, 191, 36, 0.85)"
                    : "rgba(248, 250, 252, 0.8)",
              }}
            />

            {/* Pose Direction Arrow Overlay */}
            {phase === "capturing" && (
              <div style={styles.poseArrow}>
                <span style={styles.poseArrowIcon}>
                  {currentPose.key === "front"
                    ? "👁️"
                    : currentPose.key === "left"
                    ? "◀️"
                    : "▶️"}
                </span>
                <span style={styles.poseArrowText}>{currentPose.instruction}</span>
              </div>
            )}

            {/* Countdown */}
            {countdown !== null && (
              <div style={styles.countdownOverlay}>
                <div style={styles.countdownNumber}>{countdown}</div>
              </div>
            )}

            {!phase || phase === "idle" ? (
              <div style={styles.guideText}>Align face inside frame</div>
            ) : null}
          </div>

          {phase === "processing" && (
            <div style={styles.scanningOverlay}>
              <div style={styles.scanningRing} />
              <div style={styles.scanningText}>Processing face models...</div>
            </div>
          )}
        </div>

        {/* Status Row */}
        <div style={styles.statusRow}>
          <div style={styles.statusText}>
            {phase === "idle" && "Ready for biometric capture"}
            {phase === "capturing" && `Capturing: ${currentPose.label}`}
            {phase === "processing" && "Processing face models..."}
            {phase === "success" && "Face Registered Successfully"}
          </div>
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
            <div style={styles.qualityTitle}>Enrollment Quality</div>
            <div style={styles.qualityRow}>
              <span>Poses Captured:</span>
              <span style={{ color: qualityReport.passed ? "#22c55e" : "#f87171" }}>
                {qualityReport.samplesPassed}/{qualityReport.samplesTotal}
              </span>
            </div>
          </div>
        )}

        {/* Capture Tips */}
        <div style={styles.guideChecklist}>
          <div style={styles.guideChecklistTitle}>Capture Tips</div>
          <ul style={styles.guideChecklistList}>
            <li>A 3-second countdown plays before each capture.</li>
            <li><strong>Step 1:</strong> Look straight at the camera.</li>
            <li><strong>Step 2:</strong> Turn your head slightly LEFT.</li>
            <li><strong>Step 3:</strong> Turn your head slightly RIGHT.</li>
            <li>Use even lighting on your face; avoid backlight.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Styles (matching existing dark theme)                      */
/* ------------------------------------------------------------------ */
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
    width: "min(560px, 94vw)",
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
    gap: "14px",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  header: { display: "flex", flexDirection: "column", gap: "6px" },
  title: { fontSize: "24px", fontWeight: 700, letterSpacing: "0.5px" },
  subtitle: { fontSize: "14px", color: "rgba(226, 232, 240, 0.75)" },
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

  /* ---- Step Progress ---- */
  stepsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "18px",
    padding: "4px 0",
  },
  stepDot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    transition: "all 0.3s ease",
  },
  stepIcon: { fontSize: "22px", lineHeight: 1 },
  stepLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px" },
  stepDone: { color: "#22c55e", opacity: 1 },
  stepActive: { color: "#60a5fa", opacity: 1, transform: "scale(1.15)" },
  stepPending: { color: "rgba(226, 232, 240, 0.35)", opacity: 0.6 },

  /* ---- Camera Preview ---- */
  previewWrapper: {
    position: "relative",
    borderRadius: "18px",
    overflow: "hidden",
    background: "rgba(15, 23, 42, 0.8)",
    minHeight: "clamp(160px, 28vh, 260px)",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(148, 163, 184, 0.25)",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
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
    border: "2.5px dashed rgba(248, 250, 252, 0.8)",
    borderRadius: "16px",
    boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.22)",
    transition: "border-color 0.4s ease",
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

  /* ---- Pose Arrow ---- */
  poseArrow: {
    position: "absolute",
    top: "14px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(96, 165, 250, 0.5)",
    padding: "8px 14px",
    borderRadius: "999px",
    zIndex: 5,
  },
  poseArrowIcon: { fontSize: "20px" },
  poseArrowText: { fontSize: "13px", color: "#e2e8f0", fontWeight: 500 },

  /* ---- Countdown ---- */
  countdownOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15, 23, 42, 0.45)",
    zIndex: 4,
  },
  countdownNumber: {
    fontSize: "72px",
    fontWeight: 800,
    color: "rgba(248, 250, 252, 0.9)",
    textShadow: "0 4px 30px rgba(0,0,0,0.5)",
    animation: "pulse 1s ease-in-out infinite",
  },

  /* ---- Scanning / Processing ---- */
  scanningOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    background: "rgba(15, 23, 42, 0.55)",
    zIndex: 6,
  },
  scanningRing: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "3px solid rgba(248, 250, 252, 0.25)",
    borderTopColor: "#22c55e",
    animation: "spin 1s linear infinite",
  },
  scanningText: { fontSize: "14px", color: "rgba(226, 232, 240, 0.85)" },

  /* ---- Status ---- */
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "14px",
  },
  statusText: { color: "rgba(226, 232, 240, 0.8)" },
  infoText: {
    color: "rgba(226, 232, 240, 0.9)",
    fontSize: "13px",
    background: "rgba(15, 23, 42, 0.55)",
    padding: "8px 10px",
    borderRadius: "10px",
  },

  /* ---- Quality Panel ---- */
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

  /* ---- Capture Tips ---- */
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
    lineHeight: 1.5,
  },

  /* ---- Success Badge ---- */
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
