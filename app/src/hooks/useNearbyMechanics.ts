/**
 * useNearbyMechanics.ts
 *
 * Fetches available mechanics from Supabase and calculates their
 * distance from the customer's location.
 *
 * Usage:
 *   const { mechanics, loading } = useNearbyMechanics(customerLocation);
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { NearbyMechanic } from "@/components/maps/NearbyMechanicsMap";

// ─── Haversine distance in km ─────────────────────────────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Safe JSON location parser ────────────────────────────────────────────────
function parseLocation(raw: unknown): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lat = Number(r.lat ?? r.latitude);
  const lng = Number(r.lng ?? r.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNearbyMechanics(
  customerLocation: { lat: number; lng: number } | null,
  radiusKm = 20,   // only show mechanics within this radius
) {
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerLocation) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from("users")
      .select("id, full_name, avatar_url, rating, speciality, current_location, is_available, role")
      .eq("role", "mechanic")
      .eq("is_available", true)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          return;
        }

        const rows = (data ?? []) as Record<string, unknown>[];
        const nearby: NearbyMechanic[] = [];

        for (const row of rows) {
          const loc = parseLocation(row.current_location);
          if (!loc) continue; // skip mechanics without a location

          const distanceKm = haversineKm(
            customerLocation.lat, customerLocation.lng,
            loc.lat, loc.lng,
          );

          if (distanceKm > radiusKm) continue; // outside radius

          nearby.push({
            id: String(row.id ?? ""),
            fullName: typeof row.full_name === "string" ? row.full_name : "Mechanic",
            avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
            rating: typeof row.rating === "number" ? row.rating : null,
            speciality: typeof row.speciality === "string" ? row.speciality : null,
            distanceKm: Math.round(distanceKm * 10) / 10,
            location: loc,
          });
        }

        // Sort closest first
        nearby.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
        setMechanics(nearby);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [customerLocation, radiusKm]);

  return { mechanics, loading, error };
}