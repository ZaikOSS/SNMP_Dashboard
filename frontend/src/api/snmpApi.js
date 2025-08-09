const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:1999/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `HTTP error! status: ${response.status}`,
      response.status
    );
  }
  return response.json();
};

export const getDevices = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/devices`);
    return await handleResponse(response);
  } catch (error) {
    console.error("Error fetching devices:", error);
    throw error;
  }
};

export const getCurrentData = async (deviceId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/current`);
    return await handleResponse(response);
  } catch (error) {
    console.error("Error fetching current data:", error);
    throw error;
  }
};

export const getHistoricalData = async (deviceId, hours = 24, type = "cpu") => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/devices/${deviceId}/history?hours=${hours}&type=${type}`
    );
    return await handleResponse(response);
  } catch (error) {
    console.error("Error fetching historical data:", error);
    throw error;
  }
};

export const addDevice = async (deviceData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deviceData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("Error adding device:", error);
    throw error;
  }
};

export const removeDevice = async (deviceId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
      method: "DELETE",
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("Error removing device:", error);
    throw error;
  }
};

export const getHealthStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await handleResponse(response);
  } catch (error) {
    console.error("Error fetching health status:", error);
    throw error;
  }
};
