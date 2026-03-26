// src/teacher/utils/membersStorage.js
import { api } from "../../api/client";
import { getApiErrorMessage } from "../../api/errorUtils";

class MembersStorage {
  constructor() {
    console.log("MembersStorage backend mode enabled — DB is source of truth");
    // Keep these properties for compatibility but they won't be used
    this.dbName = 'TeacherDashboardDB';
    this.storeName = 'members';
    this.db = null;
  }

  // 🔹 Keep the same method signature for compatibility
  async initDB() {
    console.log("initDB called but not needed in backend mode");
    return Promise.resolve();
  }

  // 🔹 Keep for compatibility but always resolve immediately
  async waitForDB() {
    return Promise.resolve();
  }

  // 🔹 Get all members from backend DB (read-only, no auto-adding)
  async getAllMembers() {
    try {
      const res = await api.get("/members");
      return res.data || [];
    } catch (error) {
      console.error("Error fetching members:", getApiErrorMessage(error, "Failed to fetch members"));
      return [];
    }
  }

  // 🔹 Add member to backend DB (only when user explicitly adds)
  async addMember(member) {
    try {
      // Map frontend field names to backend schema
      const memberData = {
        name: member.name,
        roll_no: member.rollNo || member.roll_no,
        department: member.department || "",
        year: member.year || ""
      };
      
      const res = await api.post("/members", memberData);
      console.log(`Member added: ${member.rollNo || member.roll_no}`);
      return res.data;
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to add member");
      console.error("Error adding member:", message);
      throw new Error(message);
    }
  }

  // 🔹 Remove member by roll number
  async removeMember(rollNo) {
    try {
      // Use the rollNo parameter directly or extract from object
      const rollNumberToDelete = rollNo?.rollNo || rollNo;
      
      await api.delete(`/members/${rollNumberToDelete}`);
      console.log(`Member removed: ${rollNumberToDelete}`);
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to remove member");
      console.error("Error removing member:", message);
      throw new Error(message);
    }
  }

  // 🔹 Keep for compatibility but just log warning
  async clearAllMembers() {
    console.warn("clearAllMembers skipped — backend controls data now");
    return Promise.resolve();
  }
}

// ⚠️ Keep same export style so other files do NOT break
const membersStorage = new MembersStorage();
export default membersStorage;
