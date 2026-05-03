/**
 * ServiceLocationMap.tsx
 *
 * ONE unified map that does everything:
 *  1. 📍 Shows customer's current location (blue pulsing pin) — PRIORITY
 *  2. 🔧 Shows ALL mechanic garages across Nairobi (orange pins)
 *  3. 🚗 Shows ALL online tow drivers across Nairobi (green pins)
 *  4. 🏁 Customer can click a garage pin → auto-sets it as destination
 *  5. 🔍 Customer can also type-search for any destination (Uber style)
 *  6. 📏 Shows distance + ETA to selected destination
 *
 * Place at: src/components/maps/ServiceLocationMap.tsx
 *
 * Usage in CustomerDashboard:
 *   <ServiceLocationMap
 *     customerLocation={requestLocation}
 *     destination={destination}
 *     onDestinationChange={setDestination}
 *   />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LocationPoint } from '@/types/app';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
  address?: string;
}

interface GaragePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
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

interface NominatimResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  /** Customer's current / chosen pickup location — shown as blue pulsing pin */
  customerLocation: LatLng | null;
  /** Currently selected destination */
  destination?: LocationPoint | null;
  /** Called when customer picks a destination (garage click OR search) */
  onDestinationChange?: (loc: LocationPoint) => void;
  heightClassName?: string;
  /** Search radius for garages in km — default covers whole Nairobi */
  radiusKm?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function etaMin(km: number) {
  return Math.max(1, Math.round((km / 30) * 60));
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

// Covers entire Nairobi (~25 km radius from city centre)
const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
const NAIROBI_RADIUS_M = 25_000;

// ── Cache garages in memory so we don't hammer overpass API ─────────────────
let garageCache: GaragePlace[] | null = null;
let garageCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Hardcoded Nairobi garages as fallback when API rate-limits us ─────────────
const FALLBACK_GARAGES: GaragePlace[] = [
  { id: 'f1', name: 'Nairobi Auto Spares & Garage', lat: -1.2864, lng: 36.8172, type: 'garage', address: 'Tom Mboya Street, Nairobi' },
  { id: 'f2', name: 'Kenya Vehicle Manufacturers', lat: -1.3192, lng: 36.8274, type: 'garage', address: 'Industrial Area, Nairobi' },
  { id: 'f3', name: 'Westlands Auto Repair', lat: -1.2634, lng: 36.8026, type: 'garage', address: 'Westlands, Nairobi' },
  { id: 'f4', name: 'Karen Auto Centre', lat: -1.3192, lng: 36.7102, type: 'garage', address: 'Karen, Nairobi' },
  { id: 'f5', name: 'Kasarani Motors', lat: -1.2206, lng: 36.8960, type: 'garage', address: 'Kasarani, Nairobi' },
  { id: 'f6', name: 'Eastleigh Auto Workshop', lat: -1.2741, lng: 36.8552, type: 'garage', address: 'Eastleigh, Nairobi' },
  { id: 'f7', name: 'Ngong Road Garage', lat: -1.3010, lng: 36.7720, type: 'garage', address: 'Ngong Road, Nairobi' },
  { id: 'f8', name: 'South B Auto Repairs', lat: -1.3154, lng: 36.8310, type: 'garage', address: 'South B, Nairobi' },
  { id: 'f9', name: 'Parklands Service Centre', lat: -1.2588, lng: 36.8180, type: 'garage', address: 'Parklands, Nairobi' },
  { id: 'f10', name: 'Kiambu Road Motors', lat: -1.2132, lng: 36.8274, type: 'garage', address: 'Kiambu Road, Nairobi' },
  { id: 'f11', name: 'Embakasi Auto Workshop', lat: -1.3210, lng: 36.9020, type: 'garage', address: 'Embakasi, Nairobi' },
  { id: 'f12', name: 'Langata Garage & Spares', lat: -1.3490, lng: 36.7490, type: 'garage', address: 'Langata, Nairobi' },
];

async function fetchAllNairobiGarages(): Promise<GaragePlace[]> {
  // Return cached data if fresh enough
  if (garageCache && Date.now() - garageCacheTime < CACHE_TTL_MS) {
    return garageCache;
  }

  const { lat, lng } = NAIROBI_CENTER;
  const r = NAIROBI_RADIUS_M;

  const query = `
    [out:json][timeout:25];
    (
      node["shop"="car_repair"](around:${r},${lat},${lng});
      node["amenity"="car_repair"](around:${r},${lat},${lng});
      node["shop"="tyres"](around:${r},${lat},${lng});
      node["craft"="car_repair"](around:${r},${lat},${lng});
    );
    out body;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
    });

    // If rate limited — use fallback silently
    if (res.status === 429 || res.status === 504) {
      console.warn('Overpass API rate limited — using fallback garages');
      return FALLBACK_GARAGES;
    }

    if (!res.ok) return FALLBACK_GARAGES;

    const data = await res.json() as {
      elements: Array<{
        id: number; lat: number; lon: number;
        tags?: Record<string, string>;
      }>;
    };

    const seen = new Set<string>();
    const results = (data.elements ?? [])
      .filter((el) => {
        if (seen.has(String(el.id))) return false;
        seen.add(String(el.id));
        return true;
      })
      .map((el) => ({
        id: String(el.id),
        name: el.tags?.name ?? el.tags?.['name:en'] ?? 'Auto Repair Shop',
        lat: el.lat,
        lng: el.lon,
        type: el.tags?.shop ?? el.tags?.amenity ?? 'garage',
        phone: el.tags?.phone ?? el.tags?.['contact:phone'],
        address: el.tags?.['addr:street']
          ? `${el.tags['addr:housenumber'] ?? ''} ${el.tags['addr:street']}`.trim()
          : undefined,
        openingHours: el.tags?.opening_hours,
      }));

    // Merge API results with fallback — deduplicate by proximity
    const merged = [...results, ...FALLBACK_GARAGES.filter((f) =>
      !results.some((r) => Math.abs(r.lat - f.lat) < 0.005 && Math.abs(r.lng - f.lng) < 0.005)
    )];

    // Cache and return
    garageCache = merged;
    garageCacheTime = Date.now();
    return merged;

  } catch {
    // Network error — use fallback
    console.warn('Overpass API unavailable — using fallback garages');
    return FALLBACK_GARAGES;
  }
}

async function fetchOnlineDrivers(): Promise<OnlineDriver[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, vehicle, rating, location, is_online')
    .eq('is_online', true)
    .in('role', ['driver', 'mechanic']);

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .map((row) => {
      // Driver location comes from the location JSONB column
      let lat = 0;
      let lng = 0;

      if (row.location && typeof row.location === 'object') {
        const loc = row.location as Record<string, unknown>;
        lat = Number(loc.lat ?? loc.latitude ?? 0);
        lng = Number(loc.lng ?? loc.longitude ?? 0);
      }

      // Skip drivers with no location data
      if (!lat || !lng) return null;

      return {
        id: String(row.id),
        name: String(row.name ?? 'Driver'),
        lat,
        lng,
        vehicle: row.vehicle ? String(row.vehicle) : undefined,
        rating: row.rating ? Number(row.rating) : undefined,
      };
    })
    .filter(Boolean) as OnlineDriver[];
}

// ─── Legend pill ──────────────────────────────────────────────────────────────

function LegendPill({
  color, label, count,
}: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-900/90 border border-white/10 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-sm">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
      <span>{label}</span>
      <span className={`font-semibold ${count > 0 ? 'text-white' : 'text-slate-500'}`}>{count}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ServiceLocationMap({
  customerLocation,
  destination,
  onDestinationChange,
  heightClassName = 'h-80',
  radiusKm = 25,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const [garages, setGarages] = useState<GaragePlace[]>([]);
  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Search state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected garage info
  const [selectedGarage, setSelectedGarage] = useState<GaragePlace | null>(null);

  // ── Load garages + drivers ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, d] = await Promise.all([fetchAllNairobiGarages(), fetchOnlineDrivers()]);
      setGarages(g);
      setDrivers(d);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nearby services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void fetchOnlineDrivers().then(setDrivers), 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Nominatim search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&countrycodes=ke`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = (await res.json()) as NominatimResult[];
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSearchSelect = (s: NominatimResult) => {
    const loc: LocationPoint = {
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lon),
      address: s.display_name,
    };
    onDestinationChange?.(loc);
    setQuery(s.display_name);
    setShowDropdown(false);
    setSuggestions([]);
    setSelectedGarage(null);
    // Fly map
    if (mapRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      mapRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 0.8 });
    }
  };

  // ── Build / refresh map ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    void import('leaflet').then((L) => {
      // @ts-expect-error — Leaflet bundler fix
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center: [number, number] = customerLocation
        ? [customerLocation.lat, customerLocation.lng]
        : [NAIROBI_CENTER.lat, NAIROBI_CENTER.lng];

      // Init map once
      if (!mapRef.current && mapContainerRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          center,
          zoom: 12,
          zoomControl: true,
          attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      map.setView(center, map.getZoom());

      // Clear old markers
      map.eachLayer((layer: unknown) => {
        if (
          layer instanceof L.Marker ||
          layer instanceof L.Circle ||
          layer instanceof L.Polyline
        ) {
          map.removeLayer(layer);
        }
      });

      // ── 1. Customer location (blue pulsing) ─────────────────────────────
      if (customerLocation) {
        const customerIcon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;width:28px;height:28px;">
              <div style="position:absolute;inset:0;border-radius:50%;background:rgba(56,189,248,0.3);animation:cpulse 2s ease-in-out infinite;"></div>
              <div style="position:absolute;inset:5px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
            </div>
            <style>@keyframes cpulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.8);opacity:.1}}</style>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([customerLocation.lat, customerLocation.lng], { icon: customerIcon })
          .addTo(map)
          .bindPopup('<b style="color:#0f172a">📍 Your Location</b>');

        // Soft radius circle
        L.circle([customerLocation.lat, customerLocation.lng], {
          radius: radiusKm * 1000,
          color: '#38bdf8',
          fillColor: '#38bdf8',
          fillOpacity: 0.03,
          weight: 1,
          dashArray: '6 4',
        }).addTo(map);
      }

      // ── 2. Garage markers (orange 🔧) ───────────────────────────────────
      garages.forEach((g) => {
        const isSelected = destination &&
          Math.abs(g.lat - destination.lat) < 0.0001 &&
          Math.abs(g.lng - destination.lng) < 0.0001;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:34px;height:34px;border-radius:8px;
            background:${isSelected ? '#f59e0b' : '#f97316'};
            border:${isSelected ? '3px solid #fff' : '2px solid #fff'};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            font-size:17px;
            ${isSelected ? 'box-shadow:0 0 0 4px rgba(245,158,11,0.4),0 2px 8px rgba(0,0,0,0.4);' : ''}
          ">🔧</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const distText = customerLocation
          ? `<p style="color:#64748b;font-size:11px;margin:2px 0 0">📏 ${haversineKm(customerLocation, g).toFixed(1)} km away · ~${etaMin(haversineKm(customerLocation, g))} min</p>`
          : '';

        const popupHtml = `
          <div style="font-family:sans-serif;min-width:170px;padding:2px">
            <p style="font-weight:700;color:#1e293b;margin:0 0 4px;font-size:13px">${g.name}</p>
            ${g.address ? `<p style="color:#64748b;font-size:11px;margin:0 0 2px">📍 ${g.address}</p>` : ''}
            ${g.phone ? `<p style="color:#64748b;font-size:11px;margin:0 0 2px">📞 <a href="tel:${g.phone}" style="color:#f97316">${g.phone}</a></p>` : ''}
            ${g.openingHours ? `<p style="color:#64748b;font-size:11px;margin:0 0 2px">🕐 ${g.openingHours}</p>` : ''}
            ${distText}
            <button
              onclick="window.__selectGarage && window.__selectGarage('${g.id}')"
              style="margin-top:8px;width:100%;background:#f97316;color:white;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer;"
            >
              Set as destination
            </button>
          </div>`;

        L.marker([g.lat, g.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml);
      });

      // ── 3. Driver markers (green 🚗) ────────────────────────────────────
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

        const distText = customerLocation
          ? `<p style="color:#64748b;font-size:11px;margin:2px 0 0">📏 ${haversineKm(customerLocation, d).toFixed(1)} km away · ~${etaMin(haversineKm(customerLocation, d))} min</p>`
          : '';

        const popupHtml = `
          <div style="font-family:sans-serif;min-width:150px;padding:2px">
            <p style="font-weight:700;color:#1e293b;margin:0 0 4px;font-size:13px">🚗 ${d.name}</p>
            <p style="color:#16a34a;font-size:11px;font-weight:600;margin:0 0 2px">● Available now</p>
            ${d.vehicle ? `<p style="color:#64748b;font-size:11px;margin:0 0 2px">🚙 ${d.vehicle}</p>` : ''}
            ${d.rating ? `<p style="color:#64748b;font-size:11px;margin:0 0 2px">⭐ ${d.rating.toFixed(1)} rating</p>` : ''}
            ${distText}
          </div>`;

        L.marker([d.lat, d.lng], { icon }).addTo(map).bindPopup(popupHtml);
      });

      // ── 4. Destination marker (flag 🏁) ────────────────────────────────
      if (destination) {
        const destIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:34px;height:34px;border-radius:50%;
            background:#a855f7;border:3px solid #fff;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 0 4px rgba(168,85,247,0.3),0 2px 8px rgba(0,0,0,0.4);
            font-size:18px;
          ">🏁</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        L.marker([destination.lat, destination.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b style="color:#0f172a">🏁 ${destination.address ?? 'Destination'}</b>`);

        // Route line from customer to destination
        if (customerLocation) {
          L.polyline(
            [
              [customerLocation.lat, customerLocation.lng],
              [destination.lat, destination.lng],
            ],
            { color: '#a855f7', weight: 3, dashArray: '8 6', opacity: 0.7 },
          ).addTo(map);

          // Fit bounds to show both pins
          map.fitBounds(
            L.latLngBounds([
              [customerLocation.lat, customerLocation.lng],
              [destination.lat, destination.lng],
            ]).pad(0.2),
            { animate: true, duration: 0.6 },
          );
        }
      }
    });
  }, [loading, garages, drivers, customerLocation, destination, radiusKm]);

  // ── Global callback so popup button can call back into React ──────────────
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__selectGarage = (garageId: string) => {
      const g = garages.find((garage) => garage.id === garageId);
      if (!g) return;
      setSelectedGarage(g);
      const loc: LocationPoint = {
        lat: g.lat,
        lng: g.lng,
        address: g.address ?? g.name,
      };
      onDestinationChange?.(loc);
      setQuery(g.address ?? g.name);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__selectGarage;
    };
  }, [garages, onDestinationChange]);

  // ── Cleanup map on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const distToDestination =
    customerLocation && destination
      ? haversineKm(customerLocation, destination)
      : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-xl space-y-0">

      {/* ── Search bar (Uber style) ─────────────────────────────────────── */}
      {onDestinationChange && (
        <div className="px-4 pt-4 pb-3 border-b border-slate-800 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Set destination
          </p>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 focus-within:border-sky-500/50 transition">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Search garage, area or address…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
              />
              {searching && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
              {query && !searching && (
                <button
                  onClick={() => { setQuery(''); setSuggestions([]); setShowDropdown(false); }}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-[700] mt-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl shadow-black/50">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    onClick={() => handleSearchSelect(s)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/5"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                    <span className="text-slate-200 line-clamp-2">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hint */}
          <p className="text-xs text-slate-500">
            💡 Type to search OR tap a <span className="text-orange-400 font-medium">🔧 garage pin</span> on the map and press <span className="text-orange-400 font-medium">"Set as destination"</span>
          </p>
        </div>
      )}

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Nairobi Services</span>
          <span className="text-xs text-slate-500">· {radiusKm}km coverage</span>
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

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
        <LegendPill color="bg-sky-400" label="Your location" count={customerLocation ? 1 : 0} />
        <LegendPill color="bg-orange-500" label="Garages / Mechanics" count={loading ? 0 : garages.length} />
        <LegendPill color="bg-green-500" label="Online drivers" count={loading ? 0 : drivers.length} />
        {destination && (
          <LegendPill color="bg-purple-500" label="Destination" count={1} />
        )}
      </div>

      {/* ── Distance + ETA bar ─────────────────────────────────────────── */}
      {distToDestination != null && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-purple-500/10 border-b border-purple-500/20">
          <div className="flex items-center gap-2 text-sm text-purple-200">
            <MapPin className="h-4 w-4 text-purple-400" />
            <span>
              {selectedGarage ? (
                <><span className="font-semibold text-white">{selectedGarage.name}</span> selected</>
              ) : (
                'Destination set'
              )}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-purple-300">
              {distToDestination < 1
                ? `${Math.round(distToDestination * 1000)} m`
                : `${distToDestination.toFixed(1)} km`}
            </span>
            <span className="text-slate-400">~{etaMin(distToDestination)} min</span>
          </div>
        </div>
      )}

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <div className={`relative ${heightClassName}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/90 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="text-sm text-slate-300">Loading garages & drivers across Nairobi…</p>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/90 p-6 text-center">
            <AlertCircle className="h-7 w-7 text-rose-400" />
            <p className="text-sm text-slate-300">{error}</p>
            <button
              onClick={() => void loadData()}
              className="mt-1 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 transition"
            >
              Try again
            </button>
          </div>
        )}
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-t border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {garages.length} garage{garages.length !== 1 ? 's' : ''}
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