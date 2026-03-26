// teacher/Navbar.jsx
import React, { useEffect, useState } from "react";

export default function Navbar() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      second: "2-digit",
      hour12: false
    });
  };

  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.title}>Teacher Dashboard</span>
      </div>
      <div style={styles.headerRight}>
        <span style={styles.dateTime}>
          Date: {formatDate(currentTime)} | Time: {formatTime(currentTime)}
        </span>
        <span style={styles.userInfo}>Admin</span>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    backgroundColor: "#16a34a",
    color: "white",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    height: "60px",
    boxSizing: "border-box",
  },
  headerLeft: {
    fontSize: "24px",
    fontWeight: "bold",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "bold",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    fontSize: "14px",
  },
  dateTime: {
    fontFamily: "'Courier New', monospace",
    fontWeight: "500",
  },
  userInfo: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: "6px 16px",
    borderRadius: "20px",
    fontWeight: "bold",
    fontSize: "14px",
  },
};
