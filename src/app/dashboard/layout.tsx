
'use client';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { NetworkProvider } from '@/contexts/network-context';
import { AuthGuard } from '@/components/auth/auth-guard';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <AuthGuard>
      <NetworkProvider>
        <SidebarProvider>
          <Sidebar>
            <DashboardSidebar />
          </Sidebar>
          <SidebarInset>
            <div className="flex min-h-screen w-full flex-col">
              <DashboardHeader />
              <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </NetworkProvider>
    </AuthGuard>
  );
}
