import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminAnalytics,
  getAdminUsers,
  setUserOnlineStatus,
  getPricingSettings,
  updatePricingSettings,
  listAllRequests,
} from "@/services/supabaseData";
import type {
  AnalyticsSummary,
  AppUser,
  LocationPoint,
  PricingSettings,
  ServiceRequest,
} from "@/types/app";

// ─── Auto-refresh interval in milliseconds (30 seconds) ──────────────────────
const AUTO_REFRESH_MS = 30_000;

type AdminUserRecord = AppUser & {
  createdAt?: string | null;
};

type AdminRequestRecord = ServiceRequest & {
  amount?: number | null;
  price?: number | null;
  estimatedPrice?: number | null;
  finalPrice?: number | null;
  paymentStatus?: string | null;
  customerName?: string | null;
  providerName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  location?: LocationPoint | string | null;
  requestLocation?: LocationPoint | null;
};

type AnalyticsShape = AnalyticsSummary & Record<string, string | number | null | undefined>;
type PricingShape = PricingSettings & Record<string, string | number | boolean | null | undefined>;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClasses(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "paid") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (s === "pending") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (s === "accepted" || s === "assigned" || s === "in_progress" || s === "in progress")
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  if (s === "failed" || s === "cancelled") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

function getLocationLabel(location?: LocationPoint | string | null) {
  if (!location) return "Location pending";
  if (typeof location === "string") return location;
  if (location.address) return location.address;
  return `Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}`;
}

function getRequestLocation(request: AdminRequestRecord) {
  return getLocationLabel(request.location ?? request.requestLocation ?? null);
}

function getRequestAmount(request: AdminRequestRecord) {
  return Number(request.finalPrice ?? request.amount ?? request.price ?? request.estimatedPrice ?? 0);
}

function getRequestPaymentStatus(request: AdminRequestRecord) {
  return (request.paymentStatus ?? "pending").toString();
}

// ─── Live indicator dot ───────────────────────────────────────────────────────
function LiveBadge({ lastRefreshed }: { lastRefreshed: Date | null }) {
  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs font-medium text-emerald-300">
        Live · {timeStr}
      </span>
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function AnalyticsMetricCard({
  title, value, description, icon: Icon,
}: {
  title: string; value: string; description: string; icon: typeof Users;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-3xl font-semibold text-white">{value}</p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
      <CardContent className="flex items-center gap-3 p-6 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-rose-500/20 bg-rose-500/10 text-rose-100">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">Unable to load admin data</p>
          <p className="text-sm text-rose-200/90">{message}</p>
        </div>
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-rose-400/30 bg-transparent text-rose-100 hover:bg-rose-500/10 hover:text-white"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-slate-800 bg-slate-900/50 text-slate-50">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full border border-slate-800 bg-slate-900 p-3">
          <ShieldCheck className="h-5 w-5 text-amber-300" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-white">{title}</p>
          <p className="max-w-xl text-sm text-slate-400">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── useAsyncData — NOW WITH AUTO-REFRESH ─────────────────────────────────────
// intervalMs: how often to auto-refresh. Pass 0 to disable.
function useAsyncData<T>(
  loader: () => Promise<T>,
  immediate = true,
  intervalMs = AUTO_REFRESH_MS,
) {
  const loaderRef = useRef(loader);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await loaderRef.current();
      setData(result);
      setLastRefreshed(new Date());
      setVersion((v) => v + 1);
    } catch (loadError) {
      console.error(loadError);
      // On silent refresh, don't wipe data — just log
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load data.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (immediate) void load(false);
  }, [immediate, load]);

  // ✅ Auto-refresh on interval
  useEffect(() => {
    if (!intervalMs) return;

    const timer = setInterval(() => {
      void load(true); // silent = true so it doesn't show full loading spinner
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, load]);

  const reload = useCallback(() => load(false), [load]);

  return { data, loading, refreshing, error, reload, version, lastRefreshed };
}

function pickNumericValue(analytics: AnalyticsShape, candidates: string[], fallback = 0) {
  for (const candidate of candidates) {
    const value = analytics[candidate];
    if (typeof value === "number") return value;
  }
  return fallback;
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewContent() {
  const { data, loading, refreshing, error, reload, lastRefreshed } = useAsyncData(async () => {
    const [analytics, users, requests] = await Promise.all([
      getAdminAnalytics(),
      getAdminUsers(),
      listAllRequests(),
    ]);
    return {
      analytics: analytics as AnalyticsShape,
      users: users as AdminUserRecord[],
      requests: requests as AdminRequestRecord[],
    };
  });

  const users = data?.users ?? [];
  const roleCounts = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] ?? 0) + 1;
    return acc;
  }, {});

  const recentRequests = [...(data?.requests ?? [])]
    .sort((a, b) => new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime())
    .slice(0, 5);

  if (loading) return <LoadingState label="Loading admin overview..." />;
  if (error || !data) return <ErrorState message={error ?? "No overview data available."} onRetry={() => void reload()} />;

  const totalUsers = pickNumericValue(data.analytics, ["totalUsers", "usersCount"], data.users.length);
  const totalRequests = pickNumericValue(data.analytics, ["totalRequests", "requestsCount"], data.requests.length);
  const onlineProviders = pickNumericValue(data.analytics, ["onlineProviders", "activeProviders", "onlineUsers"]);
  const totalRevenue = pickNumericValue(data.analytics, ["totalRevenue", "revenue"]);

  return (
    <div className="space-y-6">
      {/* Live indicator + manual refresh */}
      <div className="flex items-center justify-between">
        <LiveBadge lastRefreshed={lastRefreshed} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void reload()}
          disabled={refreshing}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetricCard title="Total users" value={totalUsers.toString()} description="All registered platform accounts." icon={Users} />
        <AnalyticsMetricCard title="Service requests" value={totalRequests.toString()} description="Customer requests tracked in the system." icon={Wrench} />
        <AnalyticsMetricCard title="Online providers" value={onlineProviders.toString()} description="Drivers and mechanics available right now." icon={Activity} />
        <AnalyticsMetricCard title="Revenue" value={formatCurrency(totalRevenue)} description="Aggregated earnings captured in analytics." icon={CreditCard} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle>User mix</CardTitle>
            <CardDescription className="text-slate-400">Distribution of customers and providers on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Object.entries(roleCounts).length === 0 ? (
              <EmptyState title="No users available" description="User role distribution will appear here once profiles are available." />
            ) : (
              Object.entries(roleCounts).map(([role, count]) => (
                <div key={role} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{formatLabel(role)}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{count}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle>Recent requests</CardTitle>
            <CardDescription className="text-slate-400">Most recent service activity across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRequests.length === 0 ? (
              <EmptyState title="No service requests yet" description="Recent customer requests will appear here once they are created." />
            ) : (
              recentRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{request.serviceType}</p>
                      <p className="text-sm text-slate-400">{request.customerName ?? request.customerId}</p>
                    </div>
                    <Badge className={getStatusClasses(request.status)}>{request.status}</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-amber-300" />
                      <span>{getRequestLocation(request)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDateTime(request.createdAt ?? request.updatedAt)}</span>
                      <span>{formatCurrency(getRequestAmount(request))}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersContent() {
  const { user } = useAuth();

  const { data, loading, refreshing, error, reload, lastRefreshed } = useAsyncData(async () => {
    const users = await getAdminUsers();
    return users as AdminUserRecord[];
  });

 const users = data ?? [];
  const onlineCount = users.filter((u) => u.isOnline).length;

  // 🟢 Auto set current user online when page loads, offline when they leave
  useEffect(() => {
    if (!user?.id) return;

    // Set online immediately
    void setUserOnlineStatus(user.id, true);

    // Set offline when tab closes or user navigates away
    const handleOffline = () => void setUserOnlineStatus(user.id!, false);
    window.addEventListener("beforeunload", handleOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        void setUserOnlineStatus(user.id!, false);
      } else {
        void setUserOnlineStatus(user.id!, true);
      }
    });

    return () => {
      window.removeEventListener("beforeunload", handleOffline);
      void setUserOnlineStatus(user.id!, false);
    };
  }, [user?.id]);

  if (loading) return <LoadingState label="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <LiveBadge lastRefreshed={lastRefreshed} />
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={refreshing}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <AnalyticsMetricCard title="Total users" value={users.length.toString()} description="All accounts with profiles." icon={Users} />
        <AnalyticsMetricCard title="Customers" value={users.filter((u) => u.role === "customer").length.toString()} description="Registered customer accounts." icon={Users} />
        <AnalyticsMetricCard title="Providers" value={users.filter((u) => u.role === "driver" || u.role === "mechanic").length.toString()} description="Driver and mechanic accounts." icon={Wrench} />
        <AnalyticsMetricCard title="Online now" value={onlineCount.toString()} description="Profiles currently marked online." icon={Activity} />
      </div>

      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>Platform users</CardTitle>
          <CardDescription className="text-slate-400">Review account roles, contact details, and provider activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.length === 0 ? (
            <EmptyState title="No users found" description="Profiles will appear here once they are created in Supabase." />
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{user.fullName}</p>
                    <Badge className="border-slate-700 bg-slate-800 text-slate-200">{formatLabel(user.role)}</Badge>
                    {typeof user.isOnline === "boolean" ? (
                      <Badge className={user.isOnline ? getStatusClasses("completed") : getStatusClasses("pending")}>
                        {user.isOnline ? "Online" : "Offline"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500">Joined {formatDateTime(user.createdAt)}</p>
                </div>
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Phone</p>
                    <p className="mt-2">{user.phone || "Not provided"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Jobs</p>
                    <p className="mt-2">{user.totalJobs ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Earnings</p>
                    <p className="mt-2">{formatCurrency(Number(user.earnings ?? 0))}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Requests ─────────────────────────────────────────────────────────────────
function RequestsContent() {
  const { data, loading, refreshing, error, reload, lastRefreshed } = useAsyncData(async () => {
    const requests = await listAllRequests();
    return requests as AdminRequestRecord[];
  });

  const requests = data ?? [];
  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) return <LoadingState label="Loading service requests..." />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <LiveBadge lastRefreshed={lastRefreshed} />
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={refreshing}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(statusCounts).length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/70 text-slate-50 md:col-span-4">
            <CardContent className="p-6 text-sm text-slate-400">Request status totals will appear once service requests exist.</CardContent>
          </Card>
        ) : (
          Object.entries(statusCounts).map(([status, count]) => (
            <AnalyticsMetricCard key={status} title={formatLabel(status)} value={count.toString()} description="Requests currently in this state." icon={Gauge} />
          ))
        )}
      </div>

      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>All service requests</CardTitle>
          <CardDescription className="text-slate-400">Track request progress, customer details, and provider assignment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 ? (
            <EmptyState title="No requests found" description="Customer service requests will appear here once they are created." />
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{request.serviceType}</p>
                      <Badge className={getStatusClasses(request.status)}>{request.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-400">Customer: {request.customerName ?? request.customerId}</p>
                    <p className="text-sm text-slate-400">Provider: {request.providerName ?? request.assignedTo ?? "Unassigned"}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Value</p>
                    <p className="text-xl font-semibold text-amber-300">{formatCurrency(getRequestAmount(request))}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
                    <p className="mt-2">{getRequestLocation(request)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Created</p>
                    <p className="mt-2">{formatDateTime(request.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Payment</p>
                    <p className="mt-2">
                      <Badge className={getStatusClasses(getRequestPaymentStatus(request))}>{getRequestPaymentStatus(request)}</Badge>
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function PaymentsContent() {
  const { data, loading, refreshing, error, reload, lastRefreshed } = useAsyncData(async () => {
    const requests = await listAllRequests();
    return requests as AdminRequestRecord[];
  });

  const paymentRequests = (data ?? []).filter(
    (r) => getRequestAmount(r) > 0 || (r.paymentStatus != null && r.paymentStatus !== ""),
  );
  const paidCount = paymentRequests.filter((r) => getRequestPaymentStatus(r).toLowerCase() === "paid").length;
  const pendingCount = paymentRequests.filter((r) => getRequestPaymentStatus(r).toLowerCase() === "pending").length;
  const totalAmount = paymentRequests.reduce((total, r) => total + getRequestAmount(r), 0);

  if (loading) return <LoadingState label="Loading payment activity..." />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <LiveBadge lastRefreshed={lastRefreshed} />
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={refreshing}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AnalyticsMetricCard title="Tracked payments" value={paymentRequests.length.toString()} description="Requests with recorded billing information." icon={CreditCard} />
        <AnalyticsMetricCard title="Paid" value={paidCount.toString()} description="Requests marked as paid." icon={ShieldCheck} />
        <AnalyticsMetricCard title="Tracked value" value={formatCurrency(totalAmount)} description="Total request value currently visible on this page." icon={AlertTriangle} />
      </div>

      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>Payment monitoring</CardTitle>
          <CardDescription className="text-slate-400">Derived from service request billing and payment status information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentRequests.length === 0 ? (
            <EmptyState title="No payment records available" description="Billing information will appear once requests have estimated or final amounts." />
          ) : (
            paymentRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{request.serviceType}</p>
                    <Badge className={getStatusClasses(getRequestPaymentStatus(request))}>{getRequestPaymentStatus(request)}</Badge>
                  </div>
                  <p className="text-sm text-slate-400">Customer: {request.customerName ?? request.customerId}</p>
                  <p className="text-xs text-slate-500">Created {formatDateTime(request.createdAt ?? request.updatedAt)}</p>
                </div>
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Amount</p>
                    <p className="mt-2 font-semibold text-amber-300">{formatCurrency(getRequestAmount(request))}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Request status</p>
                    <p className="mt-2">{request.status}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Customer</p>
                    <p className="mt-2">{request.customerName ?? request.customerId}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          {pendingCount > 0 ? (
            <p className="text-xs text-slate-500">{pendingCount} request{pendingCount === 1 ? "" : "s"} still show a pending payment status.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsContent() {
  const { data, loading, refreshing, error, reload, lastRefreshed } = useAsyncData(async () => {
    const [analytics, requests] = await Promise.all([getAdminAnalytics(), listAllRequests()]);
    return { analytics: analytics as AnalyticsShape, requests: requests as AdminRequestRecord[] };
  });

  const numericEntries = data?.analytics
    ? (Object.entries(data.analytics).filter(([, v]) => typeof v === "number") as Array<[string, number]>)
    : [];

  const requestStatusBreakdown = (data?.requests ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) return <LoadingState label="Loading analytics..." />;
  if (error || !data) return <ErrorState message={error ?? "No analytics data available."} onRetry={() => void reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <LiveBadge lastRefreshed={lastRefreshed} />
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={refreshing}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {numericEntries.slice(0, 8).map(([key, value]) => (
          <AnalyticsMetricCard key={key} title={formatLabel(key)}
            value={key.toLowerCase().includes("revenue") ? formatCurrency(value) : value.toString()}
            description="Live metric from the admin analytics summary." icon={Gauge} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle>Full analytics snapshot</CardTitle>
            <CardDescription className="text-slate-400">All numeric metrics returned by the analytics service.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {numericEntries.length === 0 ? (
              <EmptyState title="No analytics metrics" description="Numeric analytics values will appear here when available." />
            ) : (
              numericEntries.map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{formatLabel(key)}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {key.toLowerCase().includes("revenue") ? formatCurrency(value) : value}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle>Request status breakdown</CardTitle>
            <CardDescription className="text-slate-400">Derived from the full request list for cross-checking analytics totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(requestStatusBreakdown).length === 0 ? (
              <EmptyState title="No request status data" description="Once service requests exist, their status distribution will be shown here." />
            ) : (
              Object.entries(requestStatusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusClasses(status)}>{status}</Badge>
                    <span className="text-sm text-slate-300">{formatLabel(status)}</span>
                  </div>
                  <span className="text-lg font-semibold text-white">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function PricingSettingsEditor({ initialDraft, onReload }: { initialDraft: PricingShape; onReload: () => Promise<void> | void }) {
  const [draft, setDraft] = useState<PricingShape>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const editableEntries = Object.entries(draft).filter(([, value]) => {
    const t = typeof value;
    return t === "string" || t === "number" || t === "boolean";
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await updatePricingSettings(draft as PricingSettings);
      setSaveStatus({ type: "success", message: "Pricing settings saved successfully." });
      await onReload();
    } catch (err) {
      setSaveStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to save pricing settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pricing configuration</CardTitle>
            <CardDescription className="text-slate-400">Changes are saved directly to the database and take effect immediately.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => void onReload()} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {editableEntries.length === 0 ? (
            <EmptyState title="No editable fields" description="The pricing settings response did not include primitive values to edit." />
          ) : (
            editableEntries.map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <label className="mb-3 block text-sm font-medium text-slate-200">{formatLabel(key)}</label>
                {typeof value === "boolean" ? (
                  <button type="button"
                    onClick={() => setDraft((d) => d ? { ...d, [key]: !d[key] } : d)}
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition-colors ${value ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-300"}`}>
                    {value ? "Enabled" : "Disabled"}
                  </button>
                ) : (
                  <Input type={typeof value === "number" ? "number" : "text"} value={String(value ?? "")}
                    onChange={(e) => setDraft((d) => d ? { ...d, [key]: typeof value === "number" ? Number(e.target.value) : e.target.value } : d)}
                    className="border-slate-700 bg-slate-900 text-slate-50" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {saveStatus && (
        <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm ${saveStatus.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
          {saveStatus.type === "success" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
          {saveStatus.message}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving} className="bg-amber-500 px-8 text-slate-950 hover:bg-amber-400 disabled:opacity-50">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save pricing settings"}
        </Button>
      </div>
    </div>
  );
}

function SettingsContent() {
  // Settings don't need auto-refresh — admin is actively editing
  const { data, loading, error, reload, version } = useAsyncData(
    async () => { const s = await getPricingSettings(); return s as PricingShape; },
    true,
    0, // ← disable auto-refresh for settings
  );

  if (loading) return <LoadingState label="Loading pricing settings..." />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyState title="No pricing settings available" description="Pricing configuration will appear here once it is returned from the data layer." />;

  return <PricingSettingsEditor key={version} initialDraft={data} onReload={reload} />;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  return (
    <DashboardLayout title="Admin Dashboard" subtitle="Monitor platform performance, operational activity, and live service demand.">
      <OverviewContent />
    </DashboardLayout>
  );
}

export function AdminUsers() {
  return (
    <DashboardLayout title="Admin Users" subtitle="Review customers, providers, and online activity.">
      <UsersContent />
    </DashboardLayout>
  );
}

export function AdminRequests() {
  return (
    <DashboardLayout title="Admin Requests" subtitle="Track service request progress across the platform.">
      <RequestsContent />
    </DashboardLayout>
  );
}

export function AdminPayments() {
  return (
    <DashboardLayout title="Admin Payments" subtitle="Monitor request billing and payment status information.">
      <PaymentsContent />
    </DashboardLayout>
  );
}

export function AdminAnalytics() {
  return (
    <DashboardLayout title="Admin Analytics" subtitle="Inspect numeric platform metrics and request activity.">
      <AnalyticsContent />
    </DashboardLayout>
  );
}

export function AdminSettings() {
  return (
    <DashboardLayout title="Admin Settings" subtitle="Review current pricing configuration returned by Supabase.">
      <SettingsContent />
    </DashboardLayout>
  );
}