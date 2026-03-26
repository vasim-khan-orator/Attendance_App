// teacher/Sidebar.jsx
import React from "react";

export default function Sidebar({ 
  activeMainMenu, 
  setActiveMainMenu, 
  activeSubMenu, 
  setActiveSubMenu 
}) {
  const menuConfig = [
    {
      id: "Status",
      label: "Status",
      subMenus: [
        { id: "CurrentStatus", label: "Current Status" },
        { id: "PreviousStatus", label: "Previous Status" }
      ]
    },
    {
      id: "Members",
      label: "Members",
      subMenus: [
        { id: "AddMember", label: "Add Member" },
        { id: "RemoveMember", label: "Remove Member" },
        { id: "Sheet", label: "Sheet" }
      ]
    },
    {
      id: "Settings",
      label: "Settings",
      subMenus: [
        { id: "QRGenerator", label: "QR Generator" },
        { id: "Password", label: "Password Reset" },
        { id: "Logout", label: "Logout" }
      ]
    }
  ];

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>KALIBABA</div>
      
      {menuConfig.map((menu) => (
        <div key={menu.id} style={styles.menuSection}>
          <div 
            style={styles.menuHeader}
            onClick={() => setActiveMainMenu(menu.id)}
          >
            {menu.label}
          </div>
          {activeMainMenu === menu.id && (
            <>
              {menu.subMenus.map((subMenu) => (
                <div
                  key={subMenu.id}
                  style={
                    activeSubMenu === subMenu.id 
                      ? styles.activeMenuItem 
                      : styles.menuItem
                  }
                  onClick={() => setActiveSubMenu(subMenu.id)}
                >
                  {subMenu.label}
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  sidebar: {
    width: "250px",
    backgroundColor: "#1e293b",
    color: "white",
    padding: "20px 0",
    display: "flex",
    flexDirection: "column",
  },
  logo: {
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "center",
    padding: "20px",
    marginBottom: "20px",
    color: "#16a34a",
    borderBottom: "1px solid #334155",
  },
  menuSection: {
    marginBottom: "10px",
  },
  menuHeader: {
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background 0.3s",
    "&:hover": {
      backgroundColor: "#334155",
    },
  },
  menuItem: {
    padding: "10px 36px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background 0.3s",
    "&:hover": {
      backgroundColor: "#334155",
    },
  },
  activeMenuItem: {
    padding: "10px 36px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#16a34a",
    color: "white",
    fontWeight: "bold",
  },
};