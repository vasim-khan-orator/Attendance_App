// src/pages/auth/LoginSwitcher.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import { getApiErrorMessage, parseFetchResponseOrThrow } from "../../api/errorUtils";

export default function LoginSwitcher() {
  const [mode, setMode] = useState("teacher");
  const [username, setUsername] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ==== TEACHER LOGIN (BACKEND) ====
  const handleTeacherLogin = async (e) => {
    e?.preventDefault();
    console.log("LOGIN CLICKED");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/login/teacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await parseFetchResponseOrThrow(res, "Invalid username or password");
      console.log("LOGIN SUCCESS", data);

      navigate("/teacher-dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      alert(getApiErrorMessage(err, "Could not connect to backend"));
    } finally {
      setLoading(false);
    }
  };

  // ==== STUDENT LOGIN (BACKEND) ====
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!rollNo || !password) {
      alert("Please enter roll number and password");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/login/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roll_no: rollNo,
          password: password
        }),
      });

      const data = await parseFetchResponseOrThrow(res, "Invalid roll number or password");

      console.log("STUDENT LOGIN SUCCESS", data);

      navigate("/student-dashboard", {
        state: {
          rollNo: data.roll_no,
          name: data.name,
        }
      });

    } catch (err) {
      console.error("Student login failed:", err);
      alert(getApiErrorMessage(err, "Could not connect to backend"));
    } finally {
      setLoading(false);
    }
  };

  // ==== MAIN SUBMIT HANDLER ====
  const handleLogin = (e) => {
    if (mode === "teacher") return handleTeacherLogin(e);
    return handleStudentLogin(e);
  };

  return (
    <div style={styles.page}>
      <form onSubmit={handleLogin} style={styles.card}>

        {/* SWITCH TABS */}
        <div style={styles.switchRow}>
          <button
            type="button"
            onClick={() => {
              setMode("teacher");
              setUsername("");
              setPassword("");
            }}
            style={{
              ...styles.tab,
              background: mode === "teacher" ? "#16a34a" : "#ffffff",
              color: mode === "teacher" ? "#ffffff" : "#16a34a",
              borderRight: "none",
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
            }}
          >
            Teacher
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("student");
              setRollNo("");
              setPassword("");
            }}
            style={{
              ...styles.tab,
              background: mode === "student" ? "#16a34a" : "#ffffff",
              color: mode === "student" ? "#ffffff" : "#16a34a",
              borderLeft: "none",
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
          >
            Student
          </button>
        </div>

        <h2 style={styles.heading}>
          {mode === "teacher" ? "Teacher Login" : "Student Login"}
        </h2>

        {/* ==== TEACHER FIELDS ==== */}
        {mode === "teacher" && (
          <>
            <label style={styles.label}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username (admin)"
              style={styles.input}
            />

            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={styles.input}
            />

            <div style={styles.note}>Default: admin / admin</div>
          </>
        )}

        {/* ==== STUDENT FIELDS ==== */}
        {mode === "student" && (
          <>
            <label style={styles.label}>Roll Number</label>
            <input
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              placeholder="Enter your roll number"
              style={styles.input}
            />

            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={styles.input}
            />

            <div style={styles.note}>
              Default password is your roll number
            </div>
          </>
        )}

        <button 
          type="submit" 
          style={styles.loginBtn}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  },
  card: {
    width: 400,
    maxWidth: "92%",
    padding: 32,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    background: "#ffffff",
  },
  switchRow: {
    display: "flex",
    marginBottom: 28,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "white",
  },
  tab: {
    flex: 1,
    padding: "14px 0",
    border: "1px solid #16a34a",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  heading: {
    textAlign: "center",
    marginBottom: 24,
    color: "#000000",
    fontWeight: 700,
    fontSize: 24,
  },
  label: {
    fontWeight: 700,
    marginBottom: 8,
    color: "#000000",
  },
  input: {
    width: "100%",
    padding: 14,
    borderRadius: 8,
    border: "1px solid #9ca3af",
    fontSize: 16,
    marginBottom: 10,
  },
  note: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
    fontStyle: "italic",
  },
  loginBtn: {
    marginTop: 10,
    width: "100%",
    padding: 15,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 17,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    cursor: "pointer",
    ":disabled": {
      backgroundColor: "#9ca3af",
      cursor: "not-allowed",
    }
  },
};
