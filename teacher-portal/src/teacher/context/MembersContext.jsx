// teacher/context/MembersContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  getMembers,
  addMemberApi,
  removeMemberApi
} from "../../api/membersApi";

const MembersContext = createContext();

export function MembersProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- LOAD MEMBERS FROM BACKEND ----
  useEffect(() => {
    async function loadMembers() {
      try {
        console.log("Fetching members from backend...");
        const data = await getMembers();

        if (!data || data.length === 0) {
          console.log("No members found in backend (showing empty list)");
          setMembers([]);
          setError(null);
        } else {
          setMembers(data);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to load members:", err);
        setError("Unable to load members from server");
        setMembers([]);
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, []);

  // ---- ADD MEMBER (USE API RESPONSE) ----
  const addMember = async (newMember) => {
    try {
      const res = await addMemberApi(newMember);   // ⬅️ WAIT FOR BACKEND
      const saved = await res.json();              // ⬅️ GET DB OBJECT

      setMembers(prev => [...prev, saved]);        // ⬅️ USE BACKEND VALUE
      return saved;
    } catch (err) {
      console.error("Add member failed:", err);
      throw new Error("Failed to add member. Try again.");
    }
  };

  // ---- REMOVE MEMBER ----
  const removeMember = async (rollNo) => {
    try {
      await removeMemberApi(rollNo);
      setMembers(prev => prev.filter(m => m.roll_no !== rollNo));
    } catch (err) {
      console.error("Remove member failed:", err);
      throw new Error("Failed to remove member. Try again.");
    }
  };

  return (
    <MembersContext.Provider
      value={{ members, addMember, removeMember, isLoading: loading, error }}
    >
      {children}
    </MembersContext.Provider>
  );
}

export function useMembers() {
  const ctx = useContext(MembersContext);
  if (!ctx) throw new Error("useMembers must be used within MembersProvider");
  return ctx;
}
