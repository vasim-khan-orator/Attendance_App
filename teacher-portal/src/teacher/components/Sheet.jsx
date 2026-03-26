import React from "react";
import { useMembers } from "../TeacherDashboard"; // Changed
import { studentAuthStorage } from "../utils/authStorage";

export default function Sheet() {
  const { members } = useMembers();

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Members Sheet</h2>
      <div style={styles.tableWrapper}>
        {members.length === 0 ? (
          <div style={styles.emptyState}>No members added yet</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>S.No</th>
                <th style={styles.tableHeaderCell}>Roll Number</th>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Login Status</th>
                <th style={styles.tableHeaderCell}>Default Password</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => {
                const hasPassword = studentAuthStorage.getPassword(member.rollNo || member.roll_no) !== null;
                const defaultPassword = member.rollNo || member.roll_no; // Default is roll number
                
                return (
                  <tr key={member.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{index + 1}</td>
                    {/* ✅ FIXED: Handle both rollNo and roll_no */}
                    <td style={styles.tableCell}>{member.rollNo || member.roll_no}</td>
                    <td style={styles.tableCell}>{member.name}</td>
                    <td style={styles.tableCell}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: hasPassword ? '#dcfce7' : '#fef2f2',
                        color: hasPassword ? '#166534' : '#991b1b'
                      }}>
                        {hasPassword ? 'Active' : 'No Password'}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {hasPassword ? defaultPassword : 'Not Set'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "20px" },
  title: { fontSize: "24px", fontWeight: "bold", marginBottom: "20px" },
  tableWrapper: { backgroundColor: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden" },
  emptyState: { padding: "40px", textAlign: "center", color: "#64748b" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeader: { backgroundColor: "#f1f5f9" },
  tableHeaderCell: { padding: "15px", textAlign: "left", fontWeight: "600", color: "#334155", fontSize: "14px", borderBottom: "2px solid #e2e8f0" },
  tableRow: { borderBottom: "1px solid #e2e8f0" },
  tableCell: { padding: "15px", color: "#475569", fontSize: "14px" },
  statusBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" },
};
