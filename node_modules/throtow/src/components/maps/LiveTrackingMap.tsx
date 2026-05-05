import { useEffect, useRef, useState } from 'react';
import { Navigation, User } from 'lucide-react';

interface LatLng {
  lat: number;
  lng: number;
  address?: string;
}

interface LiveTrackingMapProps {
  customerLocation: LatLng;
  driverLocation?: LatLng | null;
  viewerRole?: 'customer' | 'driver';
  heightClassName?: string;
}

let leafletPromise: Promise<typeof import('leaflet')> | null = null;
function getLeaflet() {
  if (!leafletPromise) {
    leafletPromise = import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      return L;
    });
  }
  return leafletPromise;
}

function distanceKm(a: LatLng, b: LatLng): number {
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

function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / 30) * 60));
}

export default function LiveTrackingMap({
  customerLocation,
  driverLocation,
  viewerRole = 'customer',
  heightClassName = 'h-72',
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const km = driverLocation ? distanceKm(driverLocation, customerLocation) : null;
  const eta = km != null ? etaMinutes(km) : null;

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    void getLeaflet().then((L) => {
      if (destroyed || !containerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [customerLocation.lat, customerLocation.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      const customerIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:32px;height:32px;">
            <div style="position:absolute;inset:0;background:rgba(56,189,248,0.25);border-radius:50%;animation:pulse 2s ease-in-out infinite;"></div>
            <div style="position:absolute;inset:6px;background:#38bdf8;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
          </div>
          <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.6);opacity:.2}}</style>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      customerMarkerRef.current = L.marker(
        [customerLocation.lat, customerLocation.lng],
        { icon: customerIcon },
      ).addTo(map).bindPopup(viewerRole === 'customer' ? '📍 Your location' : '📍 Customer location');

      mapRef.current = map;
      setReady(true);
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        mapRef.current.remove();
        mapRef.current = null;
        customerMarkerRef.current = null;
        driverMarkerRef.current = null;
        routeLineRef.current = null;
        setReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    void getLeaflet().then((L) => {
      if (!mapRef.current) return;

      if (!driverLocation) {
        if (driverMarkerRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          driverMarkerRef.current.remove();
          driverMarkerRef.current = null;
        }
        if (routeLineRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          routeLineRef.current.remove();
          routeLineRef.current = null;
        }
        return;
      }

      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">🚗</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      if (driverMarkerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
      } else {
        driverMarkerRef.current = L.marker(
          [driverLocation.lat, driverLocation.lng],
          { icon: driverIcon },
        ).addTo(mapRef.current).bindPopup(viewerRole === 'driver' ? '🚗 Your location' : '🚗 Driver location');
      }

      const points: [number, number][] = [
        [driverLocation.lat, driverLocation.lng],
        [customerLocation.lat, customerLocation.lng],
      ];

      if (routeLineRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        routeLineRef.current.setLatLngs(points);
      } else {
        routeLineRef.current = L.polyline(points, {
          color: '#f59e0b',
          weight: 3,
          dashArray: '8 6',
          opacity: 0.8,
        }).addTo(mapRef.current);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      mapRef.current.fitBounds(L.latLngBounds(points).pad(0.25), { animate: true, duration: 0.8 });
    });
  }, [ready, driverLocation, customerLocation, viewerRole]);

  return (
    <div className="space-y-2">
      {driverLocation && km != null && eta != null && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-amber-200">
            <Navigation className="h-4 w-4 text-amber-300" />
            <span>{viewerRole === 'customer' ? 'Driver is approaching' : 'Distance to customer'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-medium text-amber-300">
              {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
            </span>
            <span className="text-slate-400">~{eta} min ETA</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 px-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-sky-400" />
          {viewerRole === 'customer' ? 'Your location' : 'Customer'}
        </span>
        {driverLocation ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
            {viewerRole === 'driver' ? 'Your location' : 'Driver'}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-500">
            <User className="h-3 w-3" />
            Waiting for driver location…
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        className={`w-full overflow-hidden rounded-2xl border border-slate-800 ${heightClassName}`}
        style={{ zIndex: 0 }}
      />
    </div>
  );
}