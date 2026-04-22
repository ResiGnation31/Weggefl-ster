import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = (import.meta.env.VITE_MAPBOX_TOKEN || "").trim();

export default function MapboxView({ onLocationSelect, userLat, userLon, isDark, followUser = true, accent = "#B25E00", heading = null }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [followHeading, setFollowHeading] = useState(false);

  function toggle3D() {
    setIs3D(f => {
      const next = !f;
      mapInstanceRef.current?.easeTo({ pitch: next ? 45 : 0, bearing: 0, duration: 600 });
      return next;
    });
  }

  function toggleFullscreen() {
    setIsFullscreen(f => {
      const next = !f;
      document.body.style.overflow = next ? "hidden" : "";
      setTimeout(() => {
        mapInstanceRef.current?.resize();
      }, 100);
      return next;
    });
  }
  const [mapStyle, setMapStyle] = useState(isDark ? 'dark' : 'streets');
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
    function add3DBuildings(dark) {
      if (mapInstanceRef.current.getLayer("3d-buildings")) return;
      mapInstanceRef.current.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": dark ? "#2a2a2a" : "#e8e0d8",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.8
        }
      });
    }
    mapInstanceRef.current.on("load", () => {
      add3DBuildings(isDark);
      mapInstanceRef.current.easeTo({ pitch: 45, bearing: 0, duration: 1000 });
    });
    if (userLat && userLon) {
      const el = document.createElement("div");
      el.style.cssText = "width:16px;height:16px;background:accent;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)";
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
        el.style.cssText = "width:16px;height:16px;background:accent;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)";
        userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([userLon, userLat]).addTo(mapInstanceRef.current);
      }
      if (followUser) {
        const bearing = followHeading && heading != null ? heading : 0;
        mapInstanceRef.current.easeTo({ center: [userLon, userLat], zoom: 15, bearing, duration: 800 });
      }
    }
  }, [userLat, userLon]);

  function flyToUser() {
    if (mapInstanceRef.current && userLat && userLon) {
      mapInstanceRef.current.flyTo({ center: [userLon, userLat], zoom: 15, duration: 800 });
    }
  }

  const styles = [
    { id: 'streets', label: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, url: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'dark', label: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>, url: 'mapbox://styles/mapbox/dark-v11' },
    { id: 'satellite', label: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>, url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  ];

  function switchStyle(styleId) {
    setMapStyle(styleId);
    const url = styles.find(s => s.id === styleId).url;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setStyle(url);
      mapInstanceRef.current.once("styledata", () => {
        if (mapInstanceRef.current.getSource("composite")) {
          if (mapInstanceRef.current.getLayer("3d-buildings")) mapInstanceRef.current.removeLayer("3d-buildings");
          mapInstanceRef.current.addLayer({
            id: "3d-buildings", source: "composite", "source-layer": "building",
            filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 14,
            paint: {
              "fill-extrusion-color": styleId === 'dark' ? "#2a2a2a" : "#e8e0d8",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.8
            }
          });
        }
      });
    }
  }

  return (
    <div style={{ position: isFullscreen ? "fixed" : "relative", top: 0, left: 0, right: 0, bottom: 0, width: isFullscreen ? "100vw" : "100%", height: isFullscreen ? "100dvh" : "100%", zIndex: isFullscreen ? 9999 : "auto", borderRadius: isFullscreen ? 0 : 16, overflow: "hidden", transition: "border-radius 0.3s ease" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }}/>

      {/* Standort Button */}
      <button onClick={flyToUser} style={{ position:"absolute", top:10, left:10, width:36, height:36, background:"white", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", zIndex:10 }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>

      {/* Kompass / Heading Button */}
      <button onClick={() => setFollowHeading(f => !f)} style={{ position:"absolute", top:54, left:10, width:36, height:36, background: followHeading ? accent : "white", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", zIndex:10 }}
        title={followHeading ? "Fahrtrichtung" : "Norden"}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" strokeLinecap="round">
          <polygon points="12,2 15,10 12,8 9,10" fill={followHeading ? "white" : accent} stroke={followHeading ? "white" : accent}/>
          <polygon points="12,22 9,14 12,16 15,14" fill={followHeading ? "rgba(255,255,255,0.4)" : "#ccc"} stroke={followHeading ? "rgba(255,255,255,0.4)" : "#ccc"}/>
          <circle cx="12" cy="12" r="1.5" fill={followHeading ? "white" : accent}/>
        </svg>
      </button>

      {/* 2D/3D Toggle */}
      <button onClick={toggle3D} style={{ position:"absolute", top:10, left:98, width:36, height:36, background: is3D ? "accent" : "white", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", zIndex:10, color: is3D ? "white" : "accent", fontWeight:700, fontSize:13 }}>
        {is3D ? "3D" : "2D"}
      </button>

      {/* Vollbild Button */}
      <button onClick={toggleFullscreen} style={{ position:"absolute", top:10, left:54, width:36, height:36, background:"white", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", zIndex:10 }}>
        {isFullscreen
          ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={accent} strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={accent} strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        }
      </button>

      {/* Kartenstil Auswahl */}
      <div style={{ position:"absolute", top:10, right:50, display:"flex", gap:4, zIndex:10 }}>
        {styles.map(s => (
          <button key={s.id} onClick={() => switchStyle(s.id)}
            style={{ width:36, height:36, background: mapStyle===s.id ? "accent" : "white", border:"none", borderRadius:8, cursor:"pointer", fontSize:16, boxShadow:"0 2px 8px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {s.label}
          </button>
        ))}
      </div>

      {selectedPlace && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#2C1810" }}>{selectedPlace.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8B7355" }}>Tippe fuer eine Story</p>
          </div>
          <button onClick={() => onLocationSelect && onLocationSelect(selectedPlace)}
            style={{ background: "accent", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Story
          </button>
        </div>
      )}
    </div>
  );
}