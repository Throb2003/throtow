/**
 * NearbyMechanicsMap.tsx
 *
 * Drop-in Leaflet map showing nearby mechanics as avatar markers
 * with their photo (or initials fallback) and star rating below.
 *
 * Tile layer: OpenTopoMap (terrain / green feel)
 *
 * Usage:
 *   <NearbyMechanicsMap
 *     customerLocation={{ lat: -1.286, lng: 36.817 }}
 *     mechanics={nearbyMechanics}
 *   />
 *
 * Props:
 *   customerLocation  – { lat, lng } of the customer (blue pulse dot)
 *   mechanics         – array of NearbyMechanic objects (see type below)
 *   heightClassName   – optional tailwind height class (default "h-80")
 *   onSelectMechanic  – optional callback when a mechanic marker is clicked
 *
 * Dependencies already in your project:
 *   leaflet, react-leaflet  (npm install leaflet react-leaflet)
 *   @types/leaflet          (npm install -D @types/leaflet)
 *
 * Add to your global CSS / index.css:
 *   @import 'leaflet/dist/leaflet.css';
 */

import { useEffect, useRef } from "react";
import L from "leaflet";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearbyMechanic {
  id: string;
  fullName: string;
  avatarUrl?: string | null;   // photo URL – falls back to initials if absent
  rating?: number | null;      // 0-5 star rating
  speciality?: string | null;  // e.g. "Towing", "Engine repair"
  distanceKm?: number | null;  // pre-calculated distance
  location: { lat: number; lng: number };
}

interface NearbyMechanicsMapProps {
  customerLocation: { lat: number; lng: number };
  mechanics: NearbyMechanic[];
  heightClassName?: string;
  onSelectMechanic?: (mechanic: NearbyMechanic) => void;
}

// ─── Colour palette for initials avatars (cycles by mechanic index) ───────────
const AVATAR_PALETTES = [
  { bg: "#3B6D11", border: "#5DCAA5", text: "#ffffff" }, // forest green
  { bg: "#185FA5", border: "#85B7EB", text: "#ffffff" }, // deep blue
  { bg: "#534AB7", border: "#AFA9EC", text: "#ffffff" }, // violet
  { bg: "#854F0B", border: "#EF9F27", text: "#ffffff" }, // amber
  { bg: "#993C1D", border: "#F0997B", text: "#ffffff" }, // coral
  { bg: "#3C3489", border: "#7F77DD", text: "#ffffff" }, // indigo
];

