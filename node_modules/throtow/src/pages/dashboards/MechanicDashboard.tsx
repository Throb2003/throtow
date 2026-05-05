import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  CalendarClock,
  CreditCard,
  Gauge,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  Wrench,
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
import { listAvailableJobs, listMyJobs, setAvailability } from "@/services/supabaseData";
import { supabase } from "@/lib/supabase";
import type { Job, LocationPoint } from "@/types/app";

type MechanicJob = Job & {
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
  destination?: LocationPoint | string | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getJobAmount(job: MechanicJob) {
  return Number(job.amount ?? job.price ?? job.estimatedPrice ?? 0);
}

function getLocationLabel(location?: LocationPoint | string | null) {
  if (!location) {
    return "Location pending";
  }

  if (typeof location === "string") {
    return location;
  }

  if (location.address) {
    return location.address;
  }

  return `Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}`;
}

function getJobLocation(job: MechanicJob) {
  return getLocationLabel(job.location ?? job.requestLocation ?? null);
}

function getDestinationLabel(job: MechanicJob) {
  return getLocationLabel(job.destination ?? null);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

function getStatusClasses(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "completed") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (normalizedStatus === "pending") {
    return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  }

  if (normalizedStatus === "accepted" || normalizedStatus === "assigned") {
    return "border-violet-500/20 bg-violet-500/10 text-violet-300";
  }

  if (normalizedStatus === "in_progress" || normalizedStatus === "in progress") {
    return "border-blue-500/20 bg-blue-500/10 text-blue-300";
  }

  if (normalizedStatus === "cancelled") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  }

  return "border-slate-700 bg-slate-800 text-slate-300";
}

function JobsLoadingState() {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
      <CardContent className="flex items-center gap-3 p-6 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading mechanic jobs...
      </CardContent>
    </Card>
  );
}

function JobsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-rose-500/20 bg-rose-500/10 text-rose-100">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">Unable to load mechanic jobs</p>
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

