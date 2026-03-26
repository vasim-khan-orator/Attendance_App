import { API_BASE_URL } from "../config";
import { parseFetchResponseOrThrow } from "./errorUtils";

// ✅ Teacher login (validate against backend) - UPDATED PATH
export async function loginTeacher(username, password) {
  const res = await fetch(`${API_BASE_URL}/login/teacher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  return parseFetchResponseOrThrow(res, "Invalid username or password");
}

// ✅ Update teacher password (POST — not PUT)
export async function updateTeacherPassword(oldPass, newPass) {
  const res = await fetch(`${API_BASE_URL}/teacher/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_password: oldPass, new_password: newPass })
  });

  return parseFetchResponseOrThrow(res, "Failed to update password");
}
