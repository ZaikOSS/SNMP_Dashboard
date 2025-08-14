import { DeviceList } from "@/components/dashboard/device-list";

export default function DashboardPage() {
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-6">An overview of your network devices.</p>
        <DeviceList />
    </div>
  );
}