function EmptyJobsState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed border-slate-800 bg-slate-900/50 text-slate-50">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full border border-slate-800 bg-slate-900 p-3">
          <Wrench className="h-5 w-5 text-cyan-300" />
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
  icon: typeof Wrench;
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
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-300">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobDetailsDialog({
  job,
  open,
  onOpenChange,
}: {
  job: MechanicJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
                Inspect the service notes and travel details before heading to site.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">Customer details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-cyan-300" />
                    <span>{job.customerName}</span>
                  </div>
                  {job.customerPhone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-cyan-300" />
                      <span>{job.customerPhone}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-cyan-300" />
                    <span>{formatCurrency(getJobAmount(job))}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">Travel details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <span>{getJobLocation(job)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gauge className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <span>{getDestinationLabel(job)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-cyan-300" />
                    <span>{formatDateTime(job.createdAt ?? job.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
              <CardHeader>
                <CardTitle className="text-base">Repair notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <p>{job.description || "No additional mechanic notes were provided."}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-700 bg-slate-800 text-slate-200">
                    Diagnosis first
                  </Badge>
                  <Badge className="border-slate-700 bg-slate-800 text-slate-200">
                    Parts confirmation on-site
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function JobCard({
  job,
  actionLabel,
  onSelect,
}: {
  job: MechanicJob;
  actionLabel: string;
  onSelect: (job: MechanicJob) => void;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50 transition-colors hover:border-cyan-500/20">
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
            <p className="text-xl font-semibold text-cyan-300">{formatCurrency(getJobAmount(job))}</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</p>
            <p className="mt-2 font-medium text-white">{job.customerName}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Service area</p>
            <p className="mt-2">{getJobLocation(job)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Updated</p>
            <p className="mt-2">{formatDateTime(job.updatedAt ?? job.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            Bring diagnostics tools and customer-safe repair gear
          </div>
          <Button
            onClick={() => onSelect(job)}
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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

function useMechanicJobsData() {
  const { user, updateUser } = useAuth();
  const [availableJobs, setAvailableJobs] = useState<MechanicJob[]>([]);
  const [myJobs, setMyJobs] = useState<MechanicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!user?.id) {
      setAvailableJobs([]);
      setMyJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [available, mine] = await Promise.all([
        listAvailableJobs("mechanic"),
        listMyJobs(user.id, "mechanic"),
      ]);

      setAvailableJobs(available as MechanicJob[]);
      setMyJobs(mine as MechanicJob[]);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load mechanic jobs.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const toggleAvailability = useCallback(async () => {
    if (typeof user?.isOnline !== "boolean") {
      return;
    }

    setAvailabilitySaving(true);
    setError(null);

    try {
      const updatedProfile = await setAvailability(!user.isOnline);
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
  }, [updateUser, user?.isOnline]);

  const activeJobs = myJobs.filter((job) =>
    ["accepted", "assigned", "in_progress", "in progress"].includes(job.status.toLowerCase())
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
  };
}

// ─── MechanicRatingsPanel ─────────────────────────────────────────────────────
type RatingRow = {
  id: string;
  mechanicRating: number | null;
  review: string | null;
  createdAt: string;
};

function MechanicRatingsPanel({ mechanicId }: { mechanicId: string }) {
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mechanicId) return;
    setLoading(true);
    void supabase
      .from("ratings")
      .select("id, mechanic_rating, review, created_at")
      .eq("mechanic_id", mechanicId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRatings(
          (data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id ?? ""),
            mechanicRating: r.mechanic_rating != null ? Number(r.mechanic_rating) : null,
            review: typeof r.review === "string" ? r.review : null,
            createdAt: String(r.created_at ?? ""),
          }))
        );
      })
      .then(() => setLoading(false))
.catch(() => setLoading(false));
  }, [mechanicId]);

  const avg = ratings.length > 0
    ? (ratings.reduce((s, r) => s + (r.mechanicRating ?? 0), 0) / ratings.length).toFixed(1)
    : null;

  return (
    <Card className="border-slate-800 bg-slate-900/70 text-slate-50 mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-cyan-400 fill-cyan-400" />
            Customer Reviews
          </CardTitle>
          {avg && (
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 text-sm font-semibold text-cyan-300">
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
                          s <= (r.mechanicRating ?? 0)
                            ? "fill-cyan-400 text-cyan-400"
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

function MechanicOverviewContent() {
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
  } = useMechanicJobsData();
  const [selectedJob, setSelectedJob] = useState<MechanicJob | null>(null);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Mechanic status</p>
          <h3 className="text-xl font-semibold text-white">
            {user?.isOnline ? "You are ready for field diagnostics" : "You are currently offline"}
          </h3>
          <p className="text-sm text-slate-400">
            Turn online when you are available for inspections, jump starts, and roadside repairs.
          </p>
        </div>
        <AvailabilityButton
          isOnline={Boolean(user?.isOnline)}
          loading={availabilitySaving}
          onToggle={() => void toggleAvailability()}
        />
      </div>

      {error ? (
        <div className="mb-6">
          <JobsErrorState message={error} onRetry={() => void loadJobs()} />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Available jobs"
          value={loading ? "..." : availableJobs.length.toString()}
          description="Open repair and diagnostics requests near you."
          icon={Briefcase}
        />
        <MetricCard
          title="Active jobs"
          value={loading ? "..." : activeJobs.length.toString()}
          description="Accepted or in-progress mechanic callouts."
          icon={Wrench}
        />
        <MetricCard
          title="Completed jobs"
          value={loading ? "..." : completedJobs.length.toString()}
          description="Resolved service requests marked complete."
          icon={ShieldCheck}
        />
        <MetricCard
          title="Total earnings"
          value={loading ? "..." : formatCurrency(totalEarnings)}
          description="Estimated from completed mechanic assignments."
          icon={TrendingUp}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Available service calls</CardTitle>
              <CardDescription className="text-slate-400">
                Customer requests awaiting mechanic support.
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
                title="No mechanic jobs available"
                description="Stay online and keep your dashboard open to catch the next diagnostics request."
              />
            ) : (
              availableJobs.slice(0, 3).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  actionLabel="View details"
                  onSelect={setSelectedJob}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle>Current repair queue</CardTitle>
            <CardDescription className="text-slate-400">
              Track the assignments already linked to your mechanic profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <JobsLoadingState />
            ) : activeJobs.length === 0 ? (
              <EmptyJobsState
                title="No active assignments"
                description="Accepted diagnostics and repair jobs will show here once they are connected to you."
              />
            ) : (
              activeJobs.slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{job.customerName}</p>
                      <p className="text-sm text-slate-400">{job.serviceType}</p>
                    </div>
                    <Badge className={getStatusClasses(job.status)}>{job.status}</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-cyan-300" />
                      <span>{getJobLocation(job)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{formatDateTime(job.updatedAt ?? job.createdAt)}</span>
                      <span className="font-medium text-cyan-300">
                        {formatCurrency(getJobAmount(job))}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <JobDetailsDialog
        job={selectedJob}
        open={Boolean(selectedJob)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
          }
        }}
      />

      {/* ── Customer reviews panel ─────────────────────── */}
      {user?.id && <MechanicRatingsPanel mechanicId={user.id} />}
    </>
  );
}

function MechanicJobsContent() {
  const { availableJobs, loading, error, loadJobs } = useMechanicJobsData();
  const [selectedJob, setSelectedJob] = useState<MechanicJob | null>(null);

  if (loading) {
    return <JobsLoadingState />;
  }

  if (error) {
    return <JobsErrorState message={error} onRetry={() => void loadJobs()} />;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">Open mechanic queue</h3>
          <p className="text-sm text-slate-400">
            Browse diagnostics, battery, puncture, and repair requests ready for assignment.
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
        {availableJobs.length === 0 ? (
          <EmptyJobsState
            title="Service queue is clear"
            description="There are no open mechanic requests right now. Check again after new customer requests come in."
          />
        ) : (
          availableJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actionLabel="Open job"
              onSelect={setSelectedJob}
            />
          ))
        )}
      </div>

      <JobDetailsDialog
        job={selectedJob}
        open={Boolean(selectedJob)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
          }
        }}
      />
    </>
  );
}

function MechanicMyJobsContent() {
  const { myJobs, loading, error, loadJobs } = useMechanicJobsData();
  const [selectedJob, setSelectedJob] = useState<MechanicJob | null>(null);

  if (loading) {
    return <JobsLoadingState />;
  }

  if (error) {
    return <JobsErrorState message={error} onRetry={() => void loadJobs()} />;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">My mechanic jobs</h3>
          <p className="text-sm text-slate-400">
            Review the assignments currently attached to your mechanic account.
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
            description="Once you accept or receive a mechanic callout, it will appear in this list."
          />
        ) : (
          myJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actionLabel="View assignment"
              onSelect={setSelectedJob}
            />
          ))
        )}
      </div>

      <JobDetailsDialog
        job={selectedJob}
        open={Boolean(selectedJob)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
          }
        }}
      />
    </>
  );
}

