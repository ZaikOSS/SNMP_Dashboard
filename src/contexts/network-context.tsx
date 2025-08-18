"use client";

import {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext,
  useCallback,
} from "react";
import { Device, Connection, DeviceType, ConnectionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface NetworkContextType {
  devices: Device[];
  connections: Connection[];
  loading: boolean;
  addDevice: (device: Device) => void;
  deleteDevice: (deviceId: number) => void;
  addConnection: (connection: Omit<Connection, "id">) => void;
  deleteConnection: (connectionId: number) => void;
  refetchData: () => void;
}

export const NetworkContext = createContext<NetworkContextType | null>(null);

const assignDeviceType = (
  sysdescr: string | null,
  manualType?: DeviceType
): DeviceType => {
  if (
    manualType &&
    ["server", "router", "switch", "pc", "firewall"].includes(manualType)
  ) {
    return manualType;
  }
  if (!sysdescr) return "unknown";
  const lowerSysdescr = sysdescr.toLowerCase();
  if (lowerSysdescr.includes("cisco ios software")) return "router";
  if (lowerSysdescr.includes("switch")) return "switch";
  if (lowerSysdescr.includes("linux")) return "server";
  if (lowerSysdescr.includes("windows")) return "server";
  if (lowerSysdescr.includes("laptop")) return "laptop";
  if (lowerSysdescr.includes("phone")) return "phone";
  return "unknown";
};

const isDeviceOnline = (lastSeen: string): boolean => {
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen.replace(" ", "T") + "Z");
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  return now.getTime() - lastSeenDate.getTime() < fiveMinutes;
};

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchData = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }
      try {
        const [devicesData, connectionsData] = await Promise.all([
          api.getDevices(),
          api.getConnections(),
        ]);

        const processedDevices = devicesData.map((d) => ({
          ...d,
          status: isDeviceOnline(d.last_seen) ? "online" : "offline",
          deviceType: assignDeviceType(d.sysdescr, d.deviceType),
        }));

        setDevices(processedDevices);
        setConnections(connectionsData);
      } catch (error: any) {
        toast({
          title: "Error fetching network data",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [toast]
  );

  const triggerScan = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch the most current device list to scan
      const devicesToScan = await api.getDevices();

      const scanPromises = devicesToScan.map((device) =>
        user.role === "admin"
          ? api
              .scanDevice(device.ip)
              .catch((e) =>
                console.error(`Admin scan failed for ${device.ip}:`, e.message)
              )
          : api
              .refreshDevice(device.ip)
              .catch((e) =>
                console.error(
                  `Visitor refresh failed for ${device.ip}:`,
                  e.message
                )
              )
      );

      await Promise.allSettled(scanPromises);

      toast({
        title: "Network Refresh Complete",
        description: "Device statuses have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to start refresh",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      // After scanning, refetch the data from the database to update the UI
      await fetchData(false);
      setLoading(false);
    }
  }, [user, toast, fetchData]);

  useEffect(() => {
    if (user) {
      fetchData(true); // Initial load
      const interval = setInterval(() => {
        triggerScan(); // Periodic scan
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [user, fetchData, triggerScan]);

  const addDevice = () => {
    triggerScan(); // Trigger a new scan after adding a device to get its data
  };

  const deleteDevice = async (deviceId: number) => {
    const deviceToDelete = devices.find((d) => d.id === deviceId);
    if (!deviceToDelete) return;

    try {
      await api.deleteDevice(deviceId);
      await fetchData(true); // Refetch all data
      toast({
        title: "Device Deleted",
        description: `Device ${deviceToDelete.hostname} has been removed.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Delete Device",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addConnection = async (newConnection: Omit<Connection, "id">) => {
    try {
      const createdConnection = await api.createConnection(
        newConnection.source_device_id,
        newConnection.source_interface,
        newConnection.target_device_id,
        newConnection.target_interface,
        newConnection.type
      );
      setConnections((prev) => [
        ...prev,
        { ...createdConnection, ...newConnection },
      ]);
      toast({
        title: "Connection Added",
        description: "The new connection has been added to the topology.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Add Connection",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteConnection = async (connectionId: number) => {
    try {
      await api.deleteConnection(connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      toast({
        title: "Connection Removed",
        description: "The connection has been removed from the topology.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Remove Connection",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRefetch = () => {
    triggerScan();
  };

  return (
    <NetworkContext.Provider
      value={{
        devices,
        connections,
        loading,
        addDevice,
        deleteDevice,
        addConnection,
        deleteConnection,
        refetchData: handleRefetch,
      }}
    >
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
};
