// src/teacher/utils/attendanceStorage.js
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { getApiErrorMessage } from "../../api/errorUtils";

// 🔹 Get current attendance (UI-friendly format)
export async function getCurrentAttendance() {
  try {
    const res = await axios.get(`${API_BASE_URL}/attendance/current`);
    return res.data;
  } catch (error) {
    console.error("Error fetching current attendance:", getApiErrorMessage(error, "Failed to fetch current attendance"));
    return [];
  }
}

// 🔹 Mark attendance for a student
export async function markAttendance(roll_no) {
  try {
    const res = await axios.post(`${API_BASE_URL}/attendance/mark`, {
      roll_no,
      status: "present"
    });
    return res.data;
  } catch (error) {
    const message = getApiErrorMessage(error, "Failed to mark attendance");
    console.error("Error marking attendance:", message);
    throw new Error(message);
  }
}

// 🔹 Get all available attendance dates
export async function getAvailableDates() {
  try {
    const res = await axios.get(`${API_BASE_URL}/attendance/dates`);
    return res.data;
  } catch (error) {
    console.error("Error fetching available dates:", getApiErrorMessage(error, "Failed to fetch attendance dates"));
    return [];
  }
}

// 🔹 Get attendance for a specific date
export async function getAttendanceByDate(date) {
  try {
    const res = await axios.get(`${API_BASE_URL}/attendance/by-date/${date}`);
    return res.data;
  } catch (error) {
    console.error(`Error fetching attendance for date ${date}:`, getApiErrorMessage(error, "Failed to fetch attendance by date"));
    return [];
  }
}

// 🔹 Search attendance (client-side filter on fetched data)
export const searchAttendance = (records, searchTerm) => {
  const term = searchTerm.toLowerCase();
  return records.filter(item =>
    item.roll_no?.toLowerCase().includes(term) ||
    item.name?.toLowerCase().includes(term)
  );
};

// 🔹 Get today's attendance (using getCurrentAttendance instead)
export const getTodaysAttendance = async () => {
  return await getCurrentAttendance();
};

// 🔹 Check if student is already marked present today
export const isAlreadyMarkedToday = async (rollNo) => {
  try {
    const currentAttendance = await getCurrentAttendance();
    return currentAttendance.some(record => record.roll_no === rollNo);
  } catch (error) {
    console.error("Error checking attendance:", getApiErrorMessage(error, "Failed to check attendance"));
    return false;
  }
};

// 🔹 Compatibility object for backward compatibility
export const attendanceStorage = {
  getCurrentAttendance,
  getAvailableDates,
  getAttendanceByDate,
  searchAttendance,
  getTodaysAttendance,
  isAlreadyMarkedToday
};
