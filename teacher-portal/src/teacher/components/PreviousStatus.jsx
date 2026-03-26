// src/teacher/components/PreviousStatus.jsx
import React, { useState, useEffect } from "react";
import { getAvailableDates, getAttendanceByDate } from "../utils/attendanceStorage";

export default function PreviousStatus() {
  const [inputDate, setInputDate] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [message, setMessage] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAvailableDates();
  }, []);

  const loadAvailableDates = async () => {
    try {
      const dates = await getAvailableDates();
      setAvailableDates(dates);
    } catch (error) {
      console.error("Error loading dates:", error);
    }
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD (ISO format)
  function convertToISO(dateStr) {
    const [dd, mm, yyyy] = dateStr.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  function convertToDisplay(dateStr) {
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }

  const handleDateChange = (e) => {
    const value = e.target.value;
    // Format: DD/MM/YYYY (for display)
    setInputDate(value);
  };

  const handleGetData = async () => {
    if (!inputDate) {
      setMessage("Please enter a date in DD/MM/YYYY format");
      return;
    }

    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(inputDate)) {
      setMessage("Invalid date format. Use DD/MM/YYYY");
      return;
    }

    setLoading(true);
    try {
      // Convert to API format (YYYY-MM-DD)
      const apiDate = convertToISO(inputDate);
      const data = await getAttendanceByDate(apiDate);
      setAttendance(data);
      setFilteredAttendance(data);
      
      if (data.length === 0) {
        setMessage(`No attendance data found for ${inputDate}`);
      } else {
        setMessage(`Found ${data.length} records for ${inputDate}`);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setMessage("Error loading attendance data");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term) {
      const filtered = attendance.filter(item =>
        item.roll_no?.toLowerCase().includes(term.toLowerCase()) ||
        item.name?.toLowerCase().includes(term.toLowerCase()) ||
        item.rollNo?.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredAttendance(filtered);
    } else {
      setFilteredAttendance(attendance);
    }
  };

  const displayData = searchTerm ? filteredAttendance : attendance;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Previous Status</h2>
      
      <div style={styles.dateSection}>
        <div style={styles.dateInputGroup}>
          <label style={styles.label}>Enter Date (DD/MM/YYYY):</label>
          <input
            type="text"
            value={inputDate}
            onChange={handleDateChange}
            placeholder="DD/MM/YYYY"
            style={styles.dateInput}
          />
          <button 
            style={styles.getDataButton}
            onClick={handleGetData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Get Data"}
          </button>
        </div>

        {availableDates.length > 0 && (
          <div style={styles.datesList}>
            <p style={styles.datesLabel}>Available dates:</p>
            <div style={styles.datesContainer}>
              {availableDates.slice(0, 5).map((apiDate, index) => {
                const displayDate = convertToDisplay(apiDate);
                return (
                  <button
                    key={index}
                    style={styles.dateChip}
                    onClick={() => {
                      setInputDate(displayDate);
                      // Auto-fetch if date is already selected
                      if (inputDate === displayDate) {
                        handleGetData();
                      }
                    }}
                  >
                    {displayDate}
                  </button>
                );
              })}
              {availableDates.length > 5 && (
                <span style={styles.moreDates}>+{availableDates.length - 5} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      {message && (
        <div style={styles.message}>
          {message}
        </div>
      )}

      {attendance.length > 0 && (
        <>
          <div style={styles.searchSection}>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search by Roll Number or Name"
              style={styles.searchInput}
            />
          </div>

          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span>Total Records:</span>
              <span style={styles.statValue}>{attendance.length}</span>
            </div>
            <div style={styles.statItem}>
              <span>Date:</span>
              <span style={styles.statValue}>{inputDate}</span>
            </div>
          </div>

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
                    <td style={styles.td}>{record.roll_no || record.rollNo}</td>
                    <td style={styles.td}>{record.name}</td>
                    <td style={styles.td}>
                      {record.marked_at || record.time_scanned || record.time ? 
                        new Date(record.marked_at || record.time_scanned || record.time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        }) : 
                        "N/A"
                      }
                    </td>
                    <td style={styles.td}>
                      <span style={styles.successBadge}>{record.status || record.scanned || "present"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayData.length === 0 && searchTerm && (
            <div style={styles.noResults}>
              No results found for "{searchTerm}"
              <button 
                style={styles.clearSearchButton}
                onClick={() => setSearchTerm("")}
              >
                Clear Search
              </button>
            </div>
          )}
        </>
      )}

      {attendance.length === 0 && inputDate && !message && !loading && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📅</div>
          <p>No attendance data available for {inputDate}</p>
          <p style={styles.emptySubtext}>
            Data is automatically saved when students show QR or Face for attendance
          </p>
        </div>
      )}

      <div style={styles.instructions}>
        <h4 style={styles.instructionsTitle}>How it works:</h4>
        <ul style={styles.instructionsList}>
          <li>Enter date in DD/MM/YYYY format or select from available dates</li>
          <li>Click "Get Data" to retrieve attendance for that date</li>
          <li>Data is fetched from the backend database</li>
          <li>Use search to filter by roll number or name</li>
          <li>Attendance data is shared across all devices</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: "30px",
    textAlign: "center",
  },
  dateSection: {
    backgroundColor: "#f8fafc",
    padding: "25px",
    borderRadius: "10px",
    marginBottom: "20px",
    border: "1px solid #e2e8f0",
  },
  dateInputGroup: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
    marginBottom: "15px",
  },
  label: {
    fontWeight: "600",
    color: "#334155",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  dateInput: {
    padding: "10px 15px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    color: "#000000",
    width: "200px",
    outline: "none",
  },
  getDataButton: {
    padding: "10px 30px",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  datesList: {
    marginTop: "15px",
    paddingTop: "15px",
    borderTop: "1px solid #e2e8f0",
  },
  datesLabel: {
    marginBottom: "8px",
    color: "#64748b",
    fontSize: "14px",
  },
  datesContainer: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  dateChip: {
    padding: "6px 12px",
    backgroundColor: "#e2e8f0",
    color: "#475569",
    border: "none",
    borderRadius: "16px",
    fontSize: "13px",
    cursor: "pointer",
  },
  moreDates: {
    fontSize: "13px",
    color: "#64748b",
    alignSelf: "center",
    paddingLeft: "8px",
  },
  message: {
    padding: "12px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: "6px",
    textAlign: "center",
    marginBottom: "20px",
    border: "1px solid #bbf7d0",
  },
  searchSection: {
    marginBottom: "20px",
  },
  searchInput: {
    width: "100%",
    padding: "12px 15px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    color: "#000000",
    outline: "none",
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
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1e293b",
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
  noResults: {
    textAlign: "center",
    padding: "20px",
    backgroundColor: "#fef2f2",
    borderRadius: "8px",
    color: "#991b1b",
    marginBottom: "20px",
  },
  clearSearchButton: {
    padding: "8px 16px",
    backgroundColor: "#64748b",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginLeft: "15px",
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
    fontWeight: "600",
  },
  instructionsList: {
    margin: "0",
    paddingLeft: "20px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: "1.6",
  },
};
