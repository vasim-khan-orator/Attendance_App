// src/pages/student/StudentDashboard.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { api } from "../../api/client";
import { API_BASE_URL } from "../../config";
import { getApiErrorMessage } from "../../api/errorUtils";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  // Get roll number from login
  const rollNo = location.state?.rollNo || localStorage.getItem("studentRollNo") || "Not Available";

  useEffect(() => {
    // Save roll number to localStorage for persistence
    if (rollNo && rollNo !== "Not Available") {
      localStorage.setItem("studentRollNo", rollNo);
    }
    
    // Update time every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [rollNo]);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  const checkQRPermission = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/qr/check-access/${rollNo}`
      );
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.allowed === true;
    } catch (error) {
      console.error("Error checking QR permission:", error);
      return false;
    }
  };

  const handleGetQRCode = async () => {
    setLoading(true);

    try {
      // First check if permission exists
      const hasPermission = await checkQRPermission();
      
      if (!hasPermission) {
        alert("QR access not granted by teacher. Please ask your teacher to grant QR access first.");
        setLoading(false);
        return;
      }

      // If permission exists, get the latest QR code
      const res = await api.get("/qr/latest");

      if (!res.data) {
        alert("No QR code generated yet. Ask teacher to generate it.");
        setLoading(false);
        return;
      }

      setQrCode(res.data.code);
      setShowQR(true);

    } catch (err) {
      if (err.response?.status === 404) {
        alert("No QR code available. Ask your teacher to generate one first.");
      } else {
        alert(getApiErrorMessage(err, "Unable to connect to server"));
        console.error(err);
      }
    }

    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("studentRollNo");
    navigate("/");
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          Student @{rollNo}
        </div>
        <div style={styles.headerRight}>
          Date: {formatDate(currentTime)} | Time: {formatTime(currentTime)}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {!showQR ? (
          <div style={styles.getQRContainer}>
            <button 
              style={loading ? styles.getButtonDisabled : styles.getButton}
              onClick={handleGetQRCode}
              disabled={loading}
            >
              {loading ? "Checking Permission..." : "GET QR Code"}
            </button>
            {loading && <div style={styles.loadingText}>Verifying access permission...</div>}
          </div>
        ) : (
          <div style={styles.qrContainer}>
            <h3 style={styles.qrTitle}>Your Attendance QR Code</h3>
            
            <div style={styles.qrCodeDisplay}>
              <QRCodeCanvas
                value={qrCode}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div style={styles.qrInfo}>
              <p><strong>Roll Number:</strong> {rollNo}</p>
              <p><strong>Code:</strong> {qrCode}</p>
              <p><strong>Status:</strong> ✅ Access granted by teacher</p>
              <p><strong>Valid Until:</strong> Show this to teacher for attendance</p>
            </div>
            
            <button 
              style={styles.newCodeButton}
              onClick={handleGetQRCode}
              disabled={loading}
            >
              {loading ? "Loading..." : "Generate New Code"}
            </button>
          </div>
        )}
        
        {!showQR && (
          <div style={styles.instructionBox}>
            <p style={styles.instructionTitle}>How to get your QR Code:</p>
            <ol style={styles.instructionList}>
              <li>Your teacher must first grant QR access for your account</li>
              <li>Click "GET QR Code" to retrieve your attendance QR</li>
              <li>Show the QR code to your teacher, or use face scan for attendance marking</li>
              <li>If access is denied, contact your teacher</li>
            </ol>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div style={styles.footer}>
        <button 
          style={styles.logoutButton}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f8fafc",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 30px",
    backgroundColor: "#16a34a",
    color: "white",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  headerLeft: {
    fontSize: "22px",
    fontWeight: "bold",
  },
  headerRight: {
    fontSize: "16px",
    fontFamily: "monospace",
  },
  mainContent: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "calc(100vh - 150px)",
    padding: "20px",
  },
  getQRContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  getButton: {
    padding: "25px 50px",
    fontSize: "28px",
    fontWeight: "bold",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "15px",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(22, 163, 74, 0.4)",
    transition: "all 0.3s",
    marginBottom: "15px",
    ":hover": {
      transform: "translateY(-3px)",
      boxShadow: "0 8px 25px rgba(22, 163, 74, 0.5)",
    }
  },
  getButtonDisabled: {
    padding: "25px 50px",
    fontSize: "28px",
    fontWeight: "bold",
    backgroundColor: "#94a3b8",
    color: "white",
    border: "none",
    borderRadius: "15px",
    cursor: "not-allowed",
    marginBottom: "15px",
  },
  loadingText: {
    fontSize: "14px",
    color: "#64748b",
    marginTop: "10px",
  },
  qrContainer: {
    backgroundColor: "white",
    padding: "30px",
    borderRadius: "15px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    textAlign: "center",
    maxWidth: "500px",
    width: "100%",
  },
  qrTitle: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: "20px",
  },
  qrCodeDisplay: {
    padding: "20px",
    backgroundColor: "#f8fafc",
    borderRadius: "10px",
    marginBottom: "20px",
    display: "inline-block",
  },
  qrInfo: {
    textAlign: "left",
    backgroundColor: "#f1f5f9",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "14px",
  },
  newCodeButton: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":disabled": {
      backgroundColor: "#94a3b8",
      cursor: "not-allowed",
    }
  },
  instructionBox: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    maxWidth: "500px",
    marginTop: "30px",
  },
  instructionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: "10px",
  },
  instructionList: {
    margin: "0",
    paddingLeft: "20px",
    fontSize: "14px",
    color: "#475569",
    lineHeight: "1.6",
  },
  instruction: {
    fontSize: "18px",
    color: "#64748b",
    textAlign: "center",
    maxWidth: "400px",
    marginTop: "20px",
  },
  footer: {
    position: "absolute",
    bottom: "20px",
    right: "20px",
  },
  logoutButton: {
    padding: "10px 20px",
    backgroundColor: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
};
