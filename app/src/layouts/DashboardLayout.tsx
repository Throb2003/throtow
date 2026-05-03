import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  Car,
  CreditCard,
  Gauge,
  Headphones,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listNotifications, markNotificationRead } from "@/services/supabaseData";
import type { NotificationRecord } from "@/types/app";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  headerAction?: ReactNode;
  [key: string]: unknown;
}

type LayoutNotification = NotificationRecord & {
  isRead?: boolean | null;
  read?: boolean | null;
  link?: string | null;
};

const navigationConfig = {
  customer: [
    { label: "Overview", href: "/customer", icon: LayoutDashboard },
    { label: "Requests", href: "/customer/requests", icon: Briefcase },
    { label: "Payments", href: "/customer/payments", icon: CreditCard },
    { label: "Support", href: "/customer/support", icon: Headphones },
  ],
  driver: [
    { label: "Overview", href: "/driver", icon: LayoutDashboard },
    { label: "Available Jobs", href: "/driver/jobs", icon: Briefcase },
    { label: "My Jobs", href: "/driver/my-jobs", icon: Car },
    { label: "Earnings", href: "/driver/earnings", icon: CreditCard },
    { label: "Support", href: "/driver/support", icon: Headphones },
  ],
  mechanic: [
    { label: "Overview", href: "/mechanic", icon: LayoutDashboard },
    { label: "Available Jobs", href: "/mechanic/jobs", icon: Briefcase },
    { label: "My Jobs", href: "/mechanic/my-jobs", icon: Wrench },
    { label: "Earnings", href: "/mechanic/earnings", icon: CreditCard },
    { label: "Support", href: "/mechanic/support", icon: Headphones },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: ShieldCheck },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Requests", href: "/admin/requests", icon: Briefcase },
    { label: "Payments", href: "/admin/payments", icon: CreditCard },
    { label: "Analytics", href: "/admin/analytics", icon: Gauge },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
} as const;

function getNotificationReadState(notification: LayoutNotification) {
  return Boolean(notification.isRead ?? notification.read);
}

function formatNotificationTime(value?: string | null) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString();
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
  headerAction,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<LayoutNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      if (!user?.id) {
        setNotifications([]);
        return;
      }

      setNotificationsLoading(true);

      try {
        const data = await listNotifications(user.id);

        if (isMounted) {
          setNotifications(data as LayoutNotification[]);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load notifications", error);
          setNotifications([]);
        }
      } finally {
        if (isMounted) {
          setNotificationsLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const navigationItems = useMemo(() => {
    if (!user?.role) {
      return [];
    }

    return navigationConfig[user.role] ?? [];
  }, [user?.role]);

  const unreadNotifications = notifications.filter(
    (notification) => !getNotificationReadState(notification)
  );
  const unreadCount = unreadNotifications.length;

  const handleNotificationClick = async (notification: LayoutNotification) => {
    if (!getNotificationReadState(notification)) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            currentNotification.id === notification.id
              ? { ...currentNotification, isRead: true, read: true }
              : currentNotification
          )
        );
      } catch (error) {
        console.error("Failed to mark notification as read", error);
      }
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const userInitials = (user?.fullName ?? user?.email ?? "U")
    .split(" ")
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-72 border-r border-slate-800/80 bg-slate-900/80 px-6 py-8 backdrop-blur md:flex md:flex-col">
          <div className="mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
              Tow & Rescue
            </div>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
          </div>

          <nav className="flex-1 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.href ||
                (item.href !== `/${user?.role}` && location.pathname.startsWith(item.href));

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
            <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl || undefined}
                      alt={user?.fullName ?? user?.email ?? "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-amber-500 text-slate-950">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.fullName}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2">
                <UserCog className="h-3.5 w-3.5" />
                {user?.role?.toUpperCase()}
              </span>
              {typeof user?.isOnline === "boolean" ? (
                <Badge
                  className={
                    user.isOnline
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-800 text-slate-300"
                  }
                >
                  {user.isOnline ? "Online" : "Offline"}
                </Badge>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500 md:hidden">
                  Tow & Rescue
                </div>
                <h2 className="text-2xl font-semibold text-white">{title}</h2>
                {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                {actions ?? headerAction}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="relative border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-96 border-slate-800 bg-slate-950 text-slate-100"
                  >
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Notifications</span>
                      {unreadCount > 0 ? (
                        <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-300">
                          {unreadCount} unread
                        </Badge>
                      ) : null}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    {notificationsLoading ? (
                      <div className="px-3 py-4 text-sm text-slate-400">
                        Loading notifications...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-slate-400">
                        You're all caught up.
                      </div>
                    ) : (
                      notifications.slice(0, 8).map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          onClick={() => void handleNotificationClick(notification)}
                          className={`cursor-pointer items-start rounded-xl px-3 py-3 focus:bg-slate-900 focus:text-white ${
                            getNotificationReadState(notification)
                              ? "opacity-80"
                              : "bg-slate-900/70"
                          }`}
                        >
                          <div className="flex w-full gap-3">
                            <span
                              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                                getNotificationReadState(notification)
                                  ? "bg-slate-700"
                                  : "bg-amber-400"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-white">
                                  {notification.title}
                                </p>
                                <span className="shrink-0 text-[11px] text-slate-500">
                                  {formatNotificationTime(notification.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-400">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-auto gap-3 border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      <Avatar className="h-9 w-9">
                        {user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl || undefined}
                            alt={user?.fullName ?? user?.email ?? "User"}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-amber-500 text-slate-950">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden text-left md:block">
                        <p className="max-w-36 truncate text-sm font-medium text-white">
                          {user?.fullName}
                        </p>
                        <p className="max-w-36 truncate text-xs text-slate-400">
                          {user?.email}
                        </p>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 border-slate-800 bg-slate-950 text-slate-100"
                  >
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="cursor-pointer rounded-xl focus:bg-slate-900 focus:text-white"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== `/${user?.role}` && location.pathname.startsWith(item.href));

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
