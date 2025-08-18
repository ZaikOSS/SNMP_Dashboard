import {
  User,
  Device,
  Connection,
  DeviceHistory,
  DeviceType,
  ConnectionType,
  Feedback,
} from "@/types";

const API_BASE_URL = "http://localhost:1999";

async function fetchWrapper(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "An error occurred");
  }

  // Special case for blob responses for file downloads
  const contentType = response.headers.get("Content-Type");
  if (
    contentType &&
    (contentType.includes("application/json") ||
      contentType.includes("text/csv")) &&
    options.method === "GET"
  ) {
    try {
      const blob = await response.clone().blob();
      if (
        blob.type.includes("application/json") ||
        blob.type.includes("text/csv")
      ) {
        return blob;
      }
    } catch (e) {
      // Fallback to json if blob fails
      return response.json();
    }
  }

  if (response.headers.get("Content-Type")?.includes("application/json")) {
    return response.json();
  }

  return response;
}

// Auth
export const login = (
  username: string,
  password: string
): Promise<{ access_token: string }> =>
  fetchWrapper("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const register = (
  username: string,
  password: string,
  role: "admin" | "visitor" = "visitor"
): Promise<{ message: string }> =>
  fetchWrapper("/register", {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  });

// Users
export const getUsers = (): Promise<User[]> => fetchWrapper("/users");
export const deleteUser = (id: number): Promise<{ message: string }> =>
  fetchWrapper(`/users/${id}`, { method: "DELETE" });
export const updateUser = (
  id: number,
  username: string,
  role: "admin" | "visitor"
): Promise<{ message: string }> =>
  fetchWrapper(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ username, role }),
  });

// Devices & SNMP
export const getDevices = (): Promise<Device[]> => fetchWrapper("/devices");
export const getDeviceHistory = (ip: string): Promise<DeviceHistory[]> =>
  fetchWrapper(`/history/detailed/${ip}`);

// Admin-only full scan
export const scanDevice = (
  ip: string,
  deviceType?: DeviceType
): Promise<{ status: string; data: Device }> => {
  // Using hardcoded credentials as requested.
  const body: {
    ip: string;
    user: string;
    auth_key: string;
    priv_key: string;
    deviceType?: DeviceType;
  } = {
    ip,
    user: "zaikos",
    auth_key: "zaikos123456",
    priv_key: "zaikos123456",
  };
  if (deviceType) {
    body.deviceType = deviceType;
  }
  return fetchWrapper("/snmp", { method: "POST", body: JSON.stringify(body) });
};

// Visitor-accessible single device refresh
export const refreshDevice = (
  ip: string
): Promise<{ status: string; data: Device }> => {
  return fetchWrapper("/refresh/device", {
    method: "POST",
    body: JSON.stringify({ ip: ip }),
  });
};

export const deleteDevice = (id: number): Promise<{ message: string }> =>
  fetchWrapper(`/devices/${id}`, { method: "DELETE" });

// Connections
export const getConnections = (): Promise<Connection[]> =>
  fetchWrapper("/connections/view");
export const createConnection = (
  source_device_id: number,
  source_interface: string,
  target_device_id: number,
  target_interface: string,
  type: ConnectionType
): Promise<{ id: number; message: string }> =>
  fetchWrapper("/connections", {
    method: "POST",
    body: JSON.stringify({
      source_device_id,
      source_interface,
      target_device_id,
      target_interface,
      type,
    }),
  });

export const deleteConnection = (id: number): Promise<{ message: string }> =>
  fetchWrapper(`/connections/${id}`, { method: "DELETE" });

// Export
export const getExportJson = (): Promise<Blob> =>
  fetchWrapper("/export/json", { method: "GET" });
export const getExportCsv = (): Promise<Blob> =>
  fetchWrapper("/export/csv", { method: "GET" });

// Feedback
export const createFeedback = (
  problem: string,
  troubleshooting?: string,
  solution?: string
): Promise<{ id: number; message: string }> =>
  fetchWrapper("/feedback", {
    method: "POST",
    body: JSON.stringify({ problem, troubleshooting, solution }),
  });

export const getFeedback = (): Promise<Feedback[]> =>
  fetchWrapper("/feedback/view");

export const deleteFeedback = (id: number): Promise<{ message: string }> =>
  fetchWrapper(`/feedback/${id}`, { method: "DELETE" });
