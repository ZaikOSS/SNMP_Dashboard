"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Device, DeviceMetrics, DeviceType, DeviceHistory } from "@/types";
import { useNetwork } from "@/contexts/network-context";
import * as api from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Server,
  Router as RouterIcon,
  HardDrive,
  Laptop,
  Smartphone,
  Circle,
  ArrowDown,
  ArrowUp,
  Zap,
  HelpCircle,
  Computer,
  ShieldQuestion,
  Cpu,
  MemoryStick,
  Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { useToast } from "@/hooks/use-toast";

const deviceIcons: Record<DeviceType, React.ReactNode> = {
  server: <Server className="h-8 w-8 text-primary" />,
  router: <RouterIcon className="h-8 w-8 text-primary" />,
  switch: <HardDrive className="h-8 w-8 text-primary" />,
  laptop: <Laptop className="h-8 w-8 text-primary" />,
  phone: <Smartphone className="h-8 w-8 text-primary" />,
  unknown: <HelpCircle className="h-8 w-8 text-primary" />,
  pc: <Computer className="h-8 w-8 text-primary" />,
  firewall: <ShieldQuestion className="h-8 w-8 text-primary" />,
};

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { devices, loading: networkLoading } = useNetwork();
  const { toast } = useToast();
  const id = Number(params.id);

  const [device, setDevice] = useState<Device | null>(null);
  const [metrics, setMetrics] = useState<DeviceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(
    async (ip: string) => {
      try {
        const historyData = await api.getDeviceHistory(ip);
        const metricsData = formatHistoryForChart(historyData);
        setMetrics(metricsData);
      } catch (error: any) {
        // Only show toast on initial load, not on background refresh
        if (metrics.length === 0) {
          toast({
            title: "Failed to fetch history",
            description: error.message,
            variant: "destructive",
          });
        }
        console.error("Failed to fetch history:", error);
      }
    },
    [toast, metrics.length]
  );

  useEffect(() => {
    const foundDevice = devices.find((d) => d.id === id);
    if (foundDevice) {
      setDevice(foundDevice);
      fetchHistory(foundDevice.ip).finally(() => setLoading(false));
    } else if (!networkLoading) {
      setLoading(false);
    }
  }, [id, devices, networkLoading, fetchHistory]);

  useEffect(() => {
    if (!device) return;

    // Set up an interval to refetch history data every 30 seconds
    const interval = setInterval(() => {
      fetchHistory(device.ip);
    }, 30000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [device, fetchHistory]);

  const formatHistoryForChart = (
    historyData: DeviceHistory[]
  ): DeviceMetrics[] => {
    if (!historyData || historyData.length === 0) return [];

    // API returns newest first, so we reverse to get chronological order for the chart
    const sortedHistory = [...historyData].reverse();

    return sortedHistory
      .map((record) => ({
        timestamp: new Date(record.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        dataIn: record.in_throughput_kbps ?? 0,
        dataOut: record.out_throughput_kbps ?? 0,
      }))
      .filter((m) => m.dataIn >= 0 && m.dataOut >= 0);
  };

  if (loading || networkLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Device not found</h2>
        <p className="text-muted-foreground">
          The device you are looking for does not exist.
        </p>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const isOnline = device.status === "online";

  const formatUptime = (uptimeTicks: string): string => {
    const ticks = parseInt(uptimeTicks, 10);
    if (isNaN(ticks)) return "N/A";
    const seconds = Math.floor(ticks / 100);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytesStr: string): string => {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatMilliwatts = (mwStr?: string): string => {
    if (!mwStr) return "N/A";
    const mw = parseInt(mwStr, 10);
    if (isNaN(mw)) return "N/A";
    return `${(mw / 1000).toFixed(2)} W`;
  };

  const getPowerSupplyBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes("critical"))
      return <Badge variant="destructive">Critical</Badge>;
    if (lowerStatus.includes("warning"))
      return <Badge className="bg-yellow-500 text-white">Warning</Badge>;
    if (lowerStatus.includes("normal"))
      return <Badge className="bg-green-500 text-white">Normal</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {deviceIcons[device.deviceType]}
            <div>
              <CardTitle className="text-3xl font-bold">
                {device.hostname}
              </CardTitle>
              <CardDescription className="text-base">
                {device.ip}
              </CardDescription>
            </div>
            <Badge
              variant={isOnline ? "default" : "destructive"}
              className={cn(
                "ml-auto",
                !isOnline && "bg-red-500 text-white",
                isOnline && "bg-green-500 text-white"
              )}
            >
              <Circle
                className={cn(
                  "mr-2 h-3 w-3",
                  isOnline ? "fill-green-400" : "fill-red-400"
                )}
              />
              {device.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold">System Description:</span>{" "}
              {device.sysdescr}
            </div>
            <div>
              <span className="font-semibold">Uptime:</span>{" "}
              {formatUptime(device.sysuptime)}
            </div>
            <div>
              <span className="font-semibold">Last Seen:</span>{" "}
              {new Date(device.last_seen).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Real-time device health metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">CPU Utilization</span>
                </div>
                <span className="font-semibold">
                  {device.cpu_utilization ?? "N/A"}%
                </span>
              </div>
              <Progress value={device.cpu_utilization ?? 0} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">RAM Utilization</span>
                </div>
                <span className="font-semibold">
                  {device.ram_utilization ?? "N/A"}%
                </span>
              </div>
              <Progress value={device.ram_utilization ?? 0} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Power Supply</span>
              </div>
              {getPowerSupplyBadge(device.power_supply_status)}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data Throughput</CardTitle>
            <CardDescription>Real-time network traffic (KB/s).</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricsChart data={metrics} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interface Details</CardTitle>
          <CardDescription>
            Real-time port status and traffic data from the device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Port</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4" /> PoE
                  </div>
                </TableHead>
                <TableHead className="text-right">Traffic In</TableHead>
                <TableHead className="text-right">Traffic Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {device.interfaces.map((port) => (
                <TableRow key={port.ifDescr}>
                  <TableCell className="font-medium">{port.ifDescr}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        port.ifOperStatus === "1" ? "default" : "destructive"
                      }
                      className={cn(
                        port.ifOperStatus !== "1" && "bg-red-500 text-white",
                        port.ifOperStatus === "1" && "bg-green-500 text-white"
                      )}
                    >
                      {port.ifOperStatus === "1" ? "Up" : "Down"}
                    </Badge>
                  </TableCell>
                  <TableCell>{port.ifPhysAddress || "N/A"}</TableCell>
                  <TableCell>
                    {formatMilliwatts(port.pethPsePortPower)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ArrowDown className="text-green-500" />
                      {formatBytes(port.ifInOctets)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ArrowUp className="text-blue-500" />
                      {formatBytes(port.ifOutOctets)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
