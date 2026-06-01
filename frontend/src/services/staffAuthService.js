import { staffHttp } from "./staffHttp";

export async function login(payload) {
  const { data } = await staffHttp.post("/api/staff/auth/login", payload);
  return data;
}

export async function logout() {
  const { data } = await staffHttp.post("/api/staff/auth/logout", {});
  return data;
}

export async function me() {
  const { data } = await staffHttp.get("/api/staff/auth/me");
  return data;
}

// Alias for consistency
export const getMe = me;
