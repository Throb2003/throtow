import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Navigation,   
  Navigation2,
  Phone,
  RefreshCw,
  Route,
  Shield,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
 
import LocationPickerMap from '@/components/maps/LocationPickerMap';
import ServiceRequestMap from '@/components/maps/ServiceRequestMap';
import LiveTrackingMap from '@/components/maps/LiveTrackingMap';
import ServiceLocationMap from '@/components/maps/ServiceLocationMap';
import RequestChatPanel from '@/components/chat/RequestChatPanel';
import { useWatchDriverLocation } from '@/hooks/useDriverLocation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { initiateMpesaStkPush } from '@/services/mpesa';
import {
  cancelCustomerRequest,
  createCustomerRequest,
  getPricingSettings,
  listCustomerRequests,
  listPayments,
  setUserOnlineStatus,
} from '@/services/supabaseData';
import { useRealtimeTable } from '@/hooks/useRealtime';
import { supabase } from '@/lib/supabase';
import type {
  CreateServiceRequestInput,
  LocationPoint,
  PaymentRecord,
  PaymentStatus,
  ServiceRequest,
} from '@/types/app';
 
type PageSection = 'overview' | 'requests' | 'payments' | 'support';
 
const serviceOptions = [
  { value: 'towing', label: 'Towing' },
  { value: 'repair', label: 'Mechanical repair' },
  { value: 'battery', label: 'Battery assistance' },
  { value: 'fuel', label: 'Fuel delivery' },
  { value: 'rescue', label: 'Emergency roadside support' },
];
 
// ─── Reverse geocode lat/lng → human readable address via OpenStreetMap ─────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json() as {
      display_name?: string;
      address?: {
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        building?: string;
        house_number?: string;
      };
    };
    if (data.address) {
      const a = data.address;
      const parts = [
        a.building,
        a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
        a.neighbourhood ?? a.suburb,
        a.city ?? a.town,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ─── Hook: watch the customer's live GPS position ─────────────────────────────
type LiveLocationState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'active'; lat: number; lng: number; accuracy: number; address: string }
  | { status: 'error'; message: string };

function useCustomerLiveLocation() {
  const [state, setState] = useState<LiveLocationState>({ status: 'idle' });
  const watchIdRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: 'error', message: 'Geolocation is not supported by your browser.' });
      return;
    }
    setState({ status: 'requesting' });
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setState({ status: 'active', lat, lng, accuracy, address: '' });
        void reverseGeocode(lat, lng).then((address) =>
          setState((prev) =>
            prev.status === 'active' ? { ...prev, address } : prev,
          ),
        );
      },
      (err) => {
        const messages: Record<number, string> = {
          1: 'Location access denied. Please allow location in your browser settings.',
          2: 'Could not determine your position. Check your GPS signal.',
          3: 'Location request timed out. Please try again.',
        };
        setState({ status: 'error', message: messages[err.code] ?? 'Location error.' });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState({ status: 'idle' });
  }, []);

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  return { state, start, stop };
}

