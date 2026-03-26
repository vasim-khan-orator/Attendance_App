import React, { useState } from "react";
import { useMembers } from "../TeacherDashboard";  // Changed
import { studentAuthStorage } from "../utils/authStorage";

export default function AddMember() {
  const { addMember } = useMembers();
  const [formData, setFormData] = useState({ rollNo: "", name: "" });
  const [message, setMessage] = useState({ text: "", type: "" }); // success/error
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear message when user starts typing
    if (message.text) setMessage({ text: "", type: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.rollNo.trim() || !formData.name.trim()) {
      setMessage({ 
        text: "Please fill in all fields", 
        type: "error" 
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Add member to database
      await addMember({
        rollNo: formData.rollNo.trim(),
        name: formData.name.trim()
      });
      
      // Set default password (roll number as password)
      const rollNoTrimmed = formData.rollNo.trim();
      studentAuthStorage.setPassword(rollNoTrimmed, rollNoTrimmed);
      console.log(`Default password set for roll number: ${rollNoTrimmed}`);
      
      setMessage({ 
        text: `Member "${formData.name}" added successfully! Default password is the roll number.`, 
        type: "success" 
      });
      
      // Reset form
      setFormData({
        rollNo: "",
        name: ""
      });
      
    } catch (error) {
      setMessage({ 
        text: error.message || "Failed to add member", 
        type: "error" 
      });
    } finally {
      setIsSubmitting(false);
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setMessage({ text: "", type: "" });
      }, 5000);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Add Member</h2>
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="rollNo">
            Roll Number *
          </label>
          <input
            type="text"
            id="rollNo"
            name="rollNo"
            value={formData.rollNo}
            onChange={handleChange}
            placeholder="e.g., 101, 102, 103"
            style={{
              ...styles.input,
              borderColor: isSubmitting ? "#cbd5e1" : styles.input.border,
              backgroundColor: isSubmitting ? "#f1f5f9" : "white",
              cursor: isSubmitting ? "not-allowed" : "text",
              color: "#000000"
            }}
            required
            disabled={isSubmitting}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="name">
            Full Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            style={{
              ...styles.input,
              borderColor: isSubmitting ? "#cbd5e1" : styles.input.border,
              backgroundColor: isSubmitting ? "#f1f5f9" : "white",
              cursor: isSubmitting ? "not-allowed" : "text",
              color: "#000000"
            }}
            required
            disabled={isSubmitting}
          />
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

        <button 
          type="submit" 
          style={{
            ...styles.saveButton,
            backgroundColor: isSubmitting ? "#94a3b8" : "#16a34a",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span style={styles.spinner}></span>
              Adding...
            </>
          ) : "Save Member"}
        </button>
      </form>

      <div style={styles.instructions}>
        <h4 style={styles.instructionsTitle}>Instructions:</h4>
        <ul style={styles.instructionsList}>
          <li>Enter unique roll number for each member</li>
          <li>Roll numbers must be unique (no duplicates)</li>
          <li>Enter full name of the member</li>
          <li>Click "Save Member" to add to database</li>
          <li>Default password will be set as the roll number</li>
          <li>Students can change password via Password Reset in Settings</li>
          <li>Data is saved permanently in browser storage</li>
        </ul>
      </div>
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
  form: { 
    backgroundColor: "#f8fafc", 
    padding: "25px", 
    borderRadius: "10px", 
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: "30px"
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
  saveButton: { 
    width: "100%", 
    padding: "14px", 
    color: "white", 
    border: "none", 
    borderRadius: "6px", 
    fontSize: "16px", 
    fontWeight: "bold", 
    transition: "background 0.3s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px"
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #ffffff",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    display: "inline-block"
  },
  message: { 
    marginTop: "15px", 
    padding: "12px", 
    borderRadius: "6px", 
    textAlign: "center", 
    fontSize: "14px", 
    fontWeight: "500", 
    marginBottom: "20px" 
  },
  instructions: {
    backgroundColor: "#f1f5f9",
    padding: "20px",
    borderRadius: "8px",
    borderLeft: "4px solid #16a34a",
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

// Add spinner animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);
