// TeacherDashboard.jsx
import React, { useState, useEffect, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import membersStorage from "./utils/membersStorage";
import { getCurrentAttendance } from "../api/attendanceApi"; // Import the new API function
import { API_BASE_URL } from "../config";
import { getApiErrorMessage, parseFetchResponseOrThrow } from "../api/errorUtils";

// Import all components
import AddMember from "./components/AddMember";
import RemoveMember from "./components/RemoveMember";
import Sheet from "./components/Sheet";
import BiometricRegistration from "./components/BiometricRegistration";
import VectorSheet from "./components/VectorSheet";
import PasswordReset from "./components/PasswordReset";
import QRGenerator from "./components/QRGenerator";
import CurrentStatus from "./components/CurrentStatus";
import PreviousStatus from "./components/PreviousStatus";
import WebcamScanner from "./components/WebcamScanner";

// ===== MEMBERS CONTEXT =====
const MembersContext = createContext();

export function MembersProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ UPDATED: Load members from BACKEND first, fallback to IndexedDB
  useEffect(() => {
    async function loadMembers() {
      try {
        console.log("Loading members from BACKEND...");

        const res = await fetch(`${API_BASE_URL}/members`);
        const data = await parseFetchResponseOrThrow(res, "Failed to load members from backend");

        const normalized = data.map(m => ({
          ...m,
          rollNo: m.roll_no   // unify key for UI
        }));

        setMembers(normalized);
        setError(null);

      } catch (err) {
        console.error("Backend failed — fallback to IndexedDB", err);

        // Fallback to local storage
        try {
          const local = await membersStorage.getAllMembers();
          setMembers(local);
        } catch (localErr) {
          console.error("IndexedDB also failed", localErr);
          setError('Failed to load members from both backend and local storage.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, []);

  const addMember = async (newMember) => {
    try {
      console.log('Adding new member:', newMember);
      const addedMember = await membersStorage.addMember(newMember);
      
      // Update local state
      setMembers(prev => [...prev, addedMember]);
      
      return addedMember;
    } catch (error) {
      console.error('Error adding member:', error);
      throw new Error(getApiErrorMessage(error, 'Failed to add member. Please try again.'));
    }
  };

  // ✅ UPDATED: Remove member from backend and refresh list
  const removeMember = async (rollNo) => {
    try {
      // Delete from backend
      const deleteRes = await fetch(`${API_BASE_URL}/members/${rollNo}`, {
        method: "DELETE",
      });
      await parseFetchResponseOrThrow(deleteRes, "Failed to remove member");

      // Refresh members from backend
      const res = await fetch(`${API_BASE_URL}/members`);
      const data = await parseFetchResponseOrThrow(res, "Failed to refresh members");

      const normalized = data.map(m => ({
        ...m,
        rollNo: m.roll_no
      }));

      setMembers(normalized);

      alert("Member removed successfully");
      return true;
    } catch (e) {
      console.error("Remove failed", e);
      alert(getApiErrorMessage(e, "Failed to remove member"));
      return false;
    }
  };

  const clearAllMembers = async () => {
    try {
      await membersStorage.clearAllMembers();
      setMembers([]);
      console.log('All members cleared');
    } catch (error) {
      console.error('Error clearing members:', error);
      throw error;
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #16a34a',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <div style={{
          marginTop: '20px',
          fontSize: '16px',
          color: '#666',
        }}>Loading members data...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#fef2f2',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#991b1b', marginBottom: '20px', maxWidth: '400px' }}>
          {error}
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <MembersContext.Provider value={{ 
      members, 
      addMember, 
      removeMember, 
      clearAllMembers,
      isLoading: loading 
    }}>
      {children}
    </MembersContext.Provider>
  );
}

export function useMembers() {
  const context = useContext(MembersContext);
  if (!context) {
    throw new Error("useMembers must be used within MembersProvider");
  }
  return context;
}

// ===== DASHBOARD CONTENT COMPONENT =====
function DashboardContent() {
  const navigate = useNavigate();
  const { members } = useMembers();
  
  const [activeMainMenu, setActiveMainMenu] = useState("Status");
  const [activeSubMenu, setActiveSubMenu] = useState("CurrentStatus");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [currentAttendance, setCurrentAttendance] = useState([]);

  const loadAttendance = async () => {
    try {
      const data = await getCurrentAttendance();
      setCurrentAttendance(data || []);
    } catch (e) {
      console.error("Failed to load attendance", e);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    loadAttendance();
    const interval = setInterval(loadAttendance, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(interval);
    };
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

  const handleLogout = () => {
    navigate("/");
  };

  const handleMenuClick = (mainMenu, subMenu) => {
    if (subMenu === "Logout") {
      handleLogout();
      return;
    }
    setActiveMainMenu(mainMenu);
    setActiveSubMenu(subMenu);
  };

  const handleTimerStateChange = (isRunning) => {
    setIsScannerActive(isRunning);
  };

  const handleTimerStop = () => {
    setCurrentAttendance([]);
    setIsScannerActive(false);
  };

  const handleScanResult = (scanData) => {
    // Update current attendance display without duplicate roll numbers.
    setCurrentAttendance((prev) => {
      if (prev.some((row) => row.roll_no === scanData.roll_no)) {
        return prev;
      }
      return [...prev, scanData];
    });
  };

  const renderActiveComponent = () => {
    switch (activeSubMenu) {
      case "CurrentStatus":
        return <CurrentStatus onTimerStop={handleTimerStop} onTimerStateChange={handleTimerStateChange} />;
      case "PreviousStatus":
        return <PreviousStatus />;
      case "AddMember":
        return <AddMember />;
      case "RemoveMember":
        return <RemoveMember />;
      case "Sheet":
        return <Sheet />;
      case "BiometricRegistration":
        return <BiometricRegistration />;
      case "VectorSheet":
        return <VectorSheet />;
      case "QRGenerator":
        return <QRGenerator />;
      case "Password":
        return <PasswordReset />;
      default:
        return <CurrentStatus onTimerStop={handleTimerStop} onTimerStateChange={handleTimerStateChange} />;
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>Teacher Dashboard</div>
        <div style={styles.headerRight}>
          Date: {formatDate(currentTime)} | Time: {formatTime(currentTime)}
        </div>
      </div>

      <div style={styles.container}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.logo}>KALIBABA</div>

          {/* Status Menu */}
          <div style={styles.menuSection}>
            <div 
              style={styles.menuHeader} 
              onClick={() => setActiveMainMenu("Status")}
            >
              Status
            </div>
            {activeMainMenu === "Status" && (
              <>
                <div 
                  style={activeSubMenu === "CurrentStatus" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Status", "CurrentStatus")}
                >
                  Current Status
                </div>
                <div 
                  style={activeSubMenu === "PreviousStatus" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Status", "PreviousStatus")}
                >
                  Previous Status
                </div>
              </>
            )}
          </div>

          {/* Members Menu */}
          <div style={styles.menuSection}>
            <div 
              style={styles.menuHeader} 
              onClick={() => setActiveMainMenu("Members")}
            >
              Members
            </div>
            {activeMainMenu === "Members" && (
              <>
                <div 
                  style={activeSubMenu === "AddMember" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Members", "AddMember")}
                >
                  Add Member
                </div>
                <div 
                  style={activeSubMenu === "RemoveMember" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Members", "RemoveMember")}
                >
                  Remove Member
                </div>
                <div 
                  style={activeSubMenu === "Sheet" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Members", "Sheet")}
                >
                  Sheet
                </div>
                <div
                  style={
                    activeSubMenu === "BiometricRegistration"
                      ? styles.activeMenuItem
                      : styles.menuItem
                  }
                  onClick={() => handleMenuClick("Members", "BiometricRegistration")}
                >
                  Biometric Registration
                </div>
                <div
                  style={
                    activeSubMenu === "VectorSheet"
                      ? styles.activeMenuItem
                      : styles.menuItem
                  }
                  onClick={() => handleMenuClick("Members", "VectorSheet")}
                >
                  Vector Sheet
                </div>
              </>
            )}
          </div>

          {/* Settings Menu */}
          <div style={styles.menuSection}>
            <div 
              style={styles.menuHeader} 
              onClick={() => setActiveMainMenu("Settings")}
            >
              Settings
            </div>
            {activeMainMenu === "Settings" && (
              <>
                <div 
                  style={activeSubMenu === "QRGenerator" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Settings", "QRGenerator")}
                >
                  QR Generator
                </div>
                <div 
                  style={activeSubMenu === "Password" ? styles.activeMenuItem : styles.menuItem}
                  onClick={() => handleMenuClick("Settings", "Password")}
                >
                  Password Reset
                </div>
                <div 
                  style={styles.menuItem}
                  onClick={handleLogout}
                >
                  Logout
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={styles.mainContent}>
          <div style={styles.contentHeader}>
            <h2 style={styles.contentTitle}>HOME</h2>
          </div>
          
          <div style={styles.contentGrid}>
            <div style={styles.leftContent}>
              {renderActiveComponent()}
            </div>
            
            <div style={styles.rightContent}>
              <WebcamScanner 
                isScannerActive={isScannerActive}
                onScanResult={handleScanResult}
                reloadCurrentAttendance={loadAttendance}
              />
              
              <div style={styles.quickStats}>
                <h4 style={styles.quickStatsTitle}>Quick Stats</h4>
                <div style={styles.statItem}>
                  <span>Total Members:</span>
                  <span style={styles.statValue}>{members.length}</span>
                </div>
                <div style={styles.statItem}>
                  <span>Present Today:</span>
                  <span style={styles.statValue}>{currentAttendance.length}</span>
                </div>
                <div style={styles.statItem}>
                  <span>Absent Today:</span>
                  <span style={styles.statValue}>{Math.max(0, members.length - currentAttendance.length)}</span>
                </div>
                <div style={styles.statItem}>
                  <span>Scanner Status:</span>
                  <span style={{
                    color: isScannerActive ? '#16a34a' : '#dc2626',
                    fontWeight: 'bold'
                  }}>
                    {isScannerActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN EXPORT =====
export default function TeacherDashboard() {
  return (
    <MembersProvider>
      <DashboardContent />
    </MembersProvider>
  );
}

// ===== STYLES =====
const styles = {
  page: {
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
  },
  
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    backgroundColor: "#16a34a",
    color: "white",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  
  headerLeft: {
    fontSize: "24px",
    fontWeight: "bold",
  },
  
  headerRight: {
    fontSize: "16px",
    fontFamily: "monospace",
  },
  
  container: {
    display: "flex",
    height: "calc(100vh - 60px)",
  },
  
  sidebar: {
    width: "250px",
    backgroundColor: "#1e293b",
    color: "white",
    padding: "20px 0",
  },
  
  logo: {
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "center",
    padding: "20px",
    marginBottom: "20px",
    color: "#16a34a",
  },
  
  menuSection: {
    marginBottom: "20px",
  },
  
  menuHeader: {
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background 0.3s",
  },
  
  menuItem: {
    padding: "10px 36px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background 0.3s",
  },
  
  activeMenuItem: {
    padding: "10px 36px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#16a34a",
    color: "white",
    fontWeight: "bold",
  },
  
  mainContent: {
    flex: 1,
    padding: "20px",
    backgroundColor: "#f5f5f5",
    overflow: "auto",
  },
  
  contentHeader: {
    marginBottom: "20px",
  },
  
  contentTitle: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#1e293b",
  },
  
  contentGrid: {
    display: "flex",
    gap: "20px",
    height: "calc(100vh - 140px)",
  },
  
  leftContent: {
    flex: 3,
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    overflow: "auto",
  },
  
  rightContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  
  quickStats: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  
  quickStatsTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: "20px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "10px",
  },
  
  statItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  
  statValue: {
    fontWeight: "600",
    color: "#16a34a",
  },
};
