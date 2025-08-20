"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Eye,
  Users,
  Share2,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";

export function DashboardSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const menuItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard />,
      adminOnly: false,
    },
    {
      href: "/dashboard/topology",
      label: "Topology",
      icon: <Share2 />,
      adminOnly: false,
    },
    {
      href: "/dashboard/users",
      label: "Users",
      icon: <Users />,
      adminOnly: true,
    },
    {
      href: "/dashboard/feedback",
      label: "Feedback",
      icon: <MessageSquare />,
      adminOnly: false,
    },
  ];

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Network Observer</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => {
            if (item.adminOnly && user?.role !== "admin") {
              return null;
            }
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
