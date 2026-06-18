const API_URL = import.meta.env.VITE_API_URL || "/crm-api";
const TOKEN_KEY = "northstar_crm_token";
const REFRESH_TOKEN_KEY = "northstar_crm_refresh_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setSession(token: string | null, refreshToken?: string | null) {
  setToken(token);
  if (!token) setRefreshToken(null);
  else if (refreshToken !== undefined) setRefreshToken(refreshToken);
}

async function parseError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error || `Request failed (${response.status})`);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  let response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const refreshToken = getRefreshToken();
  const canRefresh = response.status === 401 && refreshToken && path !== "/auth/refresh";
  if (canRefresh) {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json() as { token: string; refreshToken: string };
      setSession(refreshed.token, refreshed.refreshToken);
      headers.set("authorization", `Bearer ${refreshed.token}`);
      response = await fetch(`${API_URL}${path}`, { ...init, headers });
    } else {
      setSession(null);
    }
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function publicApi<T>(
  path: string,
  init: RequestInit = {},
  bearerToken = ""
): Promise<T> {
  const headers = new Headers(init.headers);
  if (bearerToken) headers.set("authorization", `Bearer ${bearerToken}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadCsv(path: string, filename: string) {
  const response = await fetch(`${API_URL}${path}`, { headers: { authorization: `Bearer ${getToken() || ""}` } });
  if (!response.ok) throw new Error("Export failed");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function downloadFile(path: string, filename: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${getToken() || ""}` }
  });
  if (!response.ok) throw new Error("Download failed");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
