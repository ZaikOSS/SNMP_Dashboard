
import { User, Device, Connection, DeviceHistory } from "@/types";

const API_BASE_URL = "http://localhost:1999";

async function fetchWrapper(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    
    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'An error occurred');
    }

    // Special case for blob responses for file downloads
    if (options.method === 'GET_BLOB') {
       return response;
    }
    
    if (response.headers.get("Content-Type")?.includes("application/json")) {
        return response.json();
    }
    
    return response;
}

// Auth
export const login = (username: string, password: string): Promise<{ access_token: string }> => 
    fetchWrapper('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });

export const register = (username: string, password: string, role: 'admin' | 'visitor' = 'visitor'): Promise<{ message: string }> => 
    fetchWrapper('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
    });

// Users
export const getUsers = (): Promise<User[]> => fetchWrapper('/users');
export const deleteUser = (id: number): Promise<{ message: string }> => 
    fetchWrapper(`/users/${id}`, { method: 'DELETE' });
export const updateUser = (id: number, username: string, role: 'admin' | 'visitor'): Promise<{ message: string }> =>
    fetchWrapper(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ username, role }),
    });


// Devices & SNMP
export const getDevices = (): Promise<Device[]> => fetchWrapper('/devices');
export const getDeviceHistory = (ip: string): Promise<DeviceHistory[]> => fetchWrapper(`/history/${ip}`);
export const scanDevice = (ip: string): Promise<{ status: string; data: Device }> => {
    // Using hardcoded credentials as requested.
    const body = {
        ip,
        user: "zaikos",
        auth_key: "zaikos123456",
        priv_key: "zaikos123456",
    };
    return fetchWrapper('/snmp', { method: 'POST', body: JSON.stringify(body) });
}
export const deleteDevice = (id: number): Promise<{ message: string }> =>
    fetchWrapper(`/devices/${id}`, { method: 'DELETE' });


// Connections
export const getConnections = (): Promise<Connection[]> => fetchWrapper('/connections');
export const createConnection = (
    source_device_id: number, 
    source_interface: string, 
    target_device_id: number, 
    target_interface: string
): Promise<{ id: number; message: string }> =>
    fetchWrapper('/connections', {
        method: 'POST',
        body: JSON.stringify({ source_device_id, source_interface, target_device_id, target_interface }),
    });

export const deleteConnection = (id: number): Promise<{ message: string }> =>
    fetchWrapper(`/connections/${id}`, { method: 'DELETE' });

// Export
export const getExportJson = async (): Promise<Blob> => {
    const response = await fetchWrapper('/export/json', { method: 'GET_BLOB' }) as Response;
    return response.blob();
};
export const getExportCsv = async (): Promise<Blob> => {
    const response = await fetchWrapper('/export/csv', { method: 'GET_BLOB'}) as Response;
    return response.blob();
};
