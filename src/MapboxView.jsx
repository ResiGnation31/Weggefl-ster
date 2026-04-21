import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapboxView({ onLocationSelect, userLat, userLon, isDark, followUser = true }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = new mapboxgl.Map({
      container: mapRef.current,
      style: isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12",
      center: [userLon || 10, userLat || 51],
      zoom: userLat ? 14 : 6,
    });
    mapInstanceRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    if (userLat && userLon) {
      const el = document.createElement("div");
      el.style.cssText = "width:16px;height:16px;background:#B25E00;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)";
      userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([userLon, userLat]).addTo(mapInstanceRef.current);
    }
    mapInstanceRef.current.on("click", async (e) => {
      const { lng, lat } = e.lngLat;
      // Zuerst: Gibt es einen benannten POI an dieser Stelle?
      const features = mapInstanceRef.current.queryRenderedFeatures(e.point);
      const poi = features.find(f => f.properties?.name);
      const poiName = poi?.properties?.name || null;
      if (poiName) {
        // POI direkt antippen -> sofort Story
        const place = { name: poiName, lat, lon: lng };
        setSelectedPlace(place);
        if (onLocationSelect) onLocationSelect(place);
        return;
      }
      // Kein POI: Reverse-Geocoding für leere Stelle
      try {
        const r = await fetch("https://api.mapbox.com/geocoding/v5/mapbox.places/" + lng + "," + lat + ".json?language=de&access_token=" + mapboxgl.accessToken);
        const d = await r.json();
        const shortName = d.features?.[0]?.text || "Dieser Ort";
        const place = { name: shortName, lat, lon: lng };
        setSelectedPlace(place);
        if (onLocationSelect) onLocationSelect(place);
      } catch {
        const place = { name: "Dieser Ort", lat, lon: lng };
        setSelectedPlace(place);
        if (onLocationSelect) onLocationSelect(place);
      }
    });
    return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setStyle(isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12");
  }, [isDark]);

  useEffect(() => {
    if (!userLat || !userLon) return;
    if (mapInstanceRef.current) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLon, userLat]);
      } else {
        const el = document.createElement("div");
        el.style.cssText = "width:16px;height:16px;background:#B25E00;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)";
        userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([userLon, userLat]).addTo(mapInstanceRef.current);
      }
      if (followUser) mapInstanceRef.current.flyTo({ center: [userLon, userLat], zoom: 15, duration: 1200 });
    }
  }, [userLat, userLon]);

  function flyToUser() {
    if (mapInstanceRef.current && userLat && userLon) {
      mapInstanceRef.current.flyTo({ center: [userLon, userLat], zoom: 15, duration: 800 });
    }
  }

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }}/>
      {/* Standort Button */}
      <button onClick={flyToUser} style={{ position:"absolute", top:10, left:10, width:36, height:36, background:"white", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", zIndex:10 }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#B25E00" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
      {selectedPlace && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#2C1810" }}>{selectedPlace.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8B7355" }}>Tippe fuer eine Story</p>
          </div>
          <button onClick={() => onLocationSelect && onLocationSelect(selectedPlace)}
            style={{ background: "#B25E00", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Story
          </button>
        </div>
      )}
    </div>
  );
}