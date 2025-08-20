"use client";
import { useState, useEffect, useRef } from "react";
import { Device, Connection, DeviceType, ConnectionType } from "@/types";
import {
  Server,
  Router,
  HardDrive,
  Laptop,
  Smartphone,
  Link2,
  HelpCircle,
  ShieldQuestion,
  Computer,
  Wifi,
  Zap as FiberIcon,
  ZoomIn,
  ZoomOut,
  Move,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "../ui/button";
import { PlusCircle, Trash2 } from "lucide-react";
import { useNetwork } from "@/contexts/network-context";
import { AddConnectionDialog } from "./add-connection-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const deviceIcons: Record<DeviceType, React.ReactNode> = {
  server: <Server className="h-6 w-6 text-primary" />,
  router: <Router className="h-6 w-6 text-primary" />,
  switch: <HardDrive className="h-6 w-6 text-primary" />,
  laptop: <Laptop className="h-6 w-6 text-primary" />,
  phone: <Smartphone className="h-6 w-6 text-primary" />,
  unknown: <HelpCircle className="h-6 w-6 text-primary" />,
  pc: <Computer className="h-6 w-6 text-primary" />,
  firewall: <ShieldQuestion className="h-6 w-6 text-primary" />,
};

const connectionLineStyle: Record<ConnectionType, string> = {
  ethernet: "stroke-green-500/80",
  wifi: "stroke-blue-500/80 stroke-dasharray-5",
  fiber: "stroke-purple-500/80",
  virtual: "stroke-gray-500/80 stroke-dasharray-2",
};

const connectionIcons: Record<ConnectionType, React.ReactNode> = {
  ethernet: <Link2 className="h-4 w-4" />,
  wifi: <Wifi className="h-4 w-4" />,
  fiber: <FiberIcon className="h-4 w-4" />,
  virtual: <Link2 className="h-4 w-4" />,
};

type Position = { x: number; y: number };

export function TopologyView() {
  const { user } = useAuth();
  const { devices, connections, addConnection, deleteConnection } =
    useNetwork();
  const [positions, setPositions] = useState<{ [key: string]: Position }>({});
  const [dragging, setDragging] = useState<number | null>(null);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);

  const [scale, setScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canManageTopology = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    const initialPositions: { [key: string]: Position } = {};
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      devices.forEach((device) => {
        if (!positions[device.id]) {
          initialPositions[device.id] = {
            x: Math.random() * (width - 150),
            y: Math.random() * (height - 100),
          };
        }
      });
      if (Object.keys(initialPositions).length > 0) {
        setPositions((prev) => ({ ...prev, ...initialPositions }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, containerRef.current]);

  const handleMouseDown = (e: React.MouseEvent, deviceId?: number) => {
    if (deviceId) {
      if (!canManageTopology) return;
      setDragging(deviceId);
      const pos = positions[deviceId];
      setOffset({
        x: e.clientX - pos.x * scale - viewOffset.x,
        y: e.clientY - pos.y * scale - viewOffset.y,
      });
    } else {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - viewOffset.x,
        y: e.clientY - viewOffset.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging !== null && containerRef.current && canManageTopology) {
      const containerRect = containerRef.current.getBoundingClientRect();
      let newX = (e.clientX - offset.x - viewOffset.x) / scale;
      let newY = (e.clientY - offset.y - viewOffset.y) / scale;

      setPositions((prev) => ({
        ...prev,
        [dragging]: { x: newX, y: newY },
      }));
    } else if (isPanning) {
      setViewOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleDeleteConnection = (connectionId: number) => {
    if (canManageTopology) {
      deleteConnection(connectionId);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Card
          className="w-full h-[700px] relative overflow-hidden select-none"
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={(e) => handleMouseDown(e)}
        >
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setScale((s) => Math.min(s + 0.1, 2))}
            >
              <ZoomIn />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setScale((s) => Math.max(s - 0.1, 0.3))}
            >
              <ZoomOut />
            </Button>
            {canManageTopology && (
              <Button onClick={() => setIsAddConnectionOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Connection
              </Button>
            )}
          </div>
          <div
            className="w-full h-full"
            style={{
              transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${scale})`,
              cursor: isPanning ? "grabbing" : "grab",
            }}
          >
            <svg
              className="absolute top-0 left-0 w-full h-full"
              style={{ pointerEvents: "none" }}
            >
              {connections.map((conn) => {
                const pos1 = positions[conn.source_device_id];
                const pos2 = positions[conn.target_device_id];
                if (!pos1 || !pos2) return null;

                const sourceDevice = devices.find(
                  (d) => d.id === conn.source_device_id
                );
                const targetDevice = devices.find(
                  (d) => d.id === conn.target_device_id
                );
                const isOffline =
                  sourceDevice?.status === "offline" ||
                  targetDevice?.status === "offline";

                const midX = (pos1.x + pos2.x) / 2 + 75;
                const midY = (pos1.y + pos2.y) / 2 + 50;

                return (
                  <g
                    key={conn.id}
                    className={cn(canManageTopology && "group/connection")}
                  >
                    <line
                      x1={pos1.x + 75}
                      y1={pos1.y + 50}
                      x2={pos2.x + 75}
                      y2={pos2.y + 50}
                      className={cn(
                        "stroke-[4] transition-all",
                        isOffline
                          ? "stroke-red-500/50"
                          : connectionLineStyle[conn.type] ||
                              "stroke-green-500/80",
                        canManageTopology &&
                          "group-hover/connection:stroke-destructive"
                      )}
                      style={{ pointerEvents: "auto" }}
                    />
                    <foreignObject
                      x={midX - 100}
                      y={midY - 30}
                      width="200"
                      height="60"
                      style={{ pointerEvents: "all" }}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className={cn(
                            "text-center bg-card/80 backdrop-blur-sm p-1 rounded-md text-xs transition-opacity",
                            canManageTopology &&
                              "group-hover/connection:opacity-0 opacity-100"
                          )}
                        >
                          <div className="font-bold capitalize flex items-center gap-1 justify-center">
                            {connectionIcons[conn.type]} {conn.type}
                          </div>
                          <div>
                            {conn.source_interface} &harr;{" "}
                            {conn.target_interface}
                          </div>
                        </div>
                        {canManageTopology && (
                          <button
                            onClick={() => handleDeleteConnection(conn.id)}
                            className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/connection:opacity-100 transition-opacity cursor-pointer absolute"
                            aria-label="Delete connection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {devices.map((device) => {
              const pos = positions[device.id];
              if (!pos) return null;
              const isOnline = device.status === "online";

              return (
                <div
                  key={device.id}
                  className={cn(
                    "absolute w-[150px] p-2 rounded-lg text-center flex flex-col items-center justify-center gap-1",
                    "bg-card border-2 shadow-lg",
                    canManageTopology ? "cursor-grab" : "cursor-default",
                    isOnline ? "border-green-500" : "border-red-500",
                    dragging === device.id && "cursor-grabbing z-10"
                  )}
                  style={{ left: pos.x, top: pos.y, pointerEvents: "all" }}
                  onMouseDown={(e) => handleMouseDown(e, device.id)}
                >
                  {deviceIcons[device.deviceType]}
                  <p className="text-sm font-bold truncate w-full">
                    {device.hostname}
                  </p>
                  <p className="text-xs text-muted-foreground truncate w-full">
                    {device.ip}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </TooltipProvider>
      {canManageTopology && (
        <AddConnectionDialog
          isOpen={isAddConnectionOpen}
          onOpenChange={setIsAddConnectionOpen}
          devices={devices}
          connections={connections}
          onAddConnection={addConnection}
        />
      )}
    </>
  );
}
