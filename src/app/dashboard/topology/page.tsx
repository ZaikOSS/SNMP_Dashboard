import { TopologyView } from "@/components/dashboard/topology-view";

export default function TopologyPage() {
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Network Topology</h1>
        <p className="text-muted-foreground mb-6">A visualization of your network devices and connections.</p>
        <TopologyView />
    </div>
  );
}