// ─── Build the custom DivIcon HTML for each mechanic ─────────────────────────
function buildMechanicIcon(mechanic: NearbyMechanic, paletteIndex: number): L.DivIcon {
  const palette = AVATAR_PALETTES[paletteIndex % AVATAR_PALETTES.length];
  const initials = mechanic.fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const stars = mechanic.rating != null ? mechanic.rating.toFixed(1) : null;
  const distLabel =
    mechanic.distanceKm != null
      ? mechanic.distanceKm < 1
        ? `${Math.round(mechanic.distanceKm * 1000)}m`
        : `${mechanic.distanceKm.toFixed(1)}km`
      : null;

  // Avatar inner — photo or initials
  const avatarInner = mechanic.avatarUrl
    ? `<img
        src="${mechanic.avatarUrl}"
        alt="${mechanic.fullName}"
        style="
          width:52px;height:52px;border-radius:50%;
          object-fit:cover;display:block;
        "
        onerror="this.style.display='none';this.nextSibling.style.display='flex';"
      />
      <div style="
        display:none;width:52px;height:52px;border-radius:50%;
        background:${palette.bg};color:${palette.text};
        align-items:center;justify-content:center;
        font-size:18px;font-weight:600;font-family:sans-serif;
      ">${initials}</div>`
    : `<div style="
        width:52px;height:52px;border-radius:50%;
        background:${palette.bg};color:${palette.text};
        display:flex;align-items:center;justify-content:center;
        font-size:18px;font-weight:600;font-family:sans-serif;
      ">${initials}</div>`;

  // Star badge
  const starBadge = stars
    ? `<div style="
        position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
        background:#1a1a1a;color:#F59E0B;
        border-radius:99px;padding:1px 6px;
        font-size:10px;font-weight:700;font-family:sans-serif;
        white-space:nowrap;border:1.5px solid #F59E0B;
        display:flex;align-items:center;gap:2px;
      ">&#9733; ${stars}</div>`
    : "";

  // Name + distance label below marker
  const nameLabel = `<div style="
    margin-top:8px;
    background:rgba(255,255,255,0.92);
    border:1px solid rgba(0,0,0,0.1);
    border-radius:8px;padding:3px 8px;
    font-size:11px;font-weight:600;font-family:sans-serif;
    color:#1a1a1a;white-space:nowrap;
    box-shadow:0 1px 4px rgba(0,0,0,0.15);
    text-align:center;
  ">
    ${mechanic.fullName.split(" ")[0]}
    ${distLabel ? `<span style="color:#3B6D11;margin-left:3px;">${distLabel}</span>` : ""}
  </div>`;

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="position:relative;">
        <div style="
          border-radius:50%;
          border:3px solid ${palette.border};
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          overflow:hidden;
          width:52px;height:52px;
        ">${avatarInner}</div>
        ${starBadge}
      </div>
      ${nameLabel}
      <!-- stem -->
      <div style="
        width:2px;height:8px;
        background:${palette.border};
        border-radius:0 0 2px 2px;
      "></div>
      <div style="
        width:8px;height:8px;border-radius:50%;
        background:${palette.border};
        box-shadow:0 0 0 3px rgba(93,202,165,0.25);
      "></div>
    </div>`;

  return L.divIcon({
    html,
    className: "",           // kill leaflet's default white box
    iconSize: [90, 110],     // wide enough for name label
    iconAnchor: [45, 110],   // anchor at the bottom dot
    popupAnchor: [0, -115],
  });
}

// ─── Customer "you are here" pulsing dot ─────────────────────────────────────
function buildCustomerIcon(): L.DivIcon {
  const html = `
    <div style="position:relative;width:24px;height:24px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(56,130,220,0.25);
        animation:pulse-ring 1.8s ease-out infinite;
      "></div>
      <div style="
        position:absolute;inset:4px;border-radius:50%;
        background:#378ADD;border:2.5px solid white;
        box-shadow:0 0 0 2px #378ADD;
      "></div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%   { transform:scale(0.8); opacity:0.8; }
        100% { transform:scale(2.2); opacity:0; }
      }
    </style>`;
  return L.divIcon({ html, className: "", iconSize: [24, 24], iconAnchor: [12, 12] });
}

// ─── Build mechanic popup content ────────────────────────────────────────────
function buildPopupHtml(mechanic: NearbyMechanic): string {
  const stars = mechanic.rating != null ? "★".repeat(Math.round(mechanic.rating)) + "☆".repeat(5 - Math.round(mechanic.rating)) : "";
  const distLabel =
    mechanic.distanceKm != null
      ? mechanic.distanceKm < 1
        ? `${Math.round(mechanic.distanceKm * 1000)} m away`
        : `${mechanic.distanceKm.toFixed(1)} km away`
      : "";

  return `
    <div style="font-family:sans-serif;min-width:160px;padding:4px 0;">
      <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">
        ${mechanic.fullName}
      </div>
      ${mechanic.speciality ? `<div style="font-size:11px;color:#555;margin-bottom:4px;">${mechanic.speciality}</div>` : ""}
      ${stars ? `<div style="font-size:13px;color:#F59E0B;letter-spacing:1px;margin-bottom:2px;">${stars}</div>` : ""}
      ${mechanic.rating != null ? `<div style="font-size:11px;color:#555;margin-bottom:4px;">${mechanic.rating.toFixed(1)} / 5.0</div>` : ""}
      ${distLabel ? `<div style="font-size:11px;color:#3B6D11;font-weight:600;">${distLabel}</div>` : ""}
    </div>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NearbyMechanicsMap({
  customerLocation,
  mechanics,
  heightClassName = "h-80",
  onSelectMechanic,
}: NearbyMechanicsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // ── Initialise map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [customerLocation.lat, customerLocation.lng],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenTopoMap — terrain/green aesthetic
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '<a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; ' +
        '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update customer marker whenever location changes ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const customerMarker = L.marker([customerLocation.lat, customerLocation.lng], {
      icon: buildCustomerIcon(),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindTooltip("You are here", { permanent: false, direction: "top", offset: [0, -16] });

    map.setView([customerLocation.lat, customerLocation.lng], map.getZoom());

    return () => {
      customerMarker.remove();
    };
  }, [customerLocation]);

  // ── Rebuild mechanic markers whenever list changes ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old mechanic markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    mechanics.forEach((mechanic, index) => {
      const icon = buildMechanicIcon(mechanic, index);
      const marker = L.marker([mechanic.location.lat, mechanic.location.lng], { icon })
        .addTo(map)
        .bindPopup(buildPopupHtml(mechanic), {
          maxWidth: 220,
          className: "mechanic-popup",
        });

      if (onSelectMechanic) {
        marker.on("click", () => onSelectMechanic(mechanic));
      }

      markersRef.current.push(marker);
    });

    // Auto-fit bounds to show customer + all mechanics
    if (mechanics.length > 0) {
      const allPoints: L.LatLngExpression[] = [
        [customerLocation.lat, customerLocation.lng],
        ...mechanics.map((m) => [m.location.lat, m.location.lng] as L.LatLngExpression),
      ];
      map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50], maxZoom: 15 });
    }
  }, [mechanics, customerLocation, onSelectMechanic]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10">
      {/* Map container */}
      <div ref={mapContainerRef} className={`w-full ${heightClassName}`} />

      {/* Legend overlay */}
      <div
        className="absolute bottom-3 left-3 z-[400] rounded-xl border border-white/20 bg-black/60 px-3 py-2 backdrop-blur-sm"
        style={{ pointerEvents: "none" }}
      >
        <div className="flex items-center gap-2 text-xs text-white">
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#378ADD",
              border: "2px solid white",
              flexShrink: 0,
            }}
          />
          You
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white">
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#3B6D11",
              border: "2px solid #5DCAA5",
              flexShrink: 0,
            }}
          />
          Mechanic
        </div>
        {mechanics.length > 0 && (
          <div className="mt-1 text-xs text-slate-300">
            {mechanics.length} nearby
          </div>
        )}
      </div>

      {/* Popup custom styles injected once */}
      <style>{`
        .mechanic-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.18);
          padding: 0;
        }
        .mechanic-popup .leaflet-popup-content {
          margin: 12px 14px;
        }
        .mechanic-popup .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </div>
  );
}