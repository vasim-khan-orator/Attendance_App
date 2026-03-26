// src/teacher/components/Timer.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { timerStorage } from "../utils/timerStorage";
import { API_BASE_URL } from "../../config";

export default function Timer({ onTimerStateChange }) {
  const [timeLeft, setTimeLeft] = useState(timerStorage.getRemainingTime());
  const [isRunning, setIsRunning] = useState(timerStorage.getTimerSettings().isRunning);
  const [customTime, setCustomTime] = useState("10:00:00");

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        const remaining = timerStorage.getRemainingTime();
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          clearInterval(interval);
          handleStopTimer();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async () => {
    if (customTime) {
      const [hours, minutes, seconds] = customTime.split(':').map(Number);
      const totalSeconds = hours * 3600 + minutes * 60 + (seconds || 0);
      
      const settings = timerStorage.getTimerSettings();
      settings.duration = totalSeconds;
      settings.remainingTime = totalSeconds;
      timerStorage.saveTimerSettings(settings);
    }
    
    timerStorage.startTimer();
    setIsRunning(true);
    setTimeLeft(timerStorage.getRemainingTime());
    
    // Start backend session
    try {
      await axios.post(`${API_BASE_URL}/attendance/session/start`);
    } catch (err) {
      console.error("Failed to start backend session", err);
    }
    
    if (onTimerStateChange) onTimerStateChange(true);
  };

  const handleStopTimer = async () => {
    timerStorage.stopTimer();
    setIsRunning(false);

    try {
      // Stop backend session and archive data
      await axios.post(`${API_BASE_URL}/attendance/session/stop`);
    } catch (err) {
      console.error("Failed to stop backend session", err);
    }

    if (onTimerStateChange) onTimerStateChange(false);
  };

  const handleResetTimer = async () => {
    timerStorage.resetTimer();
    setIsRunning(false);
    setTimeLeft(10 * 60 * 60);
    setCustomTime("10:00:00");
    
    if (onTimerStateChange) onTimerStateChange(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.timerDisplay}>
        <div style={styles.time}>{formatTime(timeLeft)}</div>
        <div style={styles.status}>
          Status: <span style={{ color: isRunning ? '#16a34a' : '#dc2626' }}>
            {isRunning ? 'RUNNING' : 'STOPPED'}
          </span>
        </div>
      </div>

      <div style={styles.controls}>
        <div style={styles.timeInput}>
          <label style={styles.label}>Set Timer (HH:MM:SS):</label>
          <input
            type="text"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            placeholder="10:00:00"
            style={styles.input}
            disabled={isRunning}
          />
        </div>

        <div style={styles.buttons}>
          {!isRunning ? (
            <button 
              style={styles.startButton}
              onClick={handleStartTimer}
            >
              Start Timer
            </button>
          ) : (
            <button 
              style={styles.stopButton}
              onClick={handleStopTimer}
            >
              Stop Timer
            </button>
          )}
          
          <button 
            style={styles.resetButton}
            onClick={handleResetTimer}
            disabled={isRunning}
          >
            Reset Timer
          </button>
        </div>
      </div>

      <div style={styles.instructions}>
        <p>• Timer must be running to start scanner</p>
        <p>• When timer stops, data moves to Previous Status</p>
        <p>• Default: 10 hours (36000 seconds)</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#f8fafc",
    padding: "20px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    marginBottom: "20px",
  },
  timerDisplay: {
    textAlign: "center",
    marginBottom: "20px",
  },
  time: {
    fontSize: "48px",
    fontWeight: "bold",
    color: "#1e293b",
    fontFamily: "monospace",
    marginBottom: "10px",
  },
  status: {
    fontSize: "16px",
    color: "#64748b",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    marginBottom: "15px",
  },
  timeInput: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  label: {
    fontWeight: "600",
    color: "#334155",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  input: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    color: "#000000",
    width: "120px",
  },
  buttons: {
    display: "flex",
    gap: "10px",
  },
  startButton: {
    flex: 1,
    padding: "10px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  stopButton: {
    flex: 1,
    padding: "10px",
    backgroundColor: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  resetButton: {
    flex: 1,
    padding: "10px",
    backgroundColor: "#64748b",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
    opacity: 0.7,
  },
  instructions: {
    fontSize: "12px",
    color: "#64748b",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "10px",
  },
};
