import React, { useState, useEffect, useRef } from "react";
import { useMembers } from "../TeacherDashboard";
import { studentAuthStorage } from "../utils/authStorage";

export default function RemoveMember() {
  const { members, removeMember } = useMembers();
  const [rollNoToRemove, setRollNoToRemove] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isRemoving, setIsRemoving] = useState(false);
  // ref so event listeners always see the latest rollNoToRemove
  const rollNoRef = useRef("");

  const handleRemove = async (rollNoOverride) => {
    const rollNo = (rollNoOverride || rollNoRef.current || rollNoToRemove).trim();
    if (!rollNo) {
      setMessage({ 
        text: "Please enter a roll number", 
        type: "error" 
      });
      return;
    }

    setIsRemoving(true);

    try {
      const success = await removeMember(rollNo);
      
      if (success) {
        // Also remove the student's password
        studentAuthStorage.deletePassword(rollNoToRemove.trim());
        
        setMessage({ 
          text: `Member with roll number ${rollNo} removed successfully! Their login access has been revoked.`, 
          type: "success" 
        });
        setRollNoToRemove("");
      } else {
        setMessage({ 
          text: `No member found with roll number: ${rollNoToRemove}`, 
          type: "error" 
        });
      }
    } catch (error) {
      setMessage({ 
        text: error.message || "Failed to remove member", 
        type: "error" 
      });
    } finally {
      setIsRemoving(false);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  // ── Voice command listeners ─────────────────────────────────────────────
  useEffect(() => {
    const onFill = (e) => {
      const { rollNo = "" } = e.detail || {};
      rollNoRef.current = rollNo;
      setRollNoToRemove(rollNo);
    };
    const onSubmit = (e) => {
      const { rollNo } = e.detail || {};
      handleRemove(rollNo);
    };
    window.addEventListener("command-fill-remove-member", onFill);
    window.addEventListener("command-submit-remove-member", onSubmit);
    return () => {
      window.removeEventListener("command-fill-remove-member", onFill);
      window.removeEventListener("command-submit-remove-member", onSubmit);
    };
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Remove Member</h2>
      
      <div style={styles.searchSection}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Enter Roll Number to Remove</label>
          <input
            list="remove-roll-numbers"
            type="text"
            value={rollNoToRemove}
            onChange={(e) => setRollNoToRemove(e.target.value)}
            placeholder="Enter roll number"
            style={{
              ...styles.input,
              borderColor: isRemoving ? "#cbd5e1" : styles.input.border,
              backgroundColor: isRemoving ? "#f1f5f9" : "white",
            }}
            disabled={isRemoving}
          />
          <datalist id="remove-roll-numbers">
            {members.map((m) => (
              <option key={m.roll_no} value={m.roll_no}>{m.name}</option>
            ))}
          </datalist>
        </div>

        <button 
          onClick={handleRemove} 
          style={{
            ...styles.removeButton,
            backgroundColor: isRemoving ? "#94a3b8" : "#dc2626",
            cursor: isRemoving ? "not-allowed" : "pointer",
          }}
          disabled={isRemoving || !rollNoToRemove.trim()}
        >
          {isRemoving ? "Removing..." : "Remove Member"}
        </button>
      </div>

      {message.text && (
        <div style={{
          ...styles.message,
          backgroundColor: message.type === "success" ? "#dcfce7" : "#fef2f2",
          color: message.type === "success" ? "#000000" : "#000000",
          border: message.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "20px", maxWidth: "500px", margin: "0 auto" },
  title: { fontSize: "24px", fontWeight: "bold", marginBottom: "25px", textAlign: "center" },
  searchSection: { backgroundColor: "#f8fafc", padding: "25px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "25px" },
  inputGroup: { marginBottom: "20px" },
  label: { display: "block", marginBottom: "8px", fontWeight: "600", color: "#334155", fontSize: "14px" },
  input: { 
    width: "100%", 
    padding: "12px 15px", 
    borderRadius: "6px", 
    border: "1px solid #cbd5e1", 
    fontSize: "16px", 
    boxSizing: "border-box",
    transition: "all 0.3s",
    outline: "none",
    color: "#000000",
    ":focus": {
      borderColor: "#16a34a",
      boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.1)",
    }
  },
  removeButton: { width: "100%", padding: "14px", color: "white", border: "none", borderRadius: "6px", fontSize: "16px", fontWeight: "bold" },
  message: { padding: "12px", borderRadius: "6px", textAlign: "center", fontSize: "14px", fontWeight: "500", marginBottom: "25px" },
};
