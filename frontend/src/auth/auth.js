import { http } from "../api/http";

export function saveAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("authChanged"));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getStoredUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export async function login(email, password) {
  const res = await http.post("/auth/login", { email, password });
  const { token, user } = res.data;
  saveAuth(token, user);
  return user;
}

export async function register(payload) {
  const res = await http.post("/auth/register", payload);
  const { token, user } = res.data;
  saveAuth(token, user);
  return user;
}
