/**
 * NearbyServicesMap.tsx
 *
 * Drop-in Leaflet map that shows:
 *  1. The customer's current / picked location (blue pin)
 *  2. Nearby garages & mechanic shops from OpenStreetMap (orange wrench pins)
 *  3. Online towing drivers from Supabase profiles (green truck pins)
 *
 * Usage:
 *   <NearbyServicesMap customerLocation={{ lat: -1.295, lng: 36.811 }} radiusKm={5} />
 *
 * Requirements:
 *   npm install leaflet react-leaflet   (already in your project)
 *   Add to supabaseData.ts: getOnlineDrivers() — see bottom of this file
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Wrench, Truck, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

interface GaragePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'garage' | 'mechanic' | 'car_repair' | 'car_parts';
  phone?: string;
  address?: string;
  openingHours?: string;
}

interface OnlineDriver {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicle?: string;
  rating?: number;
}

interface Props {
  customerLocation: LatLng;
  radiusKm?: number;
  heightClassName?: string;
}

// ─── Overpass API — fetches garages/mechanics near a point ───────────────────

async function fetchNearbyGarages(lat: number, lng: number, radiusMetres: number): Promise<GaragePlace[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["shop"="car_repair"](around:${radiusMetres},${lat},${lng});
      node["amenity"="car_repair"](around:${radiusMetres},${lat},${lng});
      node["shop"="tyres"](around:${radiusMetres},${lat},${lng});
      node["shop"="car_parts"](around:${radiusMetres},${lat},${lng});
      node["craft"="car_repair"](around:${radiusMetres},${lat},${lng});
    );
    out body;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  });

  if (!res.ok) throw new Error('Overpass API error');
  const data = await res.json() as { elements: Array<{
    id: number;
    lat: number;
    lon: number;
    tags?: Record<string, string>;
  }> };

  return (data.elements ?? []).map((el) => ({
    id: String(el.id),
    name: el.tags?.name ?? el.tags?.['name:en'] ?? 'Auto Repair Shop',
    lat: el.lat,
    lng: el.lon,
    type: (el.tags?.shop ?? el.tags?.amenity ?? 'garage') as GaragePlace['type'],
    phone: el.tags?.phone ?? el.tags?.['contact:phone'],
    address: el.tags?.['addr:street']
      ? `${el.tags['addr:housenumber'] ?? ''} ${el.tags['addr:street']}`.trim()
      : undefined,
    openingHours: el.tags?.opening_hours,
  }));
}

// ─── Supabase — fetches online drivers who have a location set ───────────────

async function fetchOnlineDrivers(): Promise<OnlineDriver[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, name, lat, lng, latitude, longitude, vehicle, rating')
    .eq('is_online', true)
    .eq('role', 'driver');

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .map((row) => {
      const lat = Number(row.lat ?? row.latitude ?? 0);
      const lng = Number(row.lng ?? row.longitude ?? 0);
      if (!lat || !lng) return null;
      return {
        id: String(row.id),
        name: String(row.full_name ?? row.name ?? 'Driver'),
        lat,
        lng,
        vehicle: row.vehicle ? String(row.vehicle) : undefined,
        rating: row.rating ? Number(row.rating) : undefined,
      };
    })
    .filter(Boolean) as OnlineDriver[];
}

// ─── Legend pill ─────────────────────────────────────────────────────────────

function LegendPill({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-900/90 border border-white/10 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${color} shrink-0`} />
      <span>{label}</span>
      <span className={`font-semibold ${count > 0 ? 'text-white' : 'text-slate-500'}`}>{count}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NearbyServicesMap({
  customerLocation,
  radiusKm = 5,
  heightClassName = 'h-80',
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof import('leaflet')['map']> | null>(null);
  const [garages, setGarages] = useState<GaragePlace[]>([]);
  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, d] = await Promise.all([
        fetchNearbyGarages(customerLocation.lat, customerLocation.lng, radiusKm * 1000),
        fetchOnlineDrivers(),
      ]);
      setGarages(g);
      setDrivers(d);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nearby services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // Auto-refresh drivers every 30 seconds
    const interval = setInterval(() => {
      void fetchOnlineDrivers().then(setDrivers);
    }, 30_000);
    return () => clearInterval(interval);
  }, [customerLocation.lat, customerLocation.lng, radiusKm]);

  // ── Build / update map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    // Lazy-load Leaflet (already in your project)
    void import('leaflet').then((L) => {
      // Fix Leaflet default icon path issue with bundlers
      // @ts-expect-error — Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Initialise map only once
      if (!mapRef.current && mapContainerRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          center: [customerLocation.lat, customerLocation.lng],
          zoom: 13,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current!;
      // Re-center if location changed
      map.setView([customerLocation.lat, customerLocation.lng], map.getZoom());

      // Clear previous markers (keep tile layer)
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          map.removeLayer(layer);
        }
      });

      // ── Customer location marker (blue) ──────────────────────────────────
      const customerIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:18px;height:18px;border-radius:50%;
          background:#38bdf8;border:3px solid #fff;
          box-shadow:0 0 0 3px rgba(56,189,248,0.4),0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([customerLocation.lat, customerLocation.lng], { icon: customerIcon })
        .addTo(map)
        .bindPopup('<b style="color:#0f172a">📍 Your Location</b>');

      // Radius circle
      L.circle([customerLocation.lat, customerLocation.lng], {
        radius: radiusKm * 1000,
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.04,
        weight: 1,
        dashArray: '6 4',
      }).addTo(map);

      // ── Garage markers (orange wrench) ────────────────────────────────────
      garages.forEach((g) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:32px;height:32px;border-radius:8px;
            background:#f97316;border:2px solid #fff;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            font-size:16px;
          ">🔧</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupHtml = `
          <div style="font-family:sans-serif;min-width:160px">
            <p style="font-weight:700;color:#1e293b;margin:0 0 4px">${g.name}</p>
            ${g.address ? `<p style="color:#64748b;font-size:12px;margin:0 0 2px">📍 ${g.address}</p>` : ''}
            ${g.phone ? `<p style="color:#64748b;font-size:12px;margin:0 0 2px">📞 <a href="tel:${g.phone}" style="color:#f97316">${g.phone}</a></p>` : ''}
            ${g.openingHours ? `<p style="color:#64748b;font-size:12px;margin:0">🕐 ${g.openingHours}</p>` : ''}
          </div>
        `;
        L.marker([g.lat, g.lng], { icon }).addTo(map).bindPopup(popupHtml);
      });

      // ── Driver markers (green truck) ──────────────────────────────────────
      drivers.forEach((d) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:#22c55e;border:2px solid #fff;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 0 3px rgba(34,197,94,0.3),0 2px 8px rgba(0,0,0,0.35);
            font-size:16px;
          ">🚗</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupHtml = `
          <div style="font-family:sans-serif;min-width:140px">
            <p style="font-weight:700;color:#1e293b;margin:0 0 4px">🚗 ${d.name}</p>
            <p style="color:#16a34a;font-size:12px;font-weight:600;margin:0 0 2px">● Available now</p>
            ${d.vehicle ? `<p style="color:#64748b;font-size:12px;margin:0 0 2px">🚙 ${d.vehicle}</p>` : ''}
            ${d.rating ? `<p style="color:#64748b;font-size:12px;margin:0">⭐ ${d.rating.toFixed(1)} rating</p>` : ''}
          </div>
        `;
        L.marker([d.lat, d.lng], { icon }).addTo(map).bindPopup(popupHtml);
      });
    });
  }, [loading, garages, drivers, customerLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-xl">
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Nearby Services</span>
          <span className="text-xs text-slate-500">· {radiusKm}km radius</span>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 px-4 py-2.5 border-b border-slate-800">
        <LegendPill color="bg-sky-400" label="Your location" count={1} />
        <LegendPill color="bg-orange-500" label="Garages / Mechanics" count={loading ? 0 : garages.length} />
        <LegendPill color="bg-green-500" label="Online tow drivers" count={loading ? 0 : drivers.length} />
      </div>

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div className={`relative ${heightClassName}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/80 backdrop-blur-sm">
            <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
            <p className="text-sm text-slate-300">Finding nearby garages & drivers…</p>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/90 p-6 text-center">
            <AlertCircle className="h-7 w-7 text-rose-400" />
            <p className="text-sm text-slate-300">{error}</p>
            <button
              onClick={() => void loadData()}
              className="mt-1 rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-400 transition"
            >
              Try again
            </button>
          </div>
        )}
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-t border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {garages.length} garage{garages.length !== 1 ? 's' : ''} found
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3" />
            {drivers.length} driver{drivers.length !== 1 ? 's' : ''} online
          </span>
        </div>
        <p className="text-xs text-slate-600">
          Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD THIS to supabaseData.ts
// ─────────────────────────────────────────────────────────────────────────────
/*
export const getOnlineDrivers = async (): Promise<Array<{
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicle?: string;
  rating?: number;
}>> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, name, lat, lng, latitude, longitude, vehicle, rating')
    .eq('is_online', true)
    .eq('role', 'driver');

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .map((row) => {
      const lat = Number(row.lat ?? row.latitude ?? 0);
      const lng = Number(row.lng ?? row.longitude ?? 0);
      if (!lat || !lng) return null;
      return {
        id: String(row.id),
        name: String(row.full_name ?? row.name ?? 'Driver'),
        lat,
        lng,
        vehicle: row.vehicle ? String(row.vehicle) : undefined,
        rating: row.rating ? Number(row.rating) : undefined,
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; lat: number; lng: number; vehicle?: string; rating?: number }>;
};
*/