// ─── Widget: live location card shown in the Overview sidebar ─────────────────
function LiveLocationWidget({
  onUseLocation,
}: {
  onUseLocation?: (loc: LocationPoint) => void;
}) {
  const { state, start, stop } = useCustomerLiveLocation();

  const handleUse = () => {
    if (state.status === 'active' && onUseLocation) {
      onUseLocation({
        lat: state.lat,
        lng: state.lng,
        address: state.address || `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`,
      });
    }
  };

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`rounded-full p-2 ${
            state.status === 'active' ? 'bg-sky-500/15'
            : state.status === 'error' ? 'bg-rose-500/15'
            : 'bg-white/5'
          }`}>
            <Navigation2 className={`h-4 w-4 ${
              state.status === 'active' ? 'text-sky-400'
              : state.status === 'error' ? 'text-rose-400'
              : 'text-slate-400'
            }`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Live Location</p>
            <p className="text-xs text-slate-500">Real-time GPS tracking</p>
          </div>
        </div>
        {state.status === 'active' && (
          <span className="flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-medium text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Live
          </span>
        )}
        {state.status === 'requesting' && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Locating…
          </span>
        )}
        {state.status === 'error' && (
          <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-xs text-rose-300">
            Error
          </span>
        )}
      </div>

      {state.status === 'active' && (
        <div className="rounded-xl border border-sky-500/10 bg-sky-500/5 px-3 py-2.5 space-y-1">
          <p className="text-xs font-mono text-sky-300">
            {state.lat.toFixed(6)}, {state.lng.toFixed(6)}
          </p>
          {state.address && (
            <p className="text-xs text-slate-400 leading-relaxed">📍 {state.address}</p>
          )}
          <p className="text-xs text-slate-600">Accuracy ±{Math.round(state.accuracy)}m</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          {state.message}
        </div>
      )}

      <div className="flex gap-2">
        {(state.status === 'idle' || state.status === 'error') && (
          <button
            onClick={start}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-400 transition"
          >
            <Navigation className="h-3.5 w-3.5" />
            Start tracking
          </button>
        )}
        {state.status === 'requesting' && (
          <button disabled className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-500/40 px-3 py-2 text-xs font-semibold text-white/50 cursor-not-allowed">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Getting location…
          </button>
        )}
        {state.status === 'active' && (
          <>
            {onUseLocation && (
              <button
                onClick={handleUse}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 transition"
              >
                <MapPin className="h-3.5 w-3.5" />
                Use for request
              </button>
            )}
            <button
              onClick={stop}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
            >
              <X className="h-3.5 w-3.5" />
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Hook: resolve a LocationPoint address via reverse geocode ────────────────
function useResolvedAddress(point: { lat: number; lng: number } | null): string {
  const [address, setAddress] = useState<string>('');
  useEffect(() => {
    if (!point) { setAddress(''); return; }
    // Show coordinates immediately, then replace with geocoded name
    setAddress(`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
    void reverseGeocode(point.lat, point.lng).then(setAddress);
  }, [point?.lat, point?.lng]);
  return address;
}

// ─── Haversine distance between two lat/lng points (returns km) ───────────────
function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const x =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Calculate estimated price from pricing config + service type + distance ──
function calculateEstimatedPrice(
  serviceType: string,
  pricing: Record<string, unknown>,
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number } | null,
): number {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const svc = serviceType.toLowerCase();

  // Flat-rate services
  if (svc === 'battery') return num(pricing.batteryJumpstartRate, 800);
  if (svc === 'fuel') return num(pricing.fuelDeliveryRate, 500);
  if (svc === 'repair') return num(pricing.mechanicInspectionRate, 1800);
  if (svc === 'rescue') return num(pricing.lockoutRate, 1500);

  // Towing — base rate + per-km charge if destination is provided
  const baseRate = num(pricing.towBaseRate, 2500);
  const ratePerKm = num(pricing.towRatePerKm, 300);

  if (svc === 'towing' && from && to) {
    const distKm = haversineDistanceKm(from, to);
    return Math.round(baseRate + distKm * ratePerKm);
  }

  return baseRate;
}

const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});
 
const dateFormatter = new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
 
const readRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
 
  return {};
};
 
const getStringValue = (value: unknown, fallback = '—') => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
 
  return fallback;
};
 
const getOptionalStringValue = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : undefined;
 
const getNumberValue = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
 
  if (typeof value === 'string') {
    const parsed = Number(value);
 
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
 
  return fallback;
};
 
const getDateLabel = (value: unknown) => {
  if (typeof value !== 'string' || !value) {
    return '—';
  }
 
  const date = new Date(value);
 
  if (Number.isNaN(date.getTime())) {
    return value;
  }
 
  return dateFormatter.format(date);
};
 
const getLocationValue = (value: unknown): LocationPoint | null => {
  const record = readRecord(value);
  const lat = getNumberValue(record.lat ?? record.latitude, Number.NaN);
  const lng = getNumberValue(record.lng ?? record.longitude, Number.NaN);
 
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
 
  return {
    lat,
    lng,
    address:
      getOptionalStringValue(record.address) ??
      `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`,
  };
};
 
const getRequestLocation = (request: ServiceRequest) => {
  const record = readRecord(request);
 
  return (
    getLocationValue(record.location) ??
    getLocationValue(record.requestLocation) ??
    getLocationValue(record.pickupLocation) ??
    getLocationValue(record.pickup_location)
  );
};
 
const getDestinationLocation = (request: ServiceRequest) => {
  const record = readRecord(request);
 
  return (
    getLocationValue(record.destination) ??
    getLocationValue(record.destinationLocation) ??
    getLocationValue(record.destination_location)
  );
};
 
const getRequestId = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getStringValue(record.id ?? record.requestId ?? record.reference, 'unknown-request');
};
 
const getRequestStatus = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getStringValue(record.status, 'pending');
};
 
const getRequestServiceType = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getStringValue(record.serviceType ?? record.service_type ?? record.category, 'Service');
};
 
const getRequestDescription = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getStringValue(
    record.description ?? record.issueDescription ?? record.issue_description ?? record.notes,
    'No details provided.',
  );
};
 
const getRequestCreatedAt = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getDateLabel(record.createdAt ?? record.created_at ?? record.requestedAt ?? record.updatedAt);
};
 
const getRequestAmount = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getNumberValue(record.amount ?? record.totalAmount ?? record.estimatedAmount ?? record.price, 0);
};
 
const getRequestPaymentStatus = (request: ServiceRequest) => {
  const record = readRecord(request);
  return getStringValue(record.paymentStatus ?? record.payment_status ?? record.status, 'pending');
};

const getAssignedDriverId = (request: ServiceRequest) => {
  const record = readRecord(request);

  return (
    getOptionalStringValue(
      record.assignedTo ?? record.assigned_to ?? record.driverId ?? record.driver_id ?? record.provider_id,
    ) ?? null
  );
};
 
const getPaymentId = (payment: PaymentRecord) => {
  const record = readRecord(payment);
  return getStringValue(record.id ?? record.paymentId ?? record.reference, 'payment');
};
 
const getPaymentAmount = (payment: PaymentRecord) => {
  const record = readRecord(payment);
  return getNumberValue(record.amount ?? record.totalAmount ?? record.total, 0);
};
 
const getPaymentStatus = (payment: PaymentRecord) => {
  const record = readRecord(payment);
  return getStringValue(record.status, 'pending') as PaymentStatus | string;
};
 
const getPaymentDate = (payment: PaymentRecord) => {
  const record = readRecord(payment);
  return getDateLabel(record.createdAt ?? record.created_at ?? record.updatedAt);
};
 
const getPaymentReference = (payment: PaymentRecord) => {
  const record = readRecord(payment);
  return getStringValue(record.reference ?? record.receiptNumber ?? record.transactionId, 'Pending reference');
};
 
const getPaymentRequestId = (payment: PaymentRecord) => {
  const record = readRecord(payment);
  return getOptionalStringValue(record.requestId ?? record.request_id ?? record.serviceRequestId);
};
 
const getStatusClasses = (status: string) => {
  const normalized = status.toLowerCase();
 
  if (['completed', 'paid', 'success'].includes(normalized)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
 
  if (['in_progress', 'in-progress', 'accepted', 'assigned', 'processing'].includes(normalized)) {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  }
 
  if (['cancelled', 'failed', 'rejected'].includes(normalized)) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  }
 
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
};
 
// ─── Payment Prompt Popup ─────────────────────────────────────────────────────
// Fires automatically when the driver marks a job complete.
// Watches service_requests for status → "completed" for this customer's jobs.
function PaymentPromptPopup({
  customerId,
  customerPhone,
}: {
  customerId: string;
  customerPhone?: string;
}) {
 const [pendingPayment, setPendingPayment] = useState<{
    requestId: string;
    serviceType: string;
    amount: number;
  } | null>(null);
  const [paying, setPaying] = useState(false);
  const [payFeedback, setPayFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('mpesa');

  // ── Helper: check for completed unpaid requests ─────────────────────────
  const checkForCompletedJobs = useCallback(async () => {
    if (!customerId) return;
    const { data } = await supabase
      .from('service_requests')
      .select('id, status, payment_status, price, amount, estimated_price, service_type')
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .not('payment_status', 'in', '("paid","success","cancelled")')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      const amount = Number(row.price ?? row.amount ?? row.estimated_price ?? 0);
      const serviceType = typeof row.service_type === 'string' ? row.service_type : 'Service';
      const requestId = typeof row.id === 'string' ? row.id : '';
      // Only show if not already showing this one
      setPendingPayment((prev) => {
        if (prev?.requestId === requestId) return prev;
        setPayFeedback(null);
        return { requestId, serviceType, amount };
      });
    }
  }, [customerId]);

  // ── Realtime listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel(`payment-prompt:${customerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_requests',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const status = typeof row.status === 'string' ? row.status : '';
          const payStatus = typeof row.payment_status === 'string' ? row.payment_status : '';
          if (status === 'completed' && !['paid', 'success', 'cancelled'].includes(payStatus)) {
            const amount = Number(row.price ?? row.amount ?? row.estimated_price ?? 0);
            const serviceType = typeof row.service_type === 'string' ? row.service_type : 'Service';
            const requestId = typeof row.id === 'string' ? row.id : '';
            setPendingPayment({ requestId, serviceType, amount });
            setPayFeedback(null);
          }
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [customerId]);

  // ── Polling fallback — checks every 8 seconds in case realtime misses it ─
  useEffect(() => {
    if (!customerId) return;
    // Check immediately on mount
    void checkForCompletedJobs();
    // Then poll every 8 seconds
    const interval = setInterval(() => void checkForCompletedJobs(), 8000);
    return () => clearInterval(interval);
  }, [customerId, checkForCompletedJobs]);

  const handlePay = async () => {
    if (!pendingPayment) return;
    setPaying(true);
    setPayFeedback(null);
    try {
      if (paymentMethod === 'cash') {
        // Cash payment — just mark as paid and close
        await supabase
          .from('service_requests')
          .update({ payment_status: 'paid', payment_method: 'cash' })
          .eq('id', pendingPayment.requestId);
        setPayFeedback({ ok: true, msg: 'Cash payment recorded! Thank you.' });
        setTimeout(() => setPendingPayment(null), 2000);
      } else {
        // M-Pesa payment
        if (!customerPhone) {
          setPayFeedback({ ok: false, msg: 'No phone number on your account — please add one.' });
          return;
        }
        await initiateMpesaStkPush({
          amount: pendingPayment.amount,
          phoneNumber: customerPhone,
          requestId: pendingPayment.requestId,
          accountReference: pendingPayment.requestId,
          transactionDesc: `${pendingPayment.serviceType} payment`,
        } as Parameters<typeof initiateMpesaStkPush>[0]);
        setPayFeedback({ ok: true, msg: 'M-Pesa prompt sent! Check your phone to complete payment.' });
      }
    } catch (err) {
      setPayFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'Payment failed. Please try again.',
      });
    } finally {
      setPaying(false);
    }
  };

  if (!pendingPayment) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-emerald-500/30 bg-slate-950 shadow-2xl shadow-emerald-500/10 p-6 space-y-5">
        {/* Close */}
        <button
          onClick={() => setPendingPayment(null)}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-500/15 p-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Service complete!</h2>
            <p className="text-sm text-slate-400">Your driver has finished the job.</p>
          </div>
        </div>

        {/* Amount */}
        {/* Amount */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {pendingPayment.serviceType} — Amount due
          </p>
          <p className="text-4xl font-bold text-amber-300">
            {currencyFormatter.format(pendingPayment.amount)}
          </p>
          <p className="text-xs text-slate-500">
            Choose your payment method below.
          </p>
        </div>

        {/* Payment Method Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentMethod('mpesa')}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              paymentMethod === 'mpesa'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
            }`}
          >
            📱 M-Pesa
          </button>
          <button
            onClick={() => setPaymentMethod('cash')}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              paymentMethod === 'cash'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
            }`}
          >
            💵 Cash
          </button>
        </div>

        {/* Feedback */}
        {payFeedback ? (
          <div className={`rounded-2xl px-4 py-3 text-sm ${
            payFeedback.ok
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
          }`}>
            {payFeedback.msg}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => setPendingPayment(null)}
          >
            Pay later
          </Button>
         <Button
            className={`flex-1 font-semibold text-white ${
              paymentMethod === 'cash'
                ? 'bg-amber-500 hover:bg-amber-400'
                : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
            onClick={() => void handlePay()}
            disabled={paying || pendingPayment.amount <= 0}
          >
            {paying ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
            ) : paymentMethod === 'cash' ? (
              <>💵 Confirm Cash Payment</>
            ) : (
              <><CreditCard className="mr-2 h-4 w-4" />Pay with M-Pesa</>
            )}
          </Button>
        </div>

       {paymentMethod === 'mpesa' && !customerPhone && (
          <p className="text-xs text-center text-rose-300">
            No phone number on your account — please add one to enable M-Pesa payments.
          </p>
        )}
      </div>
    </div>
  );
}

function CustomerShell({
  activeSection,
  children,
}: {
  activeSection: PageSection;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const customerId =
    user && typeof user === 'object' && 'id' in user && user.id ? String(user.id) : '';
  const customerPhone = typeof user?.phone === 'string' ? user.phone : undefined;

  const navigation = [
    { label: 'Overview', href: '/customer', section: 'overview' as const },
    { label: 'Requests', href: '/customer/requests', section: 'requests' as const },
    { label: 'Payments', href: '/customer/payments', section: 'payments' as const },
    { label: 'Support', href: '/customer/support', section: 'support' as const },
  ];
 
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-300">Customer dashboard</p>
              <h1 className="text-3xl font-semibold text-white">Manage requests, tracking, and payments</h1>
              <p className="max-w-2xl text-sm text-slate-300">
                Create a new service request with a precise map location, monitor progress, and
                complete M-Pesa payments once service is complete.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {navigation.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant={activeSection === item.section ? 'default' : 'outline'}
                  className={
                    activeSection === item.section
                      ? 'bg-sky-500 text-white hover:bg-sky-400'
                      : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                  }
                >
                  <Link to={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
 
        {children}
      </div>

      {/* 🔔 Global payment popup — fires when driver completes a job */}
      <PaymentPromptPopup customerId={customerId} customerPhone={customerPhone} />
    </div>
  );
}
 
function useCustomerData() {
  const { user } = useAuth();
  const customerId =
    user && typeof user === 'object' && 'id' in user && user.id
      ? String(user.id)
      : '';
 
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [pricingSettings, setPricingSettings] = useState<Record<string, unknown> | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
 
  const loadRequests = useCallback(async () => {
    if (!customerId) {
      setRequests([]);
      setRequestsError('Unable to load requests until your customer account is available.');
      setRequestsLoading(false);
      return;
    }
 
    setRequestsLoading(true);
    setRequestsError(null);
 
    try {
      const data = await listCustomerRequests(customerId);
      setRequests(data);
    } catch (error) {
      setRequestsError(error instanceof Error ? error.message : 'Failed to load your requests.');
    } finally {
      setRequestsLoading(false);
    }
  }, [customerId]);
 
  const loadPayments = useCallback(async () => {
    if (!customerId) {
      setPayments([]);
      setPaymentsError('Unable to load payments until your customer account is available.');
      setPaymentsLoading(false);
      return;
    }
 
    setPaymentsLoading(true);
    setPaymentsError(null);
 
    try {
      const data = await listPayments(customerId);
      setPayments(data);
    } catch (error) {
      setPaymentsError(error instanceof Error ? error.message : 'Failed to load your payments.');
    } finally {
      setPaymentsLoading(false);
    }
  }, [customerId]);
 
  const cancelRequest = useCallback(
    async (requestId: string) => {
      await cancelCustomerRequest(requestId);
      await loadRequests();
      await loadPayments();
    },
    [loadPayments, loadRequests],
  );
 
  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingError(null);
 
    try {
      const data = await getPricingSettings();
      setPricingSettings(readRecord(data));
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : 'Failed to load pricing settings.');
    } finally {
      setPricingLoading(false);
    }
  }, []);
 
  useEffect(() => {
    void loadRequests();
    void loadPayments();
    void loadPricing();
  }, [loadRequests, loadPayments, loadPricing]);

  // 🟢 Auto set customer online when dashboard loads
  useEffect(() => {
    if (!customerId) return;

    void setUserOnlineStatus(customerId, true);

    const handleOffline = () => void setUserOnlineStatus(customerId, false);
    window.addEventListener("beforeunload", handleOffline);

    const handleVisibility = () => {
      if (document.hidden) {
        void setUserOnlineStatus(customerId, false);
      } else {
        void setUserOnlineStatus(customerId, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      void setUserOnlineStatus(customerId, false);
    };
  }, [customerId]);
 
  // 🔴 REALTIME — auto-refresh when driver accepts/updates this customer's request
  useRealtimeTable(
    'service_requests',
    () => { void loadRequests(); },
  );
 
  // 🔔 REALTIME — auto-refresh when a new notification arrives for this customer
  useRealtimeTable(
    'notifications',
    () => { void loadRequests(); void loadPayments(); },
  );
 
  return {
    user,
    customerId,
    requests,
    payments,
    pricingSettings,
    requestsLoading,
    paymentsLoading,
    pricingLoading,
    requestsError,
    paymentsError,
    pricingError,
    refreshRequests: loadRequests,
    refreshPayments: loadPayments,
    cancelRequest,
  };
}
 
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 py-12 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-slate-200">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">{description}</p>
    </div>
  );
}
 
function NewRequestForm({
  customerId,
  onCreated,
  customerPhone,
  pricingSettings,
}: {
  customerId: string;
  onCreated: () => Promise<void> | void;
  customerPhone?: string;
  pricingSettings: Record<string, unknown> | null;
}) {
  const [serviceType, setServiceType] = useState(serviceOptions[0].value);
  const [description, setDescription] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [contactPhone, setContactPhone] = useState(customerPhone ?? '');
  const [notes, setNotes] = useState('');
  const [requestLocation, setRequestLocation] = useState<LocationPoint | null>(null);
const { state: liveLocState, start: startLiveLoc, stop: stopLiveLoc } = useCustomerLiveLocation();
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const resolvedPickupAddress = useResolvedAddress(requestLocation);
  const resolvedDestinationAddress = useResolvedAddress(destination);
 
  useEffect(() => {
    if (customerPhone) {
      setContactPhone(customerPhone);
    }
  }, [customerPhone]);

  // ✅ ADD — receives the location broadcast from the sidebar widget
  useEffect(() => {
    const handler = (e: Event) => {
      const loc = (e as CustomEvent<LocationPoint>).detail;
      if (loc) setRequestLocation(loc);
    };
    window.addEventListener('prefill_location', handler);
    const stored = sessionStorage.getItem('prefill_location');
    if (stored) {
      try {
        const loc = JSON.parse(stored) as LocationPoint;
        setRequestLocation(loc);
        sessionStorage.removeItem('prefill_location');
      } catch { /* ignore */ }
    }
    return () => window.removeEventListener('prefill_location', handler);
  }, []);
 
  const estimatedPricePreview = useMemo(
    () =>
      pricingSettings
        ? calculateEstimatedPrice(serviceType, pricingSettings, requestLocation, destination)
        : null,
    [pricingSettings, serviceType, requestLocation, destination],
  );

  const distanceKm = useMemo(
    () =>
      requestLocation && destination
        ? haversineDistanceKm(requestLocation, destination)
        : null,
    [requestLocation, destination],
  );
 
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
 
    if (!requestLocation) {
      setFeedback({
        type: 'error',
        message: 'Please select the service location on the map before submitting.',
      });
      return;
    }
 
    setSubmitting(true);
    setFeedback(null);
 
    try {
      const estimatedPrice = calculateEstimatedPrice(
        serviceType,
        pricingSettings ?? {},
        requestLocation,
        destination,
      );

      const payload = {
        serviceType,
        service_type: serviceType,
        description,
        issueDescription: description,
        issue_description: description,
        vehicleDetails,
        vehicle_details: vehicleDetails,
        contactPhone,
        phoneNumber: contactPhone,
        customerPhone: contactPhone,
        notes,
        location: requestLocation,
        requestLocation: requestLocation,
        pickupLocation: requestLocation,
        destination,
        destinationLocation: destination,
        price: estimatedPrice,
        estimatedPrice,
      } as unknown as CreateServiceRequestInput;
 
      await createCustomerRequest(customerId, payload);
 
      setFeedback({
        type: 'success',
        message: 'Your service request has been submitted successfully.',
      });
 
      setDescription('');
      setVehicleDetails('');
      setNotes('');
      setDestination(null);
 
      await onCreated();
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'We could not create your request right now. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };
 
  return (
    <Card className="border-white/10 bg-slate-900/70 text-slate-50 shadow-xl shadow-slate-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MapPin className="h-5 w-5 text-sky-300" />
          New service request
        </CardTitle>
        <CardDescription className="text-slate-300">
          Select your live location, describe the issue, and dispatch help to the exact point you need.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
 
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-type">Service type</Label>
              <select
                id="service-type"
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
                className="flex h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
              >
                {serviceOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Contact phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+2547..."
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
 
          <div className="space-y-2">
            <Label htmlFor="vehicle-details">Vehicle details</Label>
            <Input
              id="vehicle-details"
              placeholder="e.g. Toyota Axio, KDA 123A, white"
              value={vehicleDetails}
              onChange={(event) => setVehicleDetails(event.target.value)}
              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
          </div>
 
          <div className="space-y-2">
            <Label htmlFor="issue-description">Issue description</Label>
            <textarea
              id="issue-description"
              rows={4}
              placeholder="Describe what happened and the kind of support you need."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
            />
          </div>
 
         <div className="space-y-3">
  <div className="flex items-center justify-between gap-2">
    <Label>Service location</Label>
    {(liveLocState.status === 'idle' || liveLocState.status === 'error') && (
      <button type="button" onClick={startLiveLoc}
        className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/20 transition">
        <Navigation className="h-3 w-3" />
        Use my GPS
      </button>
    )}
    {liveLocState.status === 'requesting' && (
      <span className="flex items-center gap-1.5 text-xs text-amber-300">
        <Loader2 className="h-3 w-3 animate-spin" /> Locating…
      </span>
    )}
    {liveLocState.status === 'active' && (
      <button type="button"
        onClick={() => {
          setRequestLocation({
            lat: liveLocState.lat,
            lng: liveLocState.lng,
            address: liveLocState.address || `${liveLocState.lat.toFixed(5)}, ${liveLocState.lng.toFixed(5)}`,
          });
          stopLiveLoc();
        }}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-400 transition">
        <MapPin className="h-3 w-3" />
        Set as location
      </button>
    )}
  </div>
  <LocationPickerMap value={requestLocation} onChange={setRequestLocation} />
  {requestLocation && (
    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
      📍 {resolvedPickupAddress || 'Resolving address...'}
    </p>
  )}

  {/* ONE unified map — shows garages, drivers + destination picker */}
  <ServiceLocationMap
    customerLocation={requestLocation}
    destination={destination}
    onDestinationChange={setDestination}
    heightClassName="h-96"
    radiusKm={25}
  />

  {destination && (
    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
      🏁 {resolvedDestinationAddress || 'Resolving address...'}
    </p>
  )}
</div>
 
          <div className="space-y-2">
            <Label htmlFor="additional-notes">Additional notes</Label>
            <textarea
              id="additional-notes"
              rows={3}
              placeholder="Share any access notes, landmarks, or safety concerns."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
            />
          </div>
 
          {estimatedPricePreview !== null ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                <Sparkles className="h-4 w-4 text-amber-300" />
                Estimated price
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Service total</p>
                  <p className="mt-1 text-lg font-semibold text-amber-300">
                    {currencyFormatter.format(estimatedPricePreview)}
                  </p>
                </div>
                {distanceKm !== null ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Distance</p>
                    <p className="mt-1 text-sm text-slate-100">{distanceKm.toFixed(1)} km</p>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {serviceType === 'towing' && !destination
                  ? 'Add a destination to include distance charges.'
                  : 'Final price may be adjusted by the admin after service.'}
              </p>
            </div>
          ) : null}
 
          <Button
            type="submit"
            className="w-full bg-sky-500 text-white hover:bg-sky-400"
            disabled={submitting || !customerId}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending request...
              </>
            ) : (
              'Submit service request'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LiveRequestMapWrapper({
  customerLocation,
  driverId,
  requestId,
}: {
  customerLocation: { lat: number; lng: number; address?: string };
  driverId: string;
  requestId: string;
}) {
  const driverPos = useWatchDriverLocation(driverId, requestId, true);

  return (
    <LiveTrackingMap
      customerLocation={customerLocation}
      driverLocation={driverPos}
      viewerRole="customer"
      heightClassName="h-72"
    />
  );
}

// ─── Single request card with geocoded addresses ──────────────────────────────
function RequestCard({
  request,
  onCancel,
  cancellingRequestId,
}: {
  request: ServiceRequest;
  onCancel?: (requestId: string) => Promise<void> | void;
  cancellingRequestId: string | null;
}) {
  const requestLocation = getRequestLocation(request);
  const destination = getDestinationLocation(request);
  const status = getRequestStatus(request);
  const amount = getRequestAmount(request);
  const paymentStatus = getRequestPaymentStatus(request);
  const isActive = ['accepted', 'assigned', 'in_progress', 'in-progress'].includes(status.toLowerCase());
  const driverId = getAssignedDriverId(request);

  // Reverse-geocode coordinates into human-readable addresses
  const pickupAddress = useResolvedAddress(requestLocation);
  const destinationAddress = useResolvedAddress(destination);

  return (
    <Card className={`border-white/10 bg-slate-900/70 text-slate-50 ${isActive ? 'ring-2 ring-sky-500/40' : ''}`}>
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{getRequestServiceType(request)}</CardTitle>
            <Badge className={getStatusClasses(status)}>{status.replace(/_/g, ' ')}</Badge>
            <Badge className={getStatusClasses(paymentStatus)}>
              Payment {paymentStatus.replace(/_/g, ' ')}
            </Badge>
          </div>
          <CardDescription className="text-slate-300">
            Submitted {getRequestCreatedAt(request)}
          </CardDescription>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Estimated total</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {amount > 0 ? currencyFormatter.format(amount) : 'Pending quote'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
           {['accepted', 'assigned'].includes(status.toLowerCase()) && (
          <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-300" />
            <span>A driver has accepted your request and is on the way to your location!</span>
          </div>
        )}
        {/* ✅ NEW — arrived banner for customer */}
        {status.toLowerCase() === 'arrived' && (
          <div className="flex items-center gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            <Navigation className="h-4 w-4 shrink-0 text-violet-300" />
            <span>🚗 Your driver has arrived at your location! Please meet them to begin the service.</span>
          </div>
        )}
 
        {status.toLowerCase() === 'in_progress' && (
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-300" />
            <span>Your service is currently in progress.</span>
          </div>
        )}
        {status.toLowerCase() === 'completed' && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>Service completed! Please proceed to payment if outstanding.</span>
          </div>
        )}
        <p className="text-sm leading-6 text-slate-300">{getRequestDescription(request)}</p>

        {requestLocation ? (
          isActive && driverId ? (
            <LiveRequestMapWrapper
              customerLocation={requestLocation}
              driverId={driverId}
              requestId={getRequestId(request)}
            />
          ) : (
            <ServiceRequestMap
              requestLocation={requestLocation}
              destination={destination}
              heightClassName="h-64"
            />
          )
        ) : null}

        {isActive && driverId ? (
          <RequestChatPanel
            requestId={getRequestId(request)}
            title="Chat with your driver"
            description="Send messages to the driver who accepted this request while they are on the way."
            className="border-white/10 bg-slate-950/80"
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-100">
              <MapPin className="h-4 w-4 text-sky-300" />
              Pickup location
            </p>
            <p className="text-sm text-slate-300">
              {pickupAddress || 'Location not available'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-100">
              <Route className="h-4 w-4 text-amber-300" />
              Destination
            </p>
            <p className="text-sm text-slate-300">
              {destination ? (destinationAddress || 'Resolving...') : 'No destination provided'}
            </p>
          </div>
        </div>

        {!['completed', 'cancelled', 'failed', 'rejected'].includes(status.toLowerCase()) &&
        onCancel ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-rose-500/40 bg-transparent text-rose-200 hover:bg-rose-500/10"
              onClick={() => void onCancel(getRequestId(request))}
              disabled={cancellingRequestId === getRequestId(request)}
            >
              {cancellingRequestId === getRequestId(request) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Cancel request
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RequestsList({
  requests,
  loading,
  error,
  onRefresh,
  onCancel,
}: {
  requests: ServiceRequest[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onCancel?: (requestId: string) => Promise<void> | void;
}) {
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const handleCancelRequest = useCallback(
    async (requestId: string) => {
      if (!onCancel) return;
      setCancellingRequestId(requestId);
      try {
        await onCancel(requestId);
      } finally {
        setCancellingRequestId(null);
      }
    },
    [onCancel],
  );
 
  if (loading) {
    return (
      <Card className="border-white/10 bg-slate-900/70 text-slate-50">
        <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your service requests...
        </CardContent>
      </Card>
    );
  }
 
  if (error) {
    return (
      <Card className="border-rose-500/20 bg-rose-500/10 text-rose-100">
        <CardContent className="space-y-4 py-8">
          <p className="text-sm">{error}</p>
          <Button variant="outline" className="border-rose-400/20 bg-transparent" onClick={() => void onRefresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
 
  if (!requests.length) {
    return (
      <EmptyState
        icon={MapPin}
        title="No requests yet"
        description="Create your first request to start tracking roadside assistance and service updates."
      />
    );
  }

  return (
    <div className="space-y-5">
      {requests.map((request) => (
        <RequestCard
          key={getRequestId(request)}
          request={request}
          onCancel={onCancel}
          cancellingRequestId={cancellingRequestId}
        />
      ))}
    </div>
  );
}
 
function PaymentsPanel({
  payments,
  requests,
  loading,
  error,
  onRefresh,
  customerPhone,
}: {
  payments: PaymentRecord[];
  requests: ServiceRequest[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  customerPhone?: string;
}) {
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
 
  const unpaidCompletedRequests = useMemo(
    () =>
      requests.filter((request) => {
        const requestStatus = getRequestStatus(request).toLowerCase();
        const paymentStatus = getRequestPaymentStatus(request).toLowerCase();
        return requestStatus === 'completed' && !['paid', 'completed', 'success'].includes(paymentStatus);
      }),
    [requests],
  );
 
  const handleMpesaPayment = async (request: ServiceRequest) => {
    const phoneNumber = customerPhone?.trim();
 
    if (!phoneNumber) {
      setFeedback({
        type: 'error',
        message: 'Please add a valid phone number to your profile before starting an M-Pesa payment.',
      });
      return;
    }
 
    const amount = getRequestAmount(request);
 
    if (amount <= 0) {
      setFeedback({
        type: 'error',
        message: 'This request does not have a payable amount yet.',
      });
      return;
    }
 
    const paymentId = getRequestId(request);
    setProcessingPaymentId(paymentId);
    setFeedback(null);
 
    try {
      await initiateMpesaStkPush({
        amount,
        phoneNumber,
        requestId: paymentId,
        accountReference: paymentId,
        transactionDesc: `${getRequestServiceType(request)} payment`,
      } as Parameters<typeof initiateMpesaStkPush>[0]);
 
      setFeedback({
        type: 'success',
        message: 'M-Pesa prompt sent. Please complete the payment on your phone.',
      });
 
      await onRefresh();
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'We could not initiate the M-Pesa payment. Please try again.',
      });
    } finally {
      setProcessingPaymentId(null);
    }
  };
 
  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
 
      {unpaidCompletedRequests.length ? (
        <Card className="border-amber-500/20 bg-amber-500/10 text-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Wallet className="h-5 w-5" />
              Outstanding payments
            </CardTitle>
            <CardDescription className="text-amber-100/80">
              Completed services with unpaid balances can be settled directly with M-Pesa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {unpaidCompletedRequests.map((request) => {
              const requestId = getRequestId(request);
 
              return (
                <div
                  key={requestId}
                  className="flex flex-col gap-4 rounded-2xl border border-amber-400/20 bg-slate-950/20 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{getRequestServiceType(request)}</p>
                    <p className="mt-1 text-sm text-amber-100/80">{getRequestDescription(request)}</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {currencyFormatter.format(getRequestAmount(request))}
                    </p>
                  </div>
                  <Button
                    className="bg-emerald-500 text-white hover:bg-emerald-400"
                    onClick={() => void handleMpesaPayment(request)}
                    disabled={processingPaymentId === requestId}
                  >
                    {processingPaymentId === requestId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initiating payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Pay with M-Pesa
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
 
      {loading ? (
        <Card className="border-white/10 bg-slate-900/70 text-slate-50">
          <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your payments...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-rose-500/20 bg-rose-500/10 text-rose-100">
          <CardContent className="space-y-4 py-8">
            <p className="text-sm">{error}</p>
            <Button variant="outline" className="border-rose-400/20 bg-transparent" onClick={() => void onRefresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : payments.length ? (
        <div className="grid gap-5">
          {payments.map((payment) => (
            <Card key={getPaymentId(payment)} className="border-white/10 bg-slate-900/70 text-slate-50">
              <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{getPaymentReference(payment)}</p>
                    <Badge className={getStatusClasses(getPaymentStatus(payment))}>
                      {String(getPaymentStatus(payment)).replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300">Processed {getPaymentDate(payment)}</p>
                  {getPaymentRequestId(payment) ? (
                    <p className="text-xs text-slate-400">Request ID: {getPaymentRequestId(payment)}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Amount</p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {currencyFormatter.format(getPaymentAmount(payment))}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Your completed and pending payments will appear here once service billing is available."
        />
      )}
    </div>
  );
}
 
function OverviewContent() {
  const {
    user,
    customerId,
    requests,
    payments,
    pricingSettings,
    requestsLoading,
    paymentsLoading,
    pricingLoading,
    requestsError,
    paymentsError,
    pricingError,
    refreshRequests,
    refreshPayments,
    cancelRequest,
  } = useCustomerData();
 
  const pendingRequests = requests.filter((request) =>
    !['completed', 'cancelled', 'failed', 'rejected'].includes(getRequestStatus(request).toLowerCase()),
  ).length;
 
  const successfulPayments = payments.filter((payment) =>
    ['paid', 'completed', 'success'].includes(String(getPaymentStatus(payment)).toLowerCase()),
  );
 
  const totalPaid = successfulPayments.reduce(
    (sum, payment) => sum + getPaymentAmount(payment),
    0,
  );
 
  const stats = [
    {
      label: 'Open requests',
      value: requestsLoading ? '—' : String(pendingRequests),
      icon: MapPin,
      accent: 'text-sky-300',
    },
    {
      label: 'Total requests',
      value: requestsLoading ? '—' : String(requests.length),
      icon: Route,
      accent: 'text-emerald-300',
    },
    {
      label: 'Payments completed',
      value: paymentsLoading ? '—' : String(successfulPayments.length),
      icon: CheckCircle2,
      accent: 'text-amber-300',
    },
    {
      label: 'Amount paid',
      value: paymentsLoading ? '—' : currencyFormatter.format(totalPaid),
      icon: Wallet,
      accent: 'text-fuchsia-300',
    },
  ];
 
  return (
    <CustomerShell activeSection="overview">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
 
              return (
                <Card key={stat.label} className="border-white/10 bg-slate-900/70 text-slate-50">
                  <CardContent className="flex items-center justify-between py-6">
                    <div>
                      <p className="text-sm text-slate-400">{stat.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                    </div>
                    <div className={`rounded-2xl bg-white/5 p-3 ${stat.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
 
          <NewRequestForm
            customerId={customerId}
            customerPhone={typeof user?.phone === 'string' ? user.phone : undefined}
            pricingSettings={pricingSettings}
            onCreated={async () => {
              await refreshRequests();
              await refreshPayments();
            }}
          />
 
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Latest requests</h2>
                <p className="text-sm text-slate-400">Recent service activity linked to your account.</p>
              </div>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                onClick={() => void refreshRequests()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <RequestsList
              requests={requests.slice(0, 3)}
              loading={requestsLoading}
              error={requestsError}
              onRefresh={refreshRequests}
              onCancel={cancelRequest}
            />
          </section>
        </div>
 
        <div className="space-y-6">

          {/* ✅ ADD — Live location widget */}
          <LiveLocationWidget
            onUseLocation={(loc) => {
              sessionStorage.setItem('prefill_location', JSON.stringify(loc));
              window.dispatchEvent(new CustomEvent('prefill_location', { detail: loc }));
              document.getElementById('new-request-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <Card className="border-white/10 bg-slate-900/70 text-slate-50">
            <CardHeader>
              <CardTitle className="text-xl">Account contact</CardTitle>
              <CardDescription className="text-slate-300">
                Keep your contact details up to date for dispatch and payment prompts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{user?.fullName ?? 'Customer account'}</p>
                <p className="mt-1 text-sm text-slate-300">{user?.email ?? 'No email available'}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                  <Phone className="h-4 w-4 text-sky-300" />
                  {user?.phone ?? 'No phone number available'}
                </p>
              </div>
 
              {pricingLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  Loading pricing information...
                </div>
              ) : pricingError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {pricingError}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-sm font-medium text-white">Available pricing configuration</p>
                  <div className="space-y-2 text-sm text-slate-300">
                    {Object.entries(pricingSettings ?? {}).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <span className="capitalize text-slate-400">{key.replace(/_/g, ' ')}</span>
                        <span className="text-right text-slate-100">{String(value)}</span>
                      </div>
                    ))}
                    {!Object.keys(pricingSettings ?? {}).length ? (
                      <p className="text-slate-400">Pricing information is not available yet.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
 
          <PaymentsPanel
            payments={payments}
            requests={requests}
            loading={paymentsLoading}
            error={paymentsError}
            onRefresh={refreshPayments}
            customerPhone={typeof user?.phone === 'string' ? user.phone : undefined}
          />
        </div>
      </div>
    </CustomerShell>
  );
}
 
function RequestsContent() {
  const { requests, requestsLoading, requestsError, refreshRequests, cancelRequest } =
    useCustomerData();
 
  return (
    <CustomerShell activeSection="requests">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">All service requests</h2>
            <p className="text-sm text-slate-400">
              Review request history, statuses, and mapped service locations.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
            onClick={() => void refreshRequests()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
 
        <RequestsList
          requests={requests}
          loading={requestsLoading}
          error={requestsError}
          onRefresh={refreshRequests}
          onCancel={cancelRequest}
        />
      </div>
    </CustomerShell>
  );
}
 
function PaymentsContent() {
  const { user, requests, payments, paymentsLoading, paymentsError, refreshPayments } =
    useCustomerData();
 
  return (
    <CustomerShell activeSection="payments">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Payments</h2>
          <p className="text-sm text-slate-400">
            Monitor billing progress and complete outstanding services with M-Pesa.
          </p>
        </div>
 
        <PaymentsPanel
          payments={payments}
          requests={requests}
          loading={paymentsLoading}
          error={paymentsError}
          onRefresh={refreshPayments}
          customerPhone={typeof user?.phone === 'string' ? user.phone : undefined}
        />
      </div>
    </CustomerShell>
  );
}
 
function SupportContent() {
  const location = useLocation();
 
  return (
    <CustomerShell activeSection="support">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="border-white/10 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle className="text-2xl">Support & safety</CardTitle>
            <CardDescription className="text-slate-300">
              Need help with an active request, billing, or your account? Use the guidance below
              while connected through your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                title: 'Active request support',
                description:
                  'Stay reachable on your registered phone number and keep your location updated if you move to a safer place.',
                icon: Phone,
              },
              {
                title: 'Payment assistance',
                description:
                  'If an M-Pesa prompt fails, refresh the Payments page and try again once network coverage is stable.',
                icon: CreditCard,
              },
              {
                title: 'Safety first',
                description:
                  'Move away from traffic where possible, switch on hazard lights, and share visible landmarks in your request notes.',
                icon: Shield,
              },
            ].map((item) => {
              const Icon = item.icon;
 
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 inline-flex rounded-2xl bg-sky-500/10 p-3 text-sky-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
 
        <Card className="border-white/10 bg-slate-900/70 text-slate-50">
          <CardHeader>
            <CardTitle className="text-xl">Current page</CardTitle>
            <CardDescription className="text-slate-300">
              Use this route for sharing context with support or the dispatch team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Route</p>
              <p className="mt-2 break-all text-sm text-white">{location.pathname}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              For urgent roadside emergencies, use the phone contact associated with your account
              and submit a detailed request with your map location for faster provider dispatch.
            </div>
          </CardContent>
        </Card>
      </div>
    </CustomerShell>
  );
}
 
export function CustomerDashboard() {
  return <OverviewContent />;
}

export function CustomerRequests() {
  return <RequestsContent />;
}

export function CustomerPayments() {
  return <PaymentsContent />;
}

export function CustomerSupport() {
  return <SupportContent />;
}

export default CustomerDashboard;