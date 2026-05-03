import { useCallback, useEffect, useState } from "react";
import {
  BarChart2,
  Briefcase,
  CalendarClock,
  Car,
  CheckCircle,
  CreditCard,
  Edit2,
  Loader2,
  MapPin,
  Navigation,     
  Phone,
  Play,            
  RefreshCw,
  ShieldCheck,
  Save,
  Star,
  Timer,            
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";
 
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acceptJob,
  cancelJob,
  completeJob,
  declineJob,
  getPricingSettings,
  listAvailableJobs,
  listMyJobs,
  markDriverArrived,  
  setAvailability,
  setUserOnlineStatus,
  startTrip,          
} from "@/services/supabaseData";
 
import { useRealtimeTable } from "@/hooks/useRealtime";
import { supabase } from "@/lib/supabase";
import { useShareDriverLocation } from "@/hooks/useDriverLocation";
import LiveTrackingMap from "@/components/maps/LiveTrackingMap";
import RequestChatPanel from "@/components/chat/RequestChatPanel";
import type { Job, LocationPoint } from "@/types/app";
 
type DriverJob = Job & {
  amount?: number | null;
  price?: number | null;
  estimatedPrice?: number | null;
  customerPhone?: string | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  location?: LocationPoint | string | null;
  requestLocation?: LocationPoint | null;
  pickupLocation?: LocationPoint | null;
  destination?: LocationPoint | string | null;
};
 
// ─── Reverse geocode lat/lng → human readable address via OpenStreetMap ───────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } },
    );
    const data = await res.json() as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
 
function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}
 
function getJobAmount(job: DriverJob) {
  return Number(job.amount ?? job.price ?? job.estimatedPrice ?? 0);
}
 
// ─── Haversine distance (km) ─────────────────────────────────────────────────
function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calculateJobPrice(
  serviceType: string,
  pricing: Record<string, number>,
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number } | null,
): number {
  const svc = serviceType.toLowerCase();
  if (svc === "battery") return pricing.batteryJumpstartRate ?? 800;
  if (svc === "fuel") return pricing.fuelDeliveryRate ?? 500;
  if (svc === "repair") return pricing.mechanicInspectionRate ?? 1800;
  if (svc === "rescue") return pricing.lockoutRate ?? 1500;
  const base = pricing.towBaseRate ?? 2500;
  const perKm = pricing.towRatePerKm ?? 300;
  if (from && to) return Math.round(base + haversineDistanceKm(from, to) * perKm);
  return base;
}

function getLocationLabel(location?: LocationPoint | string | null) {
  if (!location) return "Location pending";
  if (typeof location === "string") return location;
  if (location.address && !location.address.startsWith("Lat ")) return location.address;
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}
 
function getJobLocation(job: DriverJob) {
  return getLocationLabel(
    job.location ?? job.requestLocation ?? job.pickupLocation ?? null,
  );
}
 
function getDestinationLabel(job: DriverJob) {
  return getLocationLabel(job.destination ?? null);
}
 
// ─── Extract a proper LocationPoint from a DriverJob ──────────────────────────
function resolveCustomerLocation(job: DriverJob): LocationPoint | null {
  const loc = job.location ?? job.requestLocation ?? job.pickupLocation ?? null;
  if (!loc) return null;
  if (typeof loc === "object" && "lat" in loc) return loc as LocationPoint;
  return null;
}
 
function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}
 
function getStatusClasses(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (s === "pending") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (s === "accepted" || s === "assigned") return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  if (s === "arrived") return "border-violet-500/20 bg-violet-500/10 text-violet-300"; // ✅ NEW
  if (s === "in_progress" || s === "in progress") return "border-indigo-500/20 bg-indigo-500/10 text-indigo-300";
  if (s === "rejected") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  if (s === "cancelled") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}
function JobsLoadingState() {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
      <CardContent className="flex items-center gap-3 p-6 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading jobs...
      </CardContent>
    </Card>
  );
}
 
function JobsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-rose-500/20 bg-rose-500/10 text-rose-100">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">Unable to load driver jobs</p>
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
 
function EmptyJobsState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-slate-800 bg-slate-900/50 text-slate-50">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full border border-slate-800 bg-slate-900 p-3">
          <Briefcase className="h-5 w-5 text-amber-300" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-white">{title}</p>
          <p className="max-w-xl text-sm text-slate-400">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
 
function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Briefcase;
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
 
// ─── JobDetailsDialog ─────────────────────────────────────────────────────────
function JobDetailsDialog({
  job,
  open,
  onOpenChange,
  onAccept,
  onDecline,
  onCancel,
}: {
  job: DriverJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: (job: DriverJob) => Promise<void>;
  onDecline?: (job: DriverJob) => Promise<void>;
  onCancel?: (job: DriverJob) => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [pickupAddress, setPickupAddress] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string | null>(null);
  const customerLoc = job ? resolveCustomerLocation(job) : null;
  const destinationLocation =
    job?.destination && typeof job.destination === "object" && "lat" in job.destination
      ? (job.destination as LocationPoint)
      : null;
 
  // Reverse geocode pickup and destination when dialog opens
  useEffect(() => {
    if (!job) {
      setPickupAddress(null);
      setDestinationAddress(null);
      return;
    }
 
    if (customerLoc) {
      void reverseGeocode(customerLoc.lat, customerLoc.lng).then(setPickupAddress);
    } else {
      setPickupAddress(null);
    }
 
    if (destinationLocation) {
      void reverseGeocode(destinationLocation.lat, destinationLocation.lng).then(setDestinationAddress);
    } else {
      setDestinationAddress(null);
    }
  }, [customerLoc, destinationLocation, job]);
 
  const handleAccept = async () => {
    if (!job || !onAccept) return;
    setActionLoading(true);
    try {
      await onAccept(job);
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };
 
  const handleDecline = async () => {
    if (!job || !onDecline) return;
    setActionLoading(true);
    try {
      await onDecline(job);
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };
 
  const handleCancel = async () => {
    if (!job || !onCancel) return;
    setActionLoading(true);
    try {
      await onCancel(job);
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };
 
  const isPending = job?.status?.toLowerCase() === "pending";
  const isAccepted =
    job?.status?.toLowerCase() === "accepted" || job?.status?.toLowerCase() === "assigned";
 
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-2xl">
        {job ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-4">
                <span>{job.serviceType}</span>
                <Badge className={getStatusClasses(job.status)}>{job.status}</Badge>
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Review the pickup information before you head out.
              </DialogDescription>
            </DialogHeader>
 
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">Customer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-amber-300" />
                    <span>{job.customerName}</span>
                  </div>
                  {job.customerPhone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-amber-300" />
                      <span>{job.customerPhone}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-amber-300" />
                    <span>{formatCurrency(getJobAmount(job))}</span>
                  </div>
                </CardContent>
              </Card>
 
              <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">Location details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>{pickupAddress ?? getJobLocation(job)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>{destinationAddress ?? getDestinationLabel(job)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-amber-300" />
                    <span>{formatDateTime(job.createdAt ?? job.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
 
            <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
              <CardHeader>
                <CardTitle className="text-base">Service notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p>{job.description || "No additional driver notes were provided."}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-700 bg-slate-800 text-slate-200">Driver dispatch</Badge>
                  <Badge className="border-slate-700 bg-slate-800 text-slate-200">Safety checklist required</Badge>
                </div>
              </CardContent>
            </Card>
 
            {/* Accept / Decline / Cancel action buttons inside dialog */}
            <div className="flex justify-end gap-3 pt-2">
              {isPending && onDecline && (
                <Button
                  onClick={() => void handleDecline()}
                  disabled={actionLoading}
                  variant="outline"
                  className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Decline Job
                </Button>
              )}
              {isPending && onAccept && (
                <Button
                  onClick={() => void handleAccept()}
                  disabled={actionLoading}
                  className="bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Accept Job
                </Button>
              )}
              {isAccepted && onCancel && (
                <Button
                  onClick={() => void handleCancel()}
                  disabled={actionLoading}
                  variant="outline"
                  className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Cancel Job
                </Button>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
 
// ─── JobCard ──────────────────────────────────────────────────────────────────
function JobCard({
  job,
  actionLabel,
  onSelect,
  onAccept,
  onDecline,
  onCancel,
}: {
  job: DriverJob;
  actionLabel: string;
  onSelect: (job: DriverJob) => void;
  onAccept?: (job: DriverJob) => Promise<void>;
  onDecline?: (job: DriverJob) => Promise<void>;
  onCancel?: (job: DriverJob) => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [resolvedPickup, setResolvedPickup] = useState<string | null>(null);
  const pickupLocation = resolveCustomerLocation(job);
 
  // Reverse geocode pickup location for the card
  useEffect(() => {
    if (!pickupLocation) {
      setResolvedPickup(null);
      return;
    }
 
    void reverseGeocode(pickupLocation.lat, pickupLocation.lng).then(setResolvedPickup);
  }, [pickupLocation]);
 
  const handleAccept = async () => {
    if (!onAccept) return;
    setActionLoading(true);
    try {
      await onAccept(job);
    } finally {
      setActionLoading(false);
    }
  };
 
  const handleDecline = async () => {
    if (!onDecline) return;
    setActionLoading(true);
    try {
      await onDecline(job);
    } finally {
      setActionLoading(false);
    }
  };
 
  const handleCancel = async () => {
    if (!onCancel) return;
    setActionLoading(true);
    try {
      await onCancel(job);
    } finally {
      setActionLoading(false);
    }
  };
 
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50 transition-colors hover:border-amber-500/20">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{job.serviceType}</h3>
              <Badge className={getStatusClasses(job.status)}>{job.status}</Badge>
            </div>
            <p className="text-sm text-slate-400">{job.description || "No extra notes provided."}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estimated payout</p>
            <p className="text-xl font-semibold text-amber-300">{formatCurrency(getJobAmount(job))}</p>
          </div>
        </div>
 
        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</p>
            <p className="mt-2 font-medium text-white">{job.customerName}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pickup location</p>
            <p className="mt-2 leading-snug">{resolvedPickup ?? getJobLocation(job)}</p>
          </div>
        </div>
 
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Customer verification available on dispatch
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Decline button — shown on pending jobs */}
            {onDecline && job.status.toLowerCase() === "pending" && (
              <Button
                onClick={() => void handleDecline()}
                disabled={actionLoading}
                variant="outline"
                className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              >
                {actionLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-1 h-4 w-4" />
                )}
                Decline
              </Button>
            )}
            {/* Accept button — shown on pending jobs */}
            {onAccept && job.status.toLowerCase() === "pending" && (
              <Button
                onClick={() => void handleAccept()}
                disabled={actionLoading}
                className="bg-emerald-500 text-white hover:bg-emerald-400"
              >
                {actionLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1 h-4 w-4" />
                )}
                Accept
              </Button>
            )}
            {/* Cancel button — shown on accepted jobs */}
            {onCancel &&
              (job.status.toLowerCase() === "accepted" || job.status.toLowerCase() === "assigned") && (
                <Button
                  onClick={() => void handleCancel()}
                  disabled={actionLoading}
                  variant="outline"
                  className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-4 w-4" />
                  )}
                  Cancel
                </Button>
              )}
            <Button
              onClick={() => onSelect(job)}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
 
// ─── AvailabilityButton ───────────────────────────────────────────────────────
function AvailabilityButton({
  isOnline,
  loading,
  onToggle,
}: {
  isOnline: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      onClick={onToggle}
      disabled={loading}
      variant={isOnline ? "default" : "outline"}
      className={
        isOnline
          ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
      }
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isOnline ? "Go offline" : "Go online"}
    </Button>
  );
}
 
// ─── useDriverJobsData hook ───────────────────────────────────────────────────
function useDriverJobsData() {
  const { user, updateUser } = useAuth();
  const userId = user?.id ?? null;
  const isOnline = user?.isOnline ?? false;
  const [availableJobs, setAvailableJobs] = useState<DriverJob[]>([]);
  const [myJobs, setMyJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  const loadJobs = useCallback(async () => {
    if (!userId) {
      setAvailableJobs([]);
      setMyJobs([]);
      setLoading(false);
      return;
    }
 
    setLoading(true);
    setError(null);
 
    try {
      const [available, mine] = await Promise.all([
        listAvailableJobs("driver"),
        listMyJobs(userId, "driver"),
      ]);
 
      setAvailableJobs(available as DriverJob[]);
      setMyJobs(mine as DriverJob[]);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load driver jobs.");
    } finally {
      setLoading(false);
    }
  }, [userId]);
 
  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);
 
  const refreshJobs = useCallback(() => {
    void loadJobs();
  }, [loadJobs]);

  // 🟢 Auto set driver online when dashboard loads
  useEffect(() => {
    if (!user?.id) return;

    void setUserOnlineStatus(user.id, true);

    const handleOffline = () => void setUserOnlineStatus(user.id!, false);
    window.addEventListener("beforeunload", handleOffline);

    const handleVisibility = () => {
      if (document.hidden) {
        void setUserOnlineStatus(user.id!, false);
      } else {
        void setUserOnlineStatus(user.id!, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      void setUserOnlineStatus(user.id!, false);
    };
  }, [user?.id]);
 
  // 🔴 REALTIME — instantly refresh when ANY service request changes
  useRealtimeTable("service_requests", refreshJobs);
 
  const toggleAvailability = useCallback(async () => {
    if (!userId) return;
 
    setAvailabilitySaving(true);
    setError(null);
 
    try {
      const updatedProfile = await setAvailability(!isOnline);
      updateUser({ isOnline: updatedProfile.isOnline });
    } catch (availabilityError) {
      console.error(availabilityError);
      setError(
        availabilityError instanceof Error
          ? availabilityError.message
          : "Unable to update your availability."
      );
    } finally {
      setAvailabilitySaving(false);
    }
  }, [isOnline, updateUser, userId]);
 
  const handleAcceptJob = useCallback(
    async (job: DriverJob) => {
      if (!userId) return;
      await acceptJob(job.id, userId);
      await loadJobs();
    },
    [userId, loadJobs]
  );
 
  const handleDeclineJob = useCallback(
    async (job: DriverJob) => {
      await declineJob(job.id);
      await loadJobs();
    },
    [loadJobs]
  );
 
  const handleCancelJob = useCallback(
    async (job: DriverJob) => {
      await cancelJob(job.id);
      await loadJobs();
    },
    [loadJobs]
  );

  const handleCompleteJob = useCallback(
    async (job: DriverJob, finalPrice?: number) => {
      await completeJob(job.id, finalPrice);
      await loadJobs();
    },
    [loadJobs]
  );
 
  const activeJobs = myJobs.filter((job) =>
    ["accepted", "assigned", "arrived", "in_progress", "in progress"].includes(job.status.toLowerCase())
  );

  const completedJobs = myJobs.filter((job) => job.status.toLowerCase() === "completed");
  const totalEarnings = completedJobs.reduce((total, job) => total + getJobAmount(job), 0);
 
  return {
    user,
    availableJobs,
    myJobs,
    activeJobs,
    completedJobs,
    totalEarnings,
    loading,
    error,
    availabilitySaving,
    loadJobs,
    toggleAvailability,
    handleAcceptJob,
    handleDeclineJob,
    handleCancelJob,
    handleCompleteJob,
  };
}
 
// ─── ActiveJobCard ─────────────────────────────────────────────────────────────
// Shares driver GPS live, shows both driver + customer pins on the map
function ActiveJobCard({
  job,
  driverId,
  onCancel,
  onComplete,
}: {
  job: DriverJob;
  driverId: string | null;
  onCancel: (job: DriverJob) => Promise<void>;
  onComplete: (job: DriverJob, finalPrice?: number) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
 
  // ── Countdown timer state (starts when driver marks arrived) ──────────────
  const [countdown, setCountdown] = useState<number | null>(null); // seconds
  const WAIT_MINUTES = 10;
 
  // If the stored job amount is 0, recalculate from pricing config
  useEffect(() => {
    const stored = getJobAmount(job);
    if (stored > 0) {
      setLivePrice(stored);
      return;
    }
    void getPricingSettings().then((pricing) => {
      const from = resolveCustomerLocation(job);
      const to =
        job.destination && typeof job.destination === "object" && "lat" in job.destination
          ? (job.destination as LocationPoint)
          : null;
      const calc = calculateJobPrice(
        job.serviceType ?? "towing",
        pricing as unknown as Record<string, number>,
        from,
        to,
      );
      setLivePrice(calc);
    });
  }, [job]);
 
  // ── Fare meter — ticks every minute while in_progress ─────────────────────
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  useEffect(() => {
    if (job.status.toLowerCase() !== "in_progress") return;
    const interval = setInterval(() => setElapsedMinutes((m) => m + 1), 60_000);
    return () => clearInterval(interval);
  }, [job.status]);
 
  // ── Countdown timer — ticks down from 10 minutes when arrived ─────────────
  useEffect(() => {
    if (job.status.toLowerCase() !== "arrived") {
      setCountdown(null);
      return;
    }
    // Start at WAIT_MINUTES minutes in seconds
    setCountdown(WAIT_MINUTES * 60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [job.status]);
 
  const displayPrice = livePrice ?? getJobAmount(job);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
 
  const status = job.status.toLowerCase();
  const isActive = ["accepted", "assigned", "arrived", "in_progress", "in progress"].includes(status);
  const isArrived = status === "arrived";
  const isInProgress = status === "in_progress" || status === "in progress";
 
  const customerLoc = resolveCustomerLocation(job);
 
  useEffect(() => {
    if (!customerLoc) { setResolvedAddress(null); return; }
    void reverseGeocode(customerLoc.lat, customerLoc.lng).then(setResolvedAddress);
  }, [customerLoc?.lat, customerLoc?.lng]);
 
  useShareDriverLocation(driverId, job.id, isActive);
 
  useEffect(() => {
    if (!isActive || !navigator.geolocation || !customerLoc) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [customerLoc, isActive]);
 
  // Format countdown as mm:ss
  const countdownDisplay = countdown !== null
    ? `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}`
    : null;
 
  // Live fare calculation including elapsed time
  const liveFare = isInProgress
    ? displayPrice + elapsedMinutes * 10 // Ksh 10 per minute during trip
    : displayPrice;
 
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-slate-950/70 p-4 space-y-3">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">{job.customerName}</p>
          <p className="text-sm text-slate-400">{job.serviceType}</p>
        </div>
        <Badge className={getStatusClasses(job.status)}>
          {isArrived ? "Arrived" : isInProgress ? "In Progress" : job.status}
        </Badge>
      </div>
 
      {/* ── Location ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2 text-sm text-slate-300">
        <MapPin className="mt-0.5 h-4 w-4 text-amber-300 shrink-0" />
        <span>{resolvedAddress ?? getJobLocation(job)}</span>
      </div>
 
      {/* ── Arrived banner + countdown ────────────────────────── */}
      {isArrived && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
            <Navigation className="h-4 w-4" />
            You have arrived at the customer location
          </div>
          {countdownDisplay && countdown !== null && countdown > 0 ? (
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-amber-300" />
              <span className="text-xs text-slate-400">Customer wait time:</span>
              <span className={`font-mono font-bold text-sm ${
                countdown < 120 ? "text-rose-400" : "text-amber-300"
              }`}>
                {countdownDisplay}
              </span>
              {countdown < 120 && (
                <span className="text-xs text-rose-400">— You may cancel soon</span>
              )}
            </div>
          ) : countdown === 0 ? (
            <p className="text-xs text-rose-400 font-medium">
              Wait time expired — you may release this job without penalty.
            </p>
          ) : null}
        </div>
      )}
 
      {/* ── In Progress — fare meter ──────────────────────────── */}
      {isInProgress && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/8 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-indigo-300 animate-pulse" />
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Fare meter</p>
              <p className="text-xl font-bold text-white">{formatCurrency(liveFare)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Time on job</p>
            <p className="text-sm font-mono text-indigo-300">{elapsedMinutes}m elapsed</p>
          </div>
        </div>
      )}
 
      {/* ── Live map ──────────────────────────────────────────── */}
      {customerLoc ? (
        <LiveTrackingMap
          customerLocation={customerLoc}
          driverLocation={driverPos}
          viewerRole="driver"
          heightClassName="h-56"
        />
      ) : (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
          Customer location unavailable — map will appear once location data is received.
        </div>
      )}
 
      <RequestChatPanel
        requestId={job.requestId}
        title="Chat with customer"
        description="Coordinate arrival details and updates with the customer while this job is active."
        className="border-slate-800 bg-slate-950/80"
      />
 
      {/* ── Completed price display ───────────────────────────── */}
      {status === "completed" && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Service total</p>
            <p className="text-xl font-semibold text-amber-300">{formatCurrency(displayPrice)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Payment requested from customer</p>
            <p className="text-xs text-slate-400">{job.customerName}</p>
          </div>
        </div>
      )}
 
      {/* ── Action buttons ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {formatDateTime(job.updatedAt ?? job.createdAt)}
        </span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
 
          {/* Release job — always visible while active */}
          <Button
            onClick={async () => {
              setCancelling(true);
              try { await onCancel(job); } finally { setCancelling(false); }
            }}
            disabled={cancelling || completing || arriving || startingTrip}
            variant="outline"
            size="sm"
            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
          >
            {cancelling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}
            Release job
          </Button>
 
          {/* ── Step 1: I've Arrived (shown when accepted/assigned) ── */}
          {(status === "accepted" || status === "assigned") && (
            <Button
              onClick={async () => {
                setArriving(true);
                try {
                  await markDriverArrived(job.id);
                } finally {
                  setArriving(false);
                }
              }}
              disabled={arriving || cancelling}
              size="sm"
              className="bg-violet-500 text-white hover:bg-violet-400 font-semibold"
            >
              {arriving
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <Navigation className="mr-1 h-3 w-3" />
              }
              I've Arrived
            </Button>
          )}
 
          {/* ── Step 2: Start Trip (shown when arrived) ─────────── */}
          {isArrived && (
            <Button
              onClick={async () => {
                setStartingTrip(true);
                try {
                  await startTrip(job.id);
                } finally {
                  setStartingTrip(false);
                }
              }}
              disabled={startingTrip || cancelling}
              size="sm"
              className="bg-sky-500 text-white hover:bg-sky-400 font-semibold"
            >
              {startingTrip
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <Play className="mr-1 h-3 w-3" />
              }
              Start Trip
            </Button>
          )}
 
          {/* ── Step 3: Complete Job (shown when in_progress) ───── */}
          {isInProgress && (
            <Button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={completing || cancelling}
              size="sm"
              className="bg-emerald-500 text-white hover:bg-emerald-400 font-semibold"
            >
              {completing
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <CheckCircle className="mr-1 h-3 w-3" />
              }
              Complete Job
            </Button>
          )}
 
        </div>
      </div>
 
      {/* ── Completion confirmation dialog ────────────────────── */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Mark job as complete?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Confirm that the service has been fully delivered and the customer is satisfied.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{job.customerName}</span> — {job.serviceType}
            </p>
            <p className="text-2xl font-bold text-amber-300">{formatCurrency(liveFare)}</p>
            <p className="text-xs text-slate-400">
              A payment prompt will be sent to the customer immediately after you confirm.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCompleteConfirm(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Not yet
            </Button>
            <Button
              onClick={async () => {
                setShowCompleteConfirm(false);
                setCompleting(true);
                try { await onComplete(job, liveFare); } finally { setCompleting(false); }
              }}
              className="bg-emerald-500 text-white hover:bg-emerald-400"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Yes, complete &amp; request payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
function MiniBarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentMonth = new Date().getMonth();
  // Show last 6 months
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const monthIndex = (currentMonth - 5 + i + 12) % 12;
    return { month: months[monthIndex], value: data[i] ?? 0 };
  });
 
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">{label}</p>
      <div className="flex items-end gap-1.5 h-20">
        {last6.map(({ month, value }) => (
          <div key={month} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-t-sm bg-amber-500/60 hover:bg-amber-500 transition-colors"
              style={{ height: `${Math.max((value / max) * 64, value > 0 ? 4 : 0)}px` }}
              title={`${formatCurrency(value)}`}
            />
            <span className="text-[9px] text-slate-500">{month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
 
// ─── Driver Profile + Analytics Component ────────────────────────────────────
// ─── DriverRatingsPanel ───────────────────────────────────────────────────────
type RatingRow = {
  id: string;
  driverRating: number | null;
  review: string | null;
  createdAt: string;
};

function DriverRatingsPanel({ driverId }: { driverId: string }) {
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;
    setLoading(true);

    async function fetchRatings() {
      const { data } = await supabase
        .from("ratings")
        .select("id, driver_rating, review, created_at")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false });

      setRatings(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id ?? ""),
          driverRating: r.driver_rating != null ? Number(r.driver_rating) : null,
          review: typeof r.review === "string" ? r.review : null,
          createdAt: String(r.created_at ?? ""),
        }))
      );
      setLoading(false);
    }

    void fetchRatings();
  }, [driverId]);

  const avg = ratings.length > 0
    ? (ratings.reduce((s, r) => s + (r.driverRating ?? 0), 0) / ratings.length).toFixed(1)
    : null;

  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            Customer Reviews
          </CardTitle>
          {avg && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-sm font-semibold text-amber-300">
              {avg} / 5
            </span>
          )}
        </div>
        <CardDescription className="text-slate-400">
          Ratings left by customers after completed and paid services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reviews...
          </div>
        ) : ratings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
            No reviews yet. Complete jobs to receive your first rating.
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= (r.driverRating ?? 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                  </span>
                </div>
                {r.review && (
                  <p className="text-sm text-slate-300 leading-relaxed">"{r.review}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DriverProfileAnalytics() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(user?.fullName ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const { completedJobs, totalEarnings, myJobs, loading } = useDriverJobsData();
 
  // Analytics calculations
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
 
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
 
  const jobsThisWeek = completedJobs.filter(job => {
    const d = new Date(job.completedAt ?? job.updatedAt ?? job.createdAt ?? '');
    return d >= startOfWeek;
  }).length;
 
  const jobsThisMonth = completedJobs.filter(job => {
    const d = new Date(job.completedAt ?? job.updatedAt ?? job.createdAt ?? '');
    return d >= startOfMonth;
  }).length;
 
  const earningsThisMonth = completedJobs
    .filter(job => {
      const d = new Date(job.completedAt ?? job.updatedAt ?? job.createdAt ?? '');
      return d >= startOfMonth;
    })
    .reduce((sum, job) => sum + getJobAmount(job), 0);
 
  // Earnings per month for last 6 months (for chart)
  const earningsByMonth = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    return completedJobs
      .filter(job => {
        const d = new Date(job.completedAt ?? job.updatedAt ?? job.createdAt ?? '');
        return d >= monthDate && d < nextMonth;
      })
      .reduce((sum, job) => sum + getJobAmount(job), 0);
  });
 
  const totalJobs = myJobs.length;
  const acceptanceRate = totalJobs > 0
    ? Math.round((completedJobs.length / totalJobs) * 100)
    : 0;
 
  const averageRating = user?.rating ?? 0;
  const avgEarningsPerJob = completedJobs.length > 0
    ? totalEarnings / completedJobs.length
    : 0;
 
  const handleSave = async () => {
    setSaving(true);
    try {
      updateUser({ fullName: editName, phone: editPhone });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
 
  const initials = (user?.fullName ?? 'D')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
 
  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-[320px,1fr]">
 
      {/* ── Profile Card ────────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserRound className="h-4 w-4 text-amber-300" />
              My Profile
            </CardTitle>
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditName(user?.fullName ?? ''); setEditPhone(user?.phone ?? ''); setEditing(true); }}
                className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 h-7 px-2 text-xs"
              >
                <Edit2 className="mr-1 h-3 w-3" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="bg-emerald-500 text-white hover:bg-emerald-400 h-7 px-2 text-xs"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  className="border-slate-700 text-slate-300 h-7 px-2 text-xs"
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
 
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-slate-950"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-500"
                  placeholder="Full name"
                />
              ) : (
                <p className="font-semibold text-white truncate">{user?.fullName ?? 'Driver'}</p>
              )}
              <div className="mt-1 flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${user?.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="text-xs text-slate-400">{user?.isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
 
          {/* Info rows */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              {editing ? (
                <input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="flex-1 bg-transparent text-white outline-none text-sm"
                  placeholder="Phone number"
                />
              ) : (
                <span className="text-slate-300 truncate">{user?.phone || 'Not set'}</span>
              )}
            </div>
 
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="text-slate-300 truncate">{user?.email || 'No email'}</span>
            </div>
 
            {/* Vehicle info */}
            {user?.vehicle && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                <Car className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span className="text-slate-300 truncate">
                  {[user.vehicle.model, user.vehicle.plate, user.vehicle.type]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            )}
 
            {/* Rating */}
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="text-amber-200 font-medium">
                {averageRating > 0 ? `${averageRating.toFixed(1)} rating` : 'No ratings yet'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
 
      {/* ── Analytics Card ───────────────────────────────────── */}
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-amber-300" />
            My Progress & Analytics
          </CardTitle>
          <CardDescription className="text-slate-400">
            Performance summary based on your completed jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
 
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Total completed', value: loading ? '...' : completedJobs.length.toString(), color: 'text-emerald-300' },
              { label: 'This week', value: loading ? '...' : jobsThisWeek.toString(), color: 'text-sky-300' },
              { label: 'This month', value: loading ? '...' : jobsThisMonth.toString(), color: 'text-violet-300' },
              { label: 'Acceptance rate', value: loading ? '...' : `${acceptanceRate}%`, color: 'text-amber-300' },
              { label: 'Avg per job', value: loading ? '...' : formatCurrency(avgEarningsPerJob), color: 'text-amber-300' },
              { label: 'Month earnings', value: loading ? '...' : formatCurrency(earningsThisMonth), color: 'text-emerald-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</p>
                <p className={`mt-1.5 text-lg font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
 
          {/* Earnings chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <MiniBarChart
              data={earningsByMonth}
              label="Earnings over last 6 months (KES)"
            />
          </div>
 
          {/* Total earnings highlight */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Total lifetime earnings</p>
              <p className="text-2xl font-bold text-amber-300">{loading ? '...' : formatCurrency(totalEarnings)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-500/30" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

 
// ─── DriverOverviewContent ────────────────────────────────────────────────────
function DriverOverviewContent() {
  const {
    user,
    availableJobs,
    activeJobs,
    completedJobs,
    totalEarnings,
    loading,
    error,
    availabilitySaving,
    loadJobs,
    toggleAvailability,
    handleAcceptJob,
    handleDeclineJob,
    handleCancelJob,
    handleCompleteJob,
  } = useDriverJobsData();
  const [selectedJob, setSelectedJob] = useState<DriverJob | null>(null);
 
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Driver status</p>
          <h3 className="text-xl font-semibold text-white">
            {user?.isOnline ? "You are visible for dispatch" : "You are currently offline"}
          </h3>
          <p className="text-sm text-slate-400">
            Switch online when you are ready to receive towing and roadside assistance jobs.
          </p>
        </div>
        <AvailabilityButton
          isOnline={user?.isOnline === true}
          loading={availabilitySaving}
          onToggle={() => void toggleAvailability()}
        />
      </div>
 
      {error ? (
        <div className="mb-6">
          <JobsErrorState message={error} onRetry={() => void loadJobs()} />
        </div>
      ) : null}
 <DriverProfileAnalytics />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Available jobs"
          value={loading ? "..." : availableJobs.length.toString()}
          description="Open towing requests near your dispatch zone."
          icon={Briefcase}
        />
        <MetricCard
          title="Active jobs"
          value={loading ? "..." : activeJobs.length.toString()}
          description="Accepted or in-progress assignments."
          icon={Car}
        />
        <MetricCard
          title="Completed jobs"
          value={loading ? "..." : completedJobs.length.toString()}
          description="Successfully resolved service requests."
          icon={Star}
        />
        <MetricCard
          title="Total earnings"
          value={loading ? "..." : formatCurrency(totalEarnings)}
          description="Calculated from completed jobs in your queue."
          icon={TrendingUp}
        />
      </div>
 
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Available dispatches</CardTitle>
              <CardDescription className="text-slate-400">
                Newly created customer requests waiting for a driver.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadJobs()}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <JobsLoadingState />
            ) : availableJobs.length === 0 ? (
              <EmptyJobsState
                title="No available jobs right now"
                description="Stay online and keep this page open. New requests will appear here as customers submit them."
              />
            ) : (
              availableJobs.slice(0, 3).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  actionLabel="View details"
                  onSelect={setSelectedJob}
                  onAccept={handleAcceptJob}
                  onDecline={handleDeclineJob}
                />
              ))
            )}
          </CardContent>
        </Card>
 
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle>My active queue</CardTitle>
            <CardDescription className="text-slate-400">
              Stay on top of accepted and in-progress assignments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <JobsLoadingState />
            ) : activeJobs.length === 0 ? (
              <EmptyJobsState
                title="No active assignments"
                description="Once you accept or are assigned a job, it will appear here for quick follow-up."
              />
            ) : (
              activeJobs.slice(0, 4).map((job) => (
                <ActiveJobCard
                  key={job.id}
                  job={job}
                  driverId={user?.id ?? null}
                  onCancel={handleCancelJob}
                  onComplete={handleCompleteJob}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
 
      <JobDetailsDialog
        job={selectedJob}
        open={selectedJob !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        onAccept={handleAcceptJob}
        onDecline={handleDeclineJob}
        onCancel={handleCancelJob}
      />

      {/* ── Customer reviews panel ─────────────────────── */}
      {user?.id && (
        <div className="mt-6">
          <DriverRatingsPanel driverId={user.id} />
        </div>
      )}
    </>
  );
}
 
// ─── DriverJobsContent ────────────────────────────────────────────────────────
function DriverJobsContent() {
  const { availableJobs, loading, error, loadJobs, handleAcceptJob, handleCancelJob } = useDriverJobsData();
  const [selectedJob, setSelectedJob] = useState<DriverJob | null>(null);
 
  if (loading) return <JobsLoadingState />;
  if (error) return <JobsErrorState message={error} onRetry={() => void loadJobs()} />;
 
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">Open dispatch queue</h3>
          <p className="text-sm text-slate-400">Browse customer requests currently available for drivers.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadJobs()}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh jobs
        </Button>
      </div>
 
      <div className="space-y-4">
        {availableJobs.length === 0 ? (
          <EmptyJobsState
            title="Dispatch queue is clear"
            description="There are no unassigned towing requests right now. Check back again soon."
          />
        ) : (
          availableJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actionLabel="Open dispatch"
              onSelect={setSelectedJob}
              onAccept={handleAcceptJob}
              onDecline={handleCancelJob}
            />
          ))
        )}
      </div>
 
      <JobDetailsDialog
        job={selectedJob}
        open={selectedJob !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        onAccept={handleAcceptJob}
      />
    </>
  );
}
 
// ─── DriverMyJobsContent ──────────────────────────────────────────────────────
function DriverMyJobsContent() {
  const { user, myJobs, loading, error, loadJobs, handleCancelJob, handleCompleteJob } = useDriverJobsData();
  const [selectedJob, setSelectedJob] = useState<DriverJob | null>(null);

  if (loading) return <JobsLoadingState />;
  if (error) return <JobsErrorState message={error} onRetry={() => void loadJobs()} />;

  const activeMyJobs = myJobs.filter((job) =>
    ["accepted", "assigned", "in_progress", "in progress"].includes(job.status.toLowerCase())
  );
  const otherMyJobs = myJobs.filter(
    (job) => !["accepted", "assigned", "in_progress", "in progress"].includes(job.status.toLowerCase())
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">My assigned jobs</h3>
          <p className="text-sm text-slate-400">
            Review every request currently connected to your driver account.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadJobs()}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh jobs
        </Button>
      </div>

      <div className="space-y-4">
        {myJobs.length === 0 ? (
          <EmptyJobsState
            title="No jobs assigned yet"
            description="Accepted and directly assigned dispatches will show here once they are linked to your profile."
          />
        ) : (
          <>
            {activeMyJobs.map((job) => (
              <ActiveJobCard
                key={job.id}
                job={job}
                driverId={user?.id ?? null}
                onCancel={handleCancelJob}
                onComplete={handleCompleteJob}
              />
            ))}
            {otherMyJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                actionLabel="View assignment"
                onSelect={setSelectedJob}
                onCancel={handleCancelJob}
              />
            ))}
          </>
        )}
      </div>

      <JobDetailsDialog
        job={selectedJob}
        open={selectedJob !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        onCancel={handleCancelJob}
      />
    </>
  );
}
 
// ─── DriverEarningsContent ────────────────────────────────────────────────────
function DriverEarningsContent() {
  const { completedJobs, totalEarnings, loading, error, loadJobs } = useDriverJobsData();
 
  return (
    <div className="space-y-6">
      {error ? <JobsErrorState message={error} onRetry={() => void loadJobs()} /> : null}
 
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total earnings"
          value={loading ? "..." : formatCurrency(totalEarnings)}
          description="Based on completed driver jobs."
          icon={TrendingUp}
        />
        <MetricCard
          title="Completed jobs"
          value={loading ? "..." : completedJobs.length.toString()}
          description="Closed out service requests linked to you."
          icon={ShieldCheck}
        />
        <MetricCard
          title="Average payout"
          value={
            loading
              ? "..."
              : formatCurrency(completedJobs.length > 0 ? totalEarnings / completedJobs.length : 0)
          }
          description="Average earnings per completed dispatch."
          icon={CreditCard}
        />
      </div>
 
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Earnings breakdown</CardTitle>
            <CardDescription className="text-slate-400">
              Completed assignments and their estimated payout values.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadJobs()}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <JobsLoadingState />
          ) : completedJobs.length === 0 ? (
            <EmptyJobsState
              title="No completed jobs yet"
              description="Your completed dispatches will appear here as soon as jobs are marked complete."
            />
          ) : (
            completedJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{job.serviceType}</p>
                  <p className="text-sm text-slate-400">
                    {job.customerName} • {getJobLocation(job)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Completed {formatDateTime(job.completedAt ?? job.updatedAt ?? job.createdAt)}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <Badge className={getStatusClasses(job.status)}>{job.status}</Badge>
                  <p className="mt-2 text-xl font-semibold text-amber-300">
                    {formatCurrency(getJobAmount(job))}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
 
// ─── DriverSupportContent ─────────────────────────────────────────────────────
function DriverSupportContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>Driver operations support</CardTitle>
          <CardDescription className="text-slate-400">
            Reach out when you need dispatch help or roadside escalation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-medium text-white">Dispatch hotline</p>
            <p className="mt-1 text-slate-400">Call the live operations desk for urgent rerouting.</p>
            <p className="mt-3 text-base font-semibold text-amber-300">+254 700 123 456</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-medium text-white">Incident reporting</p>
            <p className="mt-1 text-slate-400">
              Share customer safety issues, route challenges, or tow vehicle concerns with the support team.
            </p>
          </div>
        </CardContent>
      </Card>
 
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>Before you head out</CardTitle>
          <CardDescription className="text-slate-400">
            Use this checklist for every job assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          {[
            "Verify the customer pickup location before departure.",
            "Confirm your truck fuel level and towing equipment readiness.",
            "Call the customer if the dispatch note mentions an inaccessible route.",
            "Update the admin team immediately if a job cannot be completed safely.",
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
 
// ─── Exports ──────────────────────────────────────────────────────────────────
export function DriverDashboard() {
  return (
    <DashboardLayout
      title="Driver Dashboard"
      subtitle="Manage dispatch availability, active towing jobs, and your earnings."
    >
      <DriverOverviewContent />
    </DashboardLayout>
  );
}
 
export function DriverJobs() {
  return (
    <DashboardLayout
      title="Available Driver Jobs"
      subtitle="Browse open roadside assistance and towing requests."
    >
      <DriverJobsContent />
    </DashboardLayout>
  );
}
 
export function DriverMyJobs() {
  return (
    <DashboardLayout
      title="My Driver Jobs"
      subtitle="Track the requests currently assigned to your account."
    >
      <DriverMyJobsContent />
    </DashboardLayout>
  );
}
 
export function DriverEarnings() {
  return (
    <DashboardLayout
      title="Driver Earnings"
      subtitle="Review payouts from completed dispatches."
    >
      <DriverEarningsContent />
    </DashboardLayout>
  );
}
 
export function DriverSupport() {
  return (
    <DashboardLayout
      title="Driver Support"
      subtitle="Get help from dispatch and review field-readiness guidance."
    >
      <DriverSupportContent />
    </DashboardLayout>
  );
}