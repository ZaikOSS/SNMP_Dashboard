import { UserManagement } from "@/components/dashboard/user-management";

export default function UsersPage() {
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">User Management</h1>
        <p className="text-muted-foreground mb-6">View and manage all users.</p>
        <UserManagement />
    </div>
  );
}
