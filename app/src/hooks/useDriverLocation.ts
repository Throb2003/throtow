import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { clearDriverLocation, getDriverLocation, updateDriverLocation } from "@/services/supabaseData";

interface LatLng { lat: number; lng: number; }

// ── DRIVER: pushes own GPS to Supabase every time it changes ─────────────────
export function useShareDriverLocation(
  driverId: string | null | undefined,
  requestId: string | null | undefined,
  active: boolean,
) {
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !driverId || !requestId) return;
    if (!navigator.geolocation) return;

    const push = (pos: GeolocationPosition) => {
      void updateDriverLocation(driverId, requestId, pos.coords.latitude, pos.coords.longitude);
    };

    watchRef.current = navigator.geolocation.watchPosition(push, undefined, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      void clearDriverLocation(driverId, requestId);
    };
  }, [active, driverId, requestId]);
}

// ── CUSTOMER: watches driver location in realtime ────────────────────────────
export function useWatchDriverLocation(
  driverId: string | null | undefined,
  requestId: string | null | undefined,
  active: boolean,
): LatLng | null {
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);

  const fetchLocation = useCallback(async () => {
    if (!driverId || !requestId) return null;
    return getDriverLocation(driverId, requestId);
  }, [driverId, requestId]);

  useEffect(() => {
    if (!active || !driverId || !requestId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const pos = await fetchLocation();
      if (!cancelled && pos) {
        setDriverPos(pos);
      }
    })();

    const channel = supabase
      .channel(`driver-loc-${driverId}-${requestId}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "*",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`,
      }, () => {
        void (async () => {
          const pos = await fetchLocation();
          if (!cancelled && pos) {
            setDriverPos(pos);
          }
        })();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [active, driverId, requestId, fetchLocation]);

  return active && driverId && requestId ? driverPos : null;
}
