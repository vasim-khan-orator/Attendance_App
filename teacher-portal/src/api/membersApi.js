import { API_BASE_URL } from "../config";
import { parseFetchResponseOrThrow } from "./errorUtils";

export async function getMembers() {
  const res = await fetch(`${API_BASE_URL}/members`);
  return parseFetchResponseOrThrow(res, "Failed to load members");
}

export async function addMemberApi(member) {
  const res = await fetch(`${API_BASE_URL}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: member.name,
      roll_no: member.rollNo,
      department: member.department,
      year: member.year,
    }),
  });
  return parseFetchResponseOrThrow(res, "Failed to add member");
}

export async function removeMemberApi(rollNo) {
  const res = await fetch(`${API_BASE_URL}/members/${rollNo}`, {
    method: "DELETE"
  });
  return parseFetchResponseOrThrow(res, "Failed to remove member");
}

