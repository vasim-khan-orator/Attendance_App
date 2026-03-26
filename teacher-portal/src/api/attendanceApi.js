import { API_BASE_URL } from "../config";
import { parseFetchResponseOrThrow } from "./errorUtils";

export async function getCurrentAttendance() {
  const res = await fetch(`${API_BASE_URL}/attendance/current`);
  return parseFetchResponseOrThrow(res, "Failed to load current attendance");
}

export async function addAttendance(record) {
  const res = await fetch(`${API_BASE_URL}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  return parseFetchResponseOrThrow(res, "Failed to add attendance");
}

export async function clearAttendance() {
  const res = await fetch(`${API_BASE_URL}/attendance/clear`, { method: "DELETE" });
  return parseFetchResponseOrThrow(res, "Failed to clear attendance");
}

