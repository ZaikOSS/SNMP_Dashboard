
'use client';
import { useState, useEffect, useRef } from 'react';
import { Device, Connection, DeviceType } from '@/types';
import { Server, Router, HardDrive, Laptop, Smartphone, Link2, HelpCircle, ShieldQuestion, Computer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useNetwork } from '@/contexts/network-context';
import { AddConnectionDialog } from './add-connection-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const deviceIcons: Record<DeviceType, React.ReactNode> = {
  server: <Server className="h-8 w-8 text-primary" />,
  router: <Router className="h-8 w-8 text-primary" />,
  switch: <HardDrive className="h-8 w-8 text-primary" />,
  laptop: <Laptop className="h-8 w-8 text-primary" />,
  phone: <Smartphone className="h-8 w-8 text-primary" />,
  unknown: <HelpCircle className="h-8 w-8 text-primary" />,
  pc: <Computer className="h-8 w-8 text-primary" />,
  firewall: <ShieldQuestion className="h-8 w-8 text-primary" />
};

type Position = { x: number; y: number };

export function TopologyView() {
  const { user } = useAuth();
  const { devices, connections, addConnection, deleteConnection } = useNetwork();
  const [positions, setPositions] = useState<{ [key: string]: Position }>({});
  const [dragging, setDragging] = useState<number | null>(null);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize positions
    const initialPositions: { [key: string]: Position } = {};
    if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();

        devices.forEach((device) => {
          if (!positions[device.id]) {
            initialPositions[device.id] = {
                x: Math.random() * (width - 120),
                y: Math.random() * (height - 80),
            };
          }
        });
        if (Object.keys(initialPositions).length > 0) {
            setPositions(prev => ({ ...prev, ...initialPositions }));
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, containerRef.current]);

  const handleMouseDown = (e: React.MouseEvent, deviceId: number) => {
    if (user?.role !== 'admin') return;
    const pos = positions[deviceId];
    setDragging(deviceId);
    setOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging === null || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    let newX = e.clientX - offset.x;
    let newY = e.clientY - offset.y;

    // Constrain within the container
    newX = Math.max(0, Math.min(newX, containerRect.width - 120)); // 120 is device width
    newY = Math.max(0, Math.min(newY, containerRect.height - 80)); // 80 is device height

    setPositions((prev) => ({
      ...prev,
      [dragging]: { x: newX, y: newY },
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };
  
  const handleDeleteConnection = (connectionId: number) => {
    if (user?.role === 'admin') {
      deleteConnection(connectionId);
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <>
    <TooltipProvider>
    <Card 
      className="w-full h-[600px] relative overflow-hidden" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
       <div className="absolute top-4 right-4 z-10">
         <Button onClick={() => setIsAddConnectionOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Connection
         </Button>
        </div>
      {/* Render Connections as SVG lines */}
      <svg className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        {connections.map((conn) => {
          const pos1 = positions[conn.source_device_id];
          const pos2 = positions[conn.target_device_id];
          if (!pos1 || !pos2) return null;
          
          const sourceDevice = devices.find(d => d.id === conn.source_device_id);
          const targetDevice = devices.find(d => d.id === conn.target_device_id);
          const isOffline = sourceDevice?.status === 'offline' || targetDevice?.status === 'offline';
          
          const midX = (pos1.x + pos2.x) / 2 + 60;
          const midY = (pos1.y + pos2.y) / 2 + 40;

          return (
            <g key={conn.id} className="group/connection">
                <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                        <line
                        x1={pos1.x + 60}
                        y1={pos1.y + 40}
                        x2={pos2.x + 60}
                        y2={pos2.y + 40}
                        className={cn("stroke-[4] transition-all cursor-pointer", isOffline ? "stroke-red-500/50" : "stroke-green-500/80", "group-hover/connection:stroke-destructive")}
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => {
                           e.stopPropagation();
                        }}
                        />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <div className="flex items-center gap-2 text-sm">
                        <Link2 className="h-4 w-4" />
                        <div>
                            <p>{sourceDevice?.hostname} ({conn.source_interface})</p>
                            <p>{targetDevice?.hostname} ({conn.target_interface})</p>
                        </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
                 <foreignObject x={midX - 16} y={midY - 16} width="32" height="32" style={{pointerEvents: 'all'}}>
                    <button 
                        onClick={() => handleDeleteConnection(conn.id)}
                        className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/connection:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Delete connection"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                 </foreignObject>
            </g>
          );
        })}
      </svg>
      
      {/* Render Devices */}
      {devices.map((device) => {
        const pos = positions[device.id];
        if (!pos) return null;
        const isOnline = device.status === 'online';

        return (
          <div
            key={device.id}
            className={cn(
                "absolute w-[120px] p-2 rounded-lg text-center flex flex-col items-center justify-center gap-1",
                "bg-card border-2",
                isOnline ? 'border-green-500' : 'border-red-500',
                user?.role === 'admin' && 'cursor-grab',
                dragging === device.id && 'cursor-grabbing shadow-lg'
            )}
            style={{ left: pos.x, top: pos.y }}
            onMouseDown={(e) => handleMouseDown(e, device.id)}
          >
            {deviceIcons[device.deviceType]}
            <p className="text-xs font-bold truncate w-full">{device.hostname}</p>
          </div>
        );
      })}
    </Card>
    </TooltipProvider>
    <AddConnectionDialog
        isOpen={isAddConnectionOpen}
        onOpenChange={setIsAddConnectionOpen}
        devices={devices}
        connections={connections}
        onAddConnection={addConnection}
    />
    </>
  );
}
