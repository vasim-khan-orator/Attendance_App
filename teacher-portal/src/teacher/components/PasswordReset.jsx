// src/teacher/components/PasswordReset.jsx
import React, { useState } from "react";
import { studentAuthStorage } from "../utils/authStorage";
import { API_BASE_URL } from "../../config";
import { getApiErrorMessage, parseFetchResponseOrThrow } from "../../api/errorUtils";

export default function PasswordReset() {
  const [teacherOldPass, setTeacherOldPass] = useState("");
  const [teacherNewPass, setTeacherNewPass] = useState("");
  const [studentRollNo, setStudentRollNo] = useState("");
  const [studentNewPass, setStudentNewPass] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });

  const handleTeacherPasswordReset = async () => {
    if (!teacherOldPass || !teacherNewPass) {
      setMessage({ text: "Please fill both fields", type: "error" });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/teacher/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: teacherOldPass,
          new_password: teacherNewPass
        })
      });

      await parseFetchResponseOrThrow(res, "Password update failed");

      setMessage({ text: "Teacher password updated successfully!", type: "success" });
      setTeacherOldPass("");
      setTeacherNewPass("");

      // Clear message after 5 seconds
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);

    } catch (err) {
      console.error(err);
      setMessage({ text: getApiErrorMessage(err, "Backend not reachable"), type: "error" });
    }
  };

  const handleStudentPasswordReset = async () => {
    if (!studentRollNo || !studentNewPass) {
      setMessage({ text: "Please fill both fields", type: "error" });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/student/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roll_no: studentRollNo,
          new_password: studentNewPass
        })
      });

      await parseFetchResponseOrThrow(res, "Password update failed");

      setMessage({ 
        text: `Password for roll number ${studentRollNo} updated successfully!`, 
        type: "success" 
      });
      
      // Clear fields
      setStudentRollNo("");
      setStudentNewPass("");
      
      // Clear message after 5 seconds
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);

    } catch (err) {
      console.error(err);
      setMessage({ text: getApiErrorMessage(err, "Backend not reachable"), type: "error" });
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Password Reset</h2>
      
      {/* Teacher Password Reset */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Teacher Password</h3>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Old Password:</label>
          <input
            type="password"
            value={teacherOldPass}
            onChange={(e) => setTeacherOldPass(e.target.value)}
            style={styles.input}
            placeholder="Enter old password"
          />
        </div>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>New Password:</label>
          <input
            type="password"
            value={teacherNewPass}
            onChange={(e) => setTeacherNewPass(e.target.value)}
            style={styles.input}
            placeholder="Enter new password"
          />
        </div>
        
        <button 
          style={styles.saveButton} 
          onClick={handleTeacherPasswordReset}
        >
          Save Teacher Password
        </button>
      </div>

      {/* Student Password Reset */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Student Password</h3>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Roll Number:</label>
          <input
            type="text"
            value={studentRollNo}
            onChange={(e) => setStudentRollNo(e.target.value)}
            style={styles.input}
            placeholder="Enter student roll number"
          />
        </div>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>New Password:</label>
          <input
            type="password"
            value={studentNewPass}
            onChange={(e) => setStudentNewPass(e.target.value)}
            style={styles.input}
            placeholder="Enter new password"
          />
        </div>
        
        <button 
          style={styles.saveButton} 
          onClick={handleStudentPasswordReset}
        >
          Save Student Password
        </button>
      </div>

      {message.text && (
        <div style={{
          ...styles.message,
          backgroundColor: message.type === "success" ? "#dcfce7" : "#fef2f2",
          color: message.type === "success" ? "#166534" : "#991b1b",
          border: message.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { 
    padding: "20px", 
    maxWidth: "500px", 
    margin: "0 auto" 
  },
  title: { 
    fontSize: "24px", 
    fontWeight: "bold", 
    marginBottom: "30px", 
    color: "#1e293b",
    textAlign: "center" 
  },
  section: { 
    backgroundColor: "#f8fafc", 
    padding: "25px", 
    borderRadius: "10px", 
    marginBottom: "30px",
    border: "1px solid #e2e8f0"
  },
  sectionTitle: { 
    marginTop: "0", 
    marginBottom: "20px", 
    color: "#1e293b",
    fontSize: "18px",
    fontWeight: "600"
  },
  inputGroup: { 
    marginBottom: "15px" 
  },
  label: { 
    display: "block", 
    marginBottom: "8px", 
    fontWeight: "600", 
    color: "#334155", 
    fontSize: "14px" 
  },
  input: { 
    width: "100%", 
    padding: "12px 15px", 
    borderRadius: "6px", 
    border: "1px solid #cbd5e1", 
    fontSize: "16px", 
    boxSizing: "border-box",
    color: "#000000",
    outline: "none",
    transition: "border 0.3s",
    ":focus": {
      borderColor: "#16a34a",
      boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.1)",
    }
  },
  saveButton: {
    width: "100%", 
    padding: "14px", 
    color: "white", 
    border: "none", 
    borderRadius: "6px", 
    fontSize: "16px", 
    fontWeight: "bold", 
    backgroundColor: "#16a34a",
    cursor: "pointer",
    transition: "background 0.3s",
    ":hover": {
      backgroundColor: "#15803d",
    }
  },
  message: { 
    marginTop: "20px", 
    padding: "12px", 
    borderRadius: "6px", 
    textAlign: "center", 
    fontSize: "14px", 
    fontWeight: "500", 
  },
};
