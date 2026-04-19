import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function MapView({ route, currentDist, routeDist, simRunning, speedKmh, currentLoc, gpsPos }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);
  const carMarkerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([51.5, 10], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route.length) return;
    if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
    if (startMarkerRef.current) map.removeLayer(startMarkerRef.current);
    if (endMarkerRef.current) map.removeLayer(endMarkerRef.current);
    const latlngs = route.map(p => [p.lat, p.lon]);
    routeLayerRef.current = L.polyline(latlngs, { color: "#B25E00", weight: 4, opacity: 0.85 }).addTo(map);
    const greenIcon = L.divIcon({
      html: '<div style="width:12px;height:12px;background:#34C759;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
      className: "", iconAnchor: [6, 6],
    });
    const redIcon = L.divIcon({
      html: '<div style="width:12px;height:12px;background:#FF3B30;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
      className: "", iconAnchor: [6, 6],
    });
    startMarkerRef.current = L.marker([route[0].lat, route[0].lon], { icon: greenIcon }).addTo(map);
    endMarkerRef.current = L.marker([route[route.length-1].lat, route[route.length-1].lon], { icon: redIcon }).addTo(map);
    map.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] });
  }, [route]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route.length) return;
    let pos;
    if (gpsPos && gpsPos.lat) {
      pos = gpsPos;
    } else {
      const idx = Math.min(Math.floor(currentDist / Math.max(routeDist, 1) * route.length), route.length - 1);
      pos = route[idx];
    }
    const carIcon = L.divIcon({
      html: '<div style="width:24px;height:24px;background:#B25E00;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,0.4)">&#x1F697;</div>',
      className: "", iconAnchor: [12, 12],
    });
    if (carMarkerRef.current) {
      carMarkerRef.current.setLatLng([pos.lat, pos.lon]);
      carMarkerRef.current.setIcon(carIcon);
    } else {
      carMarkerRef.current = L.marker([pos.lat, pos.lon], { icon: carIcon }).addTo(map);
    }
    if (simRunning || gpsPos) {
      map.panTo([pos.lat, pos.lon], { animate: true, duration: 0.5 });
    }
  }, [currentDist, route, routeDist, simRunning, speedKmh, gpsPos]);

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 12, border: "1px solid rgba(178,94,0,0.2)" }}>
      <div ref={mapRef} style={{ height: 200, width: "100%" }} />
      {currentLoc && (
        <div style={{ position: "absolute", bottom: 8, left: 8, zIndex: 1000, background: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "4px 10px", fontSize: ".68rem", color: "#5C4A30", pointerEvents: "none" }}>
          {currentLoc}
        </div>
      )}
    </div>
  );
}