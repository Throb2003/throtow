/**
 * LocationPickerMap.tsx
 * Uber/Bolt style location picker:
 * - Type to search for a place
 * - Pick from dropdown suggestions
 * - OR press "Use my current location"
 * - Map updates to show the selected pin
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLngTuple } from 'leaflet';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, Navigation, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { LocationPoint } from '@/types/app';

interface LocationPickerMapProps {
  value?: LocationPoint | null;
  onChange: (value: LocationPoint) => void;
  heightClassName?: string;
  readonly?: boolean;
  placeholder?: string;
}

const DEFAULT_CENTER: LatLngTuple = [-1.286389, 36.817223];

// ── Suggestion from Nominatim (OpenStreetMap free geocoder) ──────────────────
interface Suggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

// ── Map pin icon ──────────────────────────────────────────────────────────────
const markerIcon = (color: string) =>
  divIcon({
    className: 'service-marker-icon',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px rgba(15,23,42,0.45);border:2px solid rgba(255,255,255,0.9);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

// ── Fly map to new center when value changes ──────────────────────────────────
function SyncMapView({ center }: { center: LatLngTuple }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 0.75 });
  }, [center, map]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LocationPickerMap({
  value = null,
  onChange,
  heightClassName = 'h-56',
  readonly = false,
  placeholder = 'Search for a location…',
}: LocationPickerMapProps) {
  const { currentLocation, loading: geoLoading, error: geoError, requestCurrentLocation } = useGeolocation();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mapCenter = useMemo<LatLngTuple>(() => {
    if (value) return [value.lat, value.lng];
    if (currentLocation) return [currentLocation.lat, currentLocation.lng];
    return DEFAULT_CENTER;
  }, [value, currentLocation]);

  // ── Search Nominatim when query changes ──────────────────────────────────
  useEffect(() => {
    if (readonly) return;
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
        const data = (await res.json()) as Suggestion[];
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, readonly]);

  // ── Pick a suggestion from dropdown ──────────────────────────────────────
  const handleSelect = (suggestion: Suggestion) => {
    const location: LocationPoint = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      address: suggestion.display_name,
    };
    onChange(location);
    setQuery(suggestion.display_name);
    setShowDropdown(false);
    setSuggestions([]);
  };

  // ── Use GPS current location ──────────────────────────────────────────────
  const handleUseCurrentLocation = async () => {
    const location = await requestCurrentLocation();
    if (location) {
      onChange(location);
      setQuery(location.address ?? 'Current location');
      setShowDropdown(false);
    }
  };

  // ── Clear selection ───────────────────────────────────────────────────────
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">

      {/* ── Search box (Uber style) ─────────────────────────────────────── */}
      {!readonly && (
        <div className="relative">
          {/* Input row */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 focus-within:border-sky-500/50 transition">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
            />
            {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
            {query && !searching && (
              <button onClick={handleClear} className="text-slate-400 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown suggestions */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-[600] mt-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl shadow-black/40">
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  onClick={() => handleSelect(s)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/5"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <span className="text-slate-200 line-clamp-2">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Use current location button ─────────────────────────────────── */}
      {!readonly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleUseCurrentLocation()}
          disabled={geoLoading}
          className="w-full border-white/10 bg-slate-900/60 text-slate-300 hover:bg-white/5 hover:text-white gap-2"
        >
          {geoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4 text-sky-400" />
          )}
          {geoLoading ? 'Getting your location…' : 'Use my current location'}
        </Button>
      )}

      {/* ── Selected location label ─────────────────────────────────────── */}
      {value && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <div className="text-sm">
            <p className="font-medium text-white line-clamp-2">{value.address}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
          </div>
        </div>
      )}

      {/* ── GPS error ──────────────────────────────────────────────────── */}
      {geoError && (
        <p className="text-xs text-rose-300 px-1">{geoError}</p>
      )}

      {/* ── Mini map — shows selected pin, no clicking needed ──────────── */}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <MapContainer
          center={mapCenter}
          zoom={14}
          scrollWheelZoom={false}
          dragging={!readonly}
          zoomControl={false}
          className={heightClassName}
          style={{ width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <SyncMapView center={mapCenter} />
          {value ? (
            <Marker position={[value.lat, value.lng]} icon={markerIcon('#22c55e')} />
          ) : currentLocation ? (
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={markerIcon('#38bdf8')} />
          ) : null}
        </MapContainer>
      </div>

      {/* ── Hint when nothing selected ─────────────────────────────────── */}
      {!value && !readonly && (
        <p className="text-center text-xs text-slate-500">
          Type an address above or use your current location
        </p>
      )}
    </div>
  );
}