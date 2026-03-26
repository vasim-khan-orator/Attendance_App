// src/teacher/components/QRGenerator.jsx
import React, { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useMembers } from "../TeacherDashboard";
import { api } from "../../api/client";
import { API_BASE_URL } from "../../config";
import { getApiErrorMessage, parseFetchResponseOrThrow } from "../../api/errorUtils";

export default function QRGenerator() {
  const { members } = useMembers();
  const [selectedRoll, setSelectedRoll] = useState("");
  const [qrValue, setQrValue] = useState(null);

  const handleGenerate = async () => {
    const student = members.find(m => m.roll_no === selectedRoll);
    if (!student) {
      alert("Select a valid student");
      return;
    }

    const payload = `${student.roll_no}|${student.name}`;
    setQrValue(payload);

    try {
      // Save QR to backend DB
      await api.post("/qr", {
        code: payload,
        created_for: student.roll_no,
        created_at: new Date().toISOString(),
      });

      alert("QR saved to backend");
    } catch (err) {
      console.error(err);
      alert(getApiErrorMessage(err, "Failed to save QR to backend"));
    }
  };

  const handleGrantQRPermission = async () => {
    if (!selectedRoll) {
      alert("Please select a student first");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/qr/grant-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roll_no: selectedRoll,
          }),
        }
      );

      await parseFetchResponseOrThrow(res, "Failed to grant QR access");

      alert("QR access granted — student can now GET QR Code");

    } catch (err) {
      console.error(err);
      alert(getApiErrorMessage(err, "Server connection failed"));
    }
  };

  const handleDownload = () => {
    const canvas = document.querySelector("#student-qr canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `QR_${selectedRoll}.png`;
      link.click();
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>QR Code Generator</h2>

      <div style={styles.controls}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Select Student</label>
          <select
            value={selectedRoll}
            onChange={e => setSelectedRoll(e.target.value)}
            style={styles.select}
          >
            <option value="">-- Choose a student --</option>
            {members.map(m => (
              <option key={m.roll_no} value={m.roll_no}>
                {m.roll_no} — {m.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.buttonGroup}>
          <button
            onClick={handleGenerate}
            style={styles.generateButton}
            disabled={!selectedRoll}
          >
            Generate QR Code
          </button>
          <button
            onClick={handleGrantQRPermission}
            style={styles.accessButton}
            disabled={!selectedRoll}
          >
            Grant QR Access
          </button>
        </div>
      </div>

      {qrValue && (
        <div style={styles.qrContainer}>
          <div style={styles.qrCode} id="student-qr">
            <QRCodeCanvas 
              value={qrValue} 
              size={220}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="H"
            />
          </div>
          
          <div style={styles.qrInfo}>
            <p style={styles.infoText}>
              <strong>Roll No:</strong> {selectedRoll}
            </p>
            <p style={styles.infoText}>
              <strong>Name:</strong> {members.find(m => m.roll_no === selectedRoll)?.name || ""}
            </p>
            <p style={{...styles.infoText, fontSize: '12px', color: '#64748b'}}>
              Encoded: {qrValue}
            </p>
            
            <button
              onClick={handleDownload}
              style={styles.downloadButton}
            >
              Download QR Code
            </button>
          </div>
        </div>
      )}

      <div style={styles.instructions}>
        <h3 style={styles.instructionsTitle}>How to use:</h3>
        <ul style={styles.instructionsList}>
          <li>Select a student from the dropdown menu</li>
          <li>Click "Generate QR Code" to create a unique QR</li>
          <li>The QR code is automatically saved to the backend database</li>
          <li>Click "Grant QR Access" to allow the student to retrieve their QR code</li>
          <li>Download the QR code to share with the student</li>
          <li>Students can show this QR code, or attendance can be marked via face scan</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: { 
    padding: "20px", 
    maxWidth: "600px", 
    margin: "0 auto" 
  },
  title: { 
    fontSize: "24px", 
    fontWeight: "bold", 
    marginBottom: "30px", 
    color: "#1e293b",
    textAlign: "center" 
  },
  controls: {
    backgroundColor: "#f8fafc", 
    padding: "25px", 
    borderRadius: "10px", 
    marginBottom: "20px",
    border: "1px solid #e2e8f0"
  },
  inputGroup: { 
    marginBottom: "20px" 
  },
  label: { 
    display: "block", 
    marginBottom: "8px", 
    fontWeight: "600", 
    color: "#334155", 
    fontSize: "14px" 
  },
  select: { 
    width: "100%", 
    padding: "12px 15px", 
    borderRadius: "6px", 
    border: "1px solid #cbd5e1", 
    fontSize: "16px", 
    boxSizing: "border-box",
    color: "#000000",
    outline: "none",
    backgroundColor: "white"
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
  },
  generateButton: {
    flex: 1,
    padding: "12px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":disabled": {
      backgroundColor: "#9ca3af",
      cursor: "not-allowed"
    }
  },
  accessButton: {
    flex: 1,
    padding: "12px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":disabled": {
      backgroundColor: "#9ca3af",
      cursor: "not-allowed"
    }
  },
  qrContainer: {
    backgroundColor: "white",
    padding: "25px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    marginBottom: "30px",
    textAlign: "center"
  },
  qrCode: {
    display: "inline-block",
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    marginBottom: "20px"
  },
  qrInfo: {
    textAlign: "center"
  },
  infoText: {
    fontSize: "14px",
    color: "#475569",
    marginBottom: "8px"
  },
  downloadButton: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "15px",
    transition: "background-color 0.2s"
  },
  instructions: {
    backgroundColor: "#f1f5f9",
    padding: "20px",
    borderRadius: "8px",
    borderLeft: "4px solid #16a34a"
  },
  instructionsTitle: {
    marginTop: "0",
    marginBottom: "10px",
    color: "#1e293b",
    fontSize: "16px",
    fontWeight: "600"
  },
  instructionsList: {
    margin: "0",
    paddingLeft: "20px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: "1.6"
  }
};