function MechanicEarningsContent() {
  const { completedJobs, totalEarnings, loading, error, loadJobs } = useMechanicJobsData();

  return (
    <div className="space-y-6">
      {error ? <JobsErrorState message={error} onRetry={() => void loadJobs()} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total earnings"
          value={loading ? "..." : formatCurrency(totalEarnings)}
          description="Based on completed mechanic assignments."
          icon={TrendingUp}
        />
        <MetricCard
          title="Completed jobs"
          value={loading ? "..." : completedJobs.length.toString()}
          description="Resolved diagnostics and repair visits."
          icon={ShieldCheck}
        />
        <MetricCard
          title="Average payout"
          value={
            loading
              ? "..."
              : formatCurrency(
                  completedJobs.length > 0 ? totalEarnings / completedJobs.length : 0
                )
          }
          description="Average earnings per completed service call."
          icon={CreditCard}
        />
      </div>

      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Earnings breakdown</CardTitle>
            <CardDescription className="text-slate-400">
              Completed mechanic jobs and their estimated payout.
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
              description="Completed repairs and diagnostics will appear here once jobs are marked complete."
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
                  <p className="mt-2 text-xl font-semibold text-cyan-300">
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

function MechanicSupportContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>Mechanic support desk</CardTitle>
          <CardDescription className="text-slate-400">
            Contact the operations team for diagnostics escalation and parts coordination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-medium text-white">Technical hotline</p>
            <p className="mt-1 text-slate-400">
              Call for repair verification, replacement parts questions, or service re-routing.
            </p>
            <p className="mt-3 text-base font-semibold text-cyan-300">+254 711 654 321</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-medium text-white">Field reporting</p>
            <p className="mt-1 text-slate-400">
              Escalate severe mechanical faults, unsafe job conditions, or parts shortages to the admin team.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
        <CardHeader>
          <CardTitle>On-site checklist</CardTitle>
          <CardDescription className="text-slate-400">
            Best-practice reminders for each mechanic dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          {[
            "Review customer notes and likely fault symptoms before leaving.",
            "Carry essential diagnostics equipment and safety gear.",
            "Document any parts or towing escalation required after inspection.",
            "Communicate clearly if the vehicle needs workshop transfer instead of roadside repair.",
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

export function MechanicDashboard() {
  return (
    <DashboardLayout
      title="Mechanic Dashboard"
      subtitle="Manage roadside repair availability, active jobs, and earnings."
    >
      <MechanicOverviewContent />
    </DashboardLayout>
  );
}

export function MechanicJobs() {
  return (
    <DashboardLayout
      title="Available Mechanic Jobs"
      subtitle="Browse repair and diagnostics requests waiting for a mechanic."
    >
      <MechanicJobsContent />
    </DashboardLayout>
  );
}

export function MechanicMyJobs() {
  return (
    <DashboardLayout
      title="My Mechanic Jobs"
      subtitle="Track the repair jobs currently connected to your profile."
    >
      <MechanicMyJobsContent />
    </DashboardLayout>
  );
}

export function MechanicEarnings() {
  return (
    <DashboardLayout
      title="Mechanic Earnings"
      subtitle="Review estimated payouts from completed service calls."
    >
      <MechanicEarningsContent />
    </DashboardLayout>
  );
}

export function MechanicSupport() {
  return (
    <DashboardLayout
      title="Mechanic Support"
      subtitle="Get technical assistance and review field-readiness guidance."
    >
      <MechanicSupportContent />
    </DashboardLayout>
  );
}