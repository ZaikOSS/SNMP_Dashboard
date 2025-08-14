
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Device, DeviceType } from '@/types';
import { Server, Router, HardDrive, Laptop, Smartphone, Circle, HelpCircle, Computer, ShieldQuestion, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { DeleteDeviceDialog } from './delete-device-dialog';
import { useNetwork } from '@/contexts/network-context';

interface DeviceCardProps {
  device: Device;
}

const deviceIcons: Record<DeviceType, React.ReactNode> = {
  server: <Server className="h-6 w-6 text-muted-foreground" />,
  router: <Router className="h-6 w-6 text-muted-foreground" />,
  switch: <HardDrive className="h-6 w-6 text-muted-foreground" />,
  laptop: <Laptop className="h-6 w-6 text-muted-foreground" />,
  phone: <Smartphone className="h-6 w-6 text-muted-foreground" />,
  unknown: <HelpCircle className="h-6 w-6 text-muted-foreground" />,
  pc: <Computer className="h-6 w-6 text-muted-foreground" />,
  firewall: <ShieldQuestion className="h-6 w-6 text-muted-foreground" />,
};

export function DeviceCard({ device }: DeviceCardProps) {
  const isOnline = device.status === 'online';
  const { user } = useAuth();
  const { deleteDevice } = useNetwork();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent link navigation
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  }

  const confirmDelete = () => {
    deleteDevice(device.id);
    setIsDeleteDialogOpen(false);
  }

  return (
    <>
    <Link href={`/dashboard/devices/${device.id}`} className="block group/card relative">
      <Card className="hover:shadow-md hover:border-primary/50 transition-all duration-200 h-full">
        <CardHeader>
          <div className="flex justify-between items-start">
            {deviceIcons[device.deviceType]}
            <Badge variant={isOnline ? 'default' : 'destructive'} className={cn(!isOnline && 'bg-red-500 text-white', isOnline && 'bg-green-500 text-white')}>
              <Circle className={cn('mr-2 h-3 w-3', isOnline ? 'fill-green-400' : 'fill-red-400')} />
              {device.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="text-lg font-bold truncate">{device.hostname}</CardTitle>
          <CardDescription className="text-sm mt-2">{device.ip}</CardDescription>
          <p className="text-xs text-muted-foreground mt-1 truncate">{device.sysdescr}</p>
        </CardContent>
      </Card>
      {user?.role === 'admin' && (
          <Button 
            variant="destructive" 
            size="icon" 
            className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity"
            onClick={handleDeleteClick}
          >
              <Trash2 className="h-4 w-4" />
          </Button>
      )}
    </Link>
    {selectedDevice && (
        <DeleteDeviceDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            device={device}
            onConfirmDelete={confirmDelete}
        />
     )}
    </>
  );
}

// Helper to prevent dialog errors when card is unmounted
const selectedDevice = true;
