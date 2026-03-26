// src/teacher/components/CurrentStatus.jsx
import React, { useState, useEffect } from "react";
import { getCurrentAttendance } from "../utils/attendanceStorage";
import Timer from "./Timer"; // Import Timer component

export default function CurrentStatus({ onTimerStop, onTimerStateChange }) {
  const [attendance, setAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [isRunning, setIsRunning] = useState(false); // Renamed for Timer component

  // Load attendance data
  useEffect(() => {
    fetchAttendance();
  }, []);

  // Set up polling interval for real-time updates
  useEffect(() => {
    const interval = setInterval(fetchAttendance, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch attendance data
  const fetchAttendance = async () => {
    const data = await getCurrentAttendance();
    setAttendance(data);
    if (!searchTerm) setFilteredAttendance(data);
  };

  // Filter attendance when search term changes
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = attendance.filter(item =>
        item.roll_no?.toLowerCase().includes(term) ||
        item.name?.toLowerCase().includes(term)
      );
      setFilteredAttendance(filtered);
    } else {
      setFilteredAttendance(attendance);
    }
  }, [searchTerm, attendance]);

  // Timer state change handler
  const handleTimerStateChange = (isTimerRunning) => {
    setIsRunning(isTimerRunning);
    
    if (onTimerStateChange) {
      onTimerStateChange(isTimerRunning); // Notify parent component
    }
    
    // If timer stops, trigger the onTimerStop callback
    if (!isTimerRunning && onTimerStop) {
      onTimerStop(); // Move data to Previous Status
    }
  };

  const handleSearch = (e) => setSearchTerm(e.target.value);

  const clearAttendance = async () => {
    if (!window.confirm("Clear current attendance?")) return;
    
    // Note: You'll need to implement clearAttendance in attendanceStorage.js
    // For now, we'll just reload the data
    fetchAttendance();
  };

  const displayData = searchTerm ? filteredAttendance : attendance;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Current Status</h2>
        
        {/* Timer Component */}
        <Timer
          onTimerStateChange={handleTimerStateChange}   // 🔹 REQUIRED
          onTimerStop={onTimerStop}                     // Optional, for backward compatibility
        />
      </div>

      {/* ❌ WebcamScanner REMOVED - It's now in TeacherDashboard.jsx right sidebar ❌ */}

      <div style={styles.controls}>
        <div style={styles.searchBox}>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search by Roll Number or Name"
            style={styles.searchInput}
            disabled={!isRunning && attendance.length === 0}
          />

          <button
            style={styles.clearButton}
            onClick={clearAttendance}
            disabled={!isRunning || attendance.length === 0}
          >
            Clear All
          </button>
        </div>
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span>Total Present:</span>
          <span style={styles.statValue}>{attendance.length}</span>
        </div>

        <div style={styles.statItem}>
          <span>Timer Status:</span>
          <span
            style={{
              color: isRunning ? "#16a34a" : "#dc2626",
              fontWeight: "bold",
            }}
          >
            {isRunning ? "RUNNING" : "STOPPED"}
          </span>
        </div>
        
        <div style={styles.statItem}>
          <span>Scanner Control:</span>
          <span
            style={{
              color: isRunning ? "#16a34a" : "#dc2626",
              fontWeight: "bold",
            }}
          >
            {isRunning ? "SCANNER ACTIVE" : "START TIMER TO ACTIVATE"}
          </span>
        </div>
      </div>

      {displayData.length > 0 ? (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Roll Number</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Time Scanned</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>

            <tbody>
              {displayData.map((record, index) => (
                <tr key={index} style={styles.tr}>
                  <td style={styles.td}>{record.roll_no}</td>
                  <td style={styles.td}>{record.name}</td>
                  <td style={styles.td}>
                    {record.time_scanned ? 
                      new Date(record.time_scanned).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      }) : 
                      "N/A"
                    }
                  </td>
                  <td style={styles.td}>
                    <span style={styles.successBadge}>{record.status || "present"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.emptyState}>
          {searchTerm ? (
            <>
              <div style={styles.emptyIcon}>🔍</div>
              <p>No results for "{searchTerm}"</p>

              <button
                style={styles.clearSearchButton}
                onClick={() => setSearchTerm("")}
              >
                Clear Search
              </button>
            </>
          ) : (
            <>
              <div style={styles.emptyIcon}>📋</div>
              <p>No attendance records yet</p>

              <p style={styles.emptySubtext}>
                {isRunning
                  ? "Show QR or Face to record attendance"
                  : "Start the timer to begin scanning"}
              </p>
            </>
          )}
        </div>
      )}

      <div style={styles.instructions}>
        <p><strong>Note:</strong> Scanner only works when timer is running</p>
        <p>When timer stops, records move to Previous Status</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "20px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1e293b",
    margin: "0",
  },
  controls: {
    marginBottom: "20px",
  },
  searchBox: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    padding: "10px 15px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    color: "#000000",
    outline: "none",
  },
  clearButton: {
    padding: "10px 20px",
    backgroundColor: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
    opacity: 0.8,
  },
  stats: {
    display: "flex",
    gap: "30px",
    marginBottom: "20px",
    padding: "15px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#16a34a",
  },
  tableContainer: {
    overflowX: "auto",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "white",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: "#1e293b",
  },
  th: {
    padding: "12px 15px",
    textAlign: "left",
    color: "white",
    fontWeight: "bold",
    fontSize: "14px",
    borderBottom: "2px solid #334155",
  },
  tr: {
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "12px 15px",
    fontSize: "14px",
    color: "#334155",
  },
  successBadge: {
    padding: "4px 8px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "2px dashed #cbd5e1",
    marginBottom: "20px",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "15px",
  },
  emptySubtext: {
    color: "#64748b",
    fontSize: "14px",
    marginTop: "10px",
  },
  clearSearchButton: {
    padding: "8px 16px",
    backgroundColor: "#64748b",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "15px",
  },
  instructions: {
    padding: "15px",
    backgroundColor: "#fef3c7",
    borderRadius: "6px",
    borderLeft: "4px solid #f59e0b",
    fontSize: "14px",
    color: "#92400e",
  },
};
