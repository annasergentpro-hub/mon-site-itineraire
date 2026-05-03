import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoPoint, RankedStop, formatDistance, formatDuration } from "@/lib/distances";

type RouteMapProps = {
  origin: GeoPoint;
  stopsAsc: RankedStop[];
  stopsDesc: RankedStop[];

  onReorderAsc?: (newOrder: GeoPoint[]) => Promise<void>;
  onReorderDesc?: (newOrder: GeoPoint[]) => Promise<void>;
};

const buildIcon = (label: string, color: string) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; color: white; font-weight: bold;
        border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        font-family: sans-serif; font-size: 12px;
      ">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
};

export const RouteMap = ({ origin, stopsAsc = [], stopsDesc = [] }: RouteMapProps) => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const polyAsc = useMemo(() => [
    [origin.lat, origin.lon] as [number, number],
    ...stopsAsc.map(s => [s.lat, s.lon] as [number, number])
  ], [origin, stopsAsc]);

  const polyDesc = useMemo(() => [
    [origin.lat, origin.lon] as [number, number],
    ...stopsDesc.map(s => [s.lat, s.lon] as [number, number])
  ], [origin, stopsDesc]);

  const allPoints = [...polyAsc, ...polyDesc];

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-border shadow-2xl relative">
      <MapContainer
        center={[origin.lat, origin.lon]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        key={tileUrl}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />

        {/* Tracé Croissant - Bleu */}
        {stopsAsc.length > 0 && (
          <Polyline positions={polyAsc} pathOptions={{ color: "#3b82f6", weight: 6, opacity: 0.7 }} />
        )}

        {/* Tracé Décroissant - Orange/Rouge */}
        {stopsDesc.length > 0 && (
          <Polyline positions={polyDesc} pathOptions={{ color: "#f97316", weight: 4, opacity: 0.7, dashArray: "10, 10" }} />
        )}

        {/* Marqueur Départ */}
        <Marker position={[origin.lat, origin.lon]} icon={buildIcon("D", "#22d3ee")} />

        {/* Marqueurs Étapes */}
        {(stopsAsc.length > 0 ? stopsAsc : stopsDesc).map((s) => (
          <Marker 
            key={`${s.lat}-${s.lon}`} 
            position={[s.lat, s.lon]} 
            icon={buildIcon(String(s.order), "#6366f1")}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <p className="font-bold">{s.label}</p>
                <p className="text-xs">{formatDistance(s.distanceFromPrev)} · {formatDuration(s.durationFromPrev)}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds points={allPoints} />
      </MapContainer>
    </div>
  );
};
