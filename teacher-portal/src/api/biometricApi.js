import { api } from "./client";

export async function registerBiometricVector(payload) {
  const res = await api.post("/biometric/register", payload);
  return res.data;
}

export async function getBiometricVectors() {
  const res = await api.get("/biometric/vectors");
  return res.data;
}

export async function scanBiometric(payload) {
  const res = await api.post("/biometric/scan", payload);
  return res.data;
}
