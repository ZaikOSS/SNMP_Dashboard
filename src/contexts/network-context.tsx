
"use client";

import { createContext, useState, useEffect, ReactNode, useContext, useCallback } from "react";
import { Device, Connection, DeviceType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface NetworkContextType {
  devices: Device[];
  connections: Connection[];
  loading: boolean;
  addDevice: (device: Device) => void;
  deleteDevice: (deviceId: number) => void;
  addConnection: (connection: Omit<Connection, 'id'>) => void;
  deleteConnection: (connectionId: number) => void;
  refetchData: () => void;
}

export const NetworkContext = createContext<NetworkContextType | null>(null);

const assignDeviceType = (sysdescr: string, manualType?: DeviceType): DeviceType => {
    if (manualType && ['server', 'router', 'switch', 'pc', 'firewall'].includes(manualType)) {
        return manualType;
    }
    const lowerSysdescr = sysdescr.toLowerCase();
    if (lowerSysdescr.includes('cisco ios software')) return 'router';
    if (lowerSysdescr.includes('switch')) return 'switch';
    if (lowerSysdescr.includes('linux')) return 'server';
    if (lowerSysdescr.includes('windows')) return 'server';
    if (lowerSysdescr.includes('laptop')) return 'laptop';
    if (lowerSysdescr.includes('phone')) return 'phone';
    return 'unknown';
}

const isDeviceOnline = (lastSeen: string): boolean => {
    if (!lastSeen) return false;
    // Assuming API provides UTC time. Compare with current UTC time.
    const lastSeenDate = new Date(lastSeen + 'Z');
    const now = new Date();
    // If last seen within the last 5 minutes, consider it online.
    const fiveMinutes = 5 * 60 * 1000;
    return (now.getTime() - lastSeenDate.getTime()) < fiveMinutes;
};


export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (!user) return;
    if (isInitialLoad) {
        setLoading(true);
    }
    
    try {
        // First, get the current list of devices from our DB
        const devicesData = await api.getDevices();
        
        // Then, trigger an SNMP poll for each device to update it.
        // We can run these in parallel.
        await Promise.all(devicesData.map(device => 
            api.scanDevice(device.ip).catch(e => {
                // Don't let a single failed scan stop the whole refresh
                console.error(`Failed to scan device ${device.ip}:`, e);
            })
        ));

        // After all scans are triggered, fetch the updated data from the DB
        const [updatedDevicesData, connectionsData] = await Promise.all([
            api.getDevices(),
            user.role === 'admin' ? api.getConnections() : Promise.resolve([])
        ]);
        
        const processedDevices = updatedDevicesData.map(d => ({
            ...d,
            status: isDeviceOnline(d.last_seen) ? 'online' : 'offline',
            deviceType: assignDeviceType(d.sysdescr, d.deviceType),
        }));

        setDevices(processedDevices);
        if (user.role === 'admin') {
          setConnections(connectionsData);
        }

    } catch (error: any) {
        // Only show toast on initial load to avoid spamming
        if (isInitialLoad) {
            toast({ title: "Error fetching network data", description: error.message, variant: "destructive" });
        }
        console.error("Error during network data fetch:", error);
    } finally {
        if (isInitialLoad) {
            setLoading(false);
        }
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
        fetchData(true); // Initial fetch
        const interval = setInterval(() => {
            fetchData(false); // Subsequent background fetches
        }, 30000); 
        return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  const addDevice = (newDevice: Device) => {
    const processedDevice = {
        ...newDevice,
        status: isDeviceOnline(newDevice.last_seen) ? 'online' : 'offline',
        deviceType: newDevice.deviceType,
    };
    setDevices(prev => [...prev.filter(d => d.id !== processedDevice.id), processedDevice]);
  };

  const deleteDevice = async (deviceId: number) => {
    const deviceToDelete = devices.find(d => d.id === deviceId);
    if (!deviceToDelete) return;

    try {
        await api.deleteDevice(deviceId);
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        toast({
            title: "Device Deleted",
            description: `Device ${deviceToDelete.hostname} has been removed.`,
        });
    } catch (error: any) {
        toast({ title: "Failed to Delete Device", description: error.message, variant: "destructive" });
    }
  };

  const addConnection = async (newConnection: Omit<Connection, 'id'>) => {
    try {
        const createdConnection = await api.createConnection(newConnection.source_device_id, newConnection.source_interface, newConnection.target_device_id, newConnection.target_interface);
        setConnections(prev => [...prev, { ...createdConnection, ...newConnection }]);
        toast({
            title: 'Connection Added',
            description: 'The new connection has been added to the topology.',
        });
    } catch (error: any) {
        toast({ title: 'Failed to Add Connection', description: error.message, variant: 'destructive'});
    }
  };

  const deleteConnection = async (connectionId: number) => {
    try {
        await api.deleteConnection(connectionId);
        setConnections(prev => prev.filter(c => c.id !== connectionId));
        toast({
            title: 'Connection Removed',
            description: 'The connection has been removed from the topology.',
        });
    } catch (error: any) {
        toast({ title: 'Failed to Remove Connection', description: error.message, variant: 'destructive'});
    }
  }

  return (
    <NetworkContext.Provider value={{ devices, connections, loading, addDevice, deleteDevice, addConnection, deleteConnection, refetchData: () => fetchData(true) }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
}
