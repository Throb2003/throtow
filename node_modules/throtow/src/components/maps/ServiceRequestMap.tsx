import { useEffect, useMemo } from 'react';
import { LatLngBounds, type LatLngTuple, divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { LocationPoint } from '@/types/app';

interface ServiceRequestMapProps {
  requestLocation: LocationPoint;
  providerLocation?: LocationPoint | null;
  destination?: LocationPoint | null;
  heightClassName?: string;
}

const markerIcon = (color: string) =>
  divIcon({
    className: 'service-request-marker-icon',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px rgba(15,23,42,0.45);border:2px solid rgba(255,255,255,0.9);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 1) {
      map.flyTo(points[0], 14, { duration: 0.75 });
      return;
    }

    const bounds = new LatLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

export default function ServiceRequestMap({
  requestLocation,
  providerLocation = null,
  destination = null,
  heightClassName = 'h-72',
}: ServiceRequestMapProps) {
  const points = useMemo<LatLngTuple[]>(
    () =>
      [
        [requestLocation.lat, requestLocation.lng],
        providerLocation ? [providerLocation.lat, providerLocation.lng] : null,
        destination ? [destination.lat, destination.lng] : null,
      ].filter(Boolean) as LatLngTuple[],
    [destination, providerLocation, requestLocation.lat, requestLocation.lng],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
      <MapContainer
        center={points[0]}
        zoom={13}
        scrollWheelZoom
        className={heightClassName}
        style={{ width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <Marker
          position={[requestLocation.lat, requestLocation.lng]}
          icon={markerIcon('#22c55e')}
        />
        {providerLocation ? (
          <Marker
            position={[providerLocation.lat, providerLocation.lng]}
            icon={markerIcon('#38bdf8')}
          />
        ) : null}
        {destination ? (
          <Marker position={[destination.lat, destination.lng]} icon={markerIcon('#f59e0b')} />
        ) : null}
      </MapContainer>
    </div>
  );
}