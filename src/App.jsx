import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const LOOKAHEAD_M = 300; // trigger story this many meters before waypoint
const GPS_INTERVAL = 4000; // check GPS every 4 seconds
const STORY_RADIUS_M = 150; // trigger story when within this radius

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deg2rad(d) { return d * Math.PI / 180; }

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function totalRouteDist(waypoints) {
  let d = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    d += haversine(waypoints[i].lat, waypoints[i].lon, waypoints[i+1].lat, waypoints[i+1].lon);
  }
  return d;
}

function distAlongRoute(waypoints, lat, lon) {
  // find closest point on route and return distance traveled so far
  let minDist = Infinity, bestIdx = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const d = haversine(lat, lon, waypoints[i].lat, waypoints[i].lon);
    if (d < minDist) { minDist = d; bestIdx = i; }
  }
  let traveled = 0;
  for (let i = 0; i < bestIdx; i++) {
    traveled += haversine(waypoints[i].lat, waypoints[i].lon, waypoints[i+1].lat, waypoints[i+1].lon);
  }
  return traveled;
}

// ─── Generate story prompt ────────────────────────────────────────────────────
function buildPrompt(placeName, category, speedKmh) {
  const isWalking = speedKmh < 10;
  const isCycling = speedKmh >= 10 && speedKmh < 25;
  const length = isWalking ? "300 Wörter" : isCycling ? "220 Wörter" : "180 Wörter";
  const mode = isWalking ? "zu Fuß gehst" : isCycling ? "Fahrrad fährst" : "Auto fährst";

  return `Du bist ein faszinierender Reisebegleiter. Der Nutzer ${mode} gerade durch "${placeName}".

Erzähle eine spannende, authentische Geschichte (ca. ${length}) über diesen Ort. 

Regeln:
- Beginne SOFORT mit der Geschichte — keine Begrüßung, kein "Gerne"
- Sprich den Hörer direkt an: "Du fährst gerade...", "Rechts siehst du...", "Gleich passierst du..."
- Erzähle auf Deutsch, lebendige Erzählstimme
- Konkrete Details: Namen, Jahreszahlen, echte Fakten
- Ende mit einer überraschenden oder nachdenklichen Wendung
- Nur fließender Text, keine Aufzählungen`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Route state
  const [startInput, setStartInput]     = useState("");
  const [endInput, setEndInput]         = useState("");
  const [startSugg, setStartSugg]       = useState([]);
  const [endSugg, setEndSugg]           = useState([]);
  const [startPlace, setStartPlace]     = useState(null);
  const [endPlace, setEndPlace]         = useState(null);
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [storyPoints, setStoryPoints]   = useState([]); // interesting places along route
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError]     = useState("");

  // GPS state
  const [gpsMode, setGpsMode]           = useState("sim"); // "sim" | "real"
  const [gpsPos, setGpsPos]             = useState(null);
  const [gpsError, setGpsError]         = useState("");
  const [simDist, setSimDist]           = useState(0);
  const [simSpeed, setSimSpeed]         = useState(10);
  const [simRunning, setSimRunning]     = useState(false);
  const [speedKmh, setSpeedKmh]         = useState(30);

  // Story state
  const [activeStory, setActiveStory]   = useState(null);
  const [storyText, setStoryText]       = useState("");
  const [storyLoading, setStoryLoading] = useState(false);
  const [triggered, setTriggered]       = useState(new Set());
  const [speaking, setSpeaking]         = useState(false);
  const [spProgress, setSpProgress]     = useState(0);
  const [queue, setQueue]               = useState([]);

  // Voices
  const [voices, setVoices]             = useState([]);
  const [voiceIdx, setVoiceIdx]         = useState(0);

  // Misc
  const [arrived, setArrived]           = useState(false);
  const [totalDist, setTotalDist]       = useState(0);
  const [currentDist, setCurrentDist]   = useState(0);
  const [log, setLog]                   = useState([]);
  const [category, setCategory]         = useState("Geschichte");

  const simRef      = useRef(null);
  const simDistRef  = useRef(0);
  const triggeredRef = useRef(new Set());
  const progRef     = useRef(null);
  const queueRef    = useRef([]);
  const gpsRef      = useRef(null);
  const lastPosRef  = useRef(null);
  const lastTimeRef = useRef(null);
  const searchTimers = useRef({});

  const CATEGORIES = ["Geschichte", "Natur", "Persönlichkeiten", "Mythen", "Kulinarik", "Architektur"];

  // Load voices
  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() || [];
      setVoices([...all.filter(v => v.lang.startsWith("de")), ...all.filter(v => !v.lang.startsWith("de"))]);
    };
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const addLog = useCallback((msg, type = "info") => {
    const t = new Date().toLocaleTimeString("de", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog(prev => [{ msg, type, t }, ...prev].slice(0, 25));
  }, []);

  // ─── Search places ──────────────────────────────────────────────────────────
  const searchPlaces = useCallback(async (query, setter) => {
    if (query.length < 2) { setter([]); return; }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=de`,
        { headers: { "User-Agent": "Weggefluesterer/1.0" } }
      );
      setter(await r.json());
    } catch { setter([]); }
  }, []);

  const onStartInput = (val) => {
    setStartInput(val);
    clearTimeout(searchTimers.current.start);
    searchTimers.current.start = setTimeout(() => searchPlaces(val, setStartSugg), 350);
  };

  const onEndInput = (val) => {
    setEndInput(val);
    clearTimeout(searchTimers.current.end);
    searchTimers.current.end = setTimeout(() => searchPlaces(val, setEndSugg), 350);
  };

  // ─── Fetch route from OSRM ──────────────────────────────────────────────────
  const fetchRoute = useCallback(async (start, end) => {
    setRouteLoading(true);
    setRouteError("");
    setStoryPoints([]);
    setTriggered(new Set());
    triggeredRef.current = new Set();
    setArrived(false);
    setActiveStory(null);
    setStoryText("");
    setLog([]);
    setSimDist(0);
    simDistRef.current = 0;

    try {
      // Get route from OSRM (free routing service)
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&steps=true`;
      const r = await fetch(url);
      const data = await r.json();

      if (!data.routes?.length) throw new Error("Keine Route gefunden");

      const coords = data.routes[0].geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
      setRouteWaypoints(coords);

      const dist = totalRouteDist(coords);
      setTotalDist(dist);

      // Sample interesting points every ~500m along route
      const points = [];
      const step = Math.max(300, dist / 12);
      let accumulated = 0;

      for (let i = 0; i < coords.length - 1; i++) {
        const segDist = haversine(coords[i].lat, coords[i].lon, coords[i+1].lat, coords[i+1].lon);
        accumulated += segDist;
        if (accumulated >= step * (points.length + 1) && points.length < 10) {
          // Reverse geocode this point
          try {
            const gr = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords[i].lat}&lon=${coords[i].lon}&format=json&accept-language=de`,
              { headers: { "User-Agent": "Weggefluesterer/1.0" } }
            );
            const gdata = await gr.json();
            const addr = gdata.address;
            const name = addr.city || addr.town || addr.village || addr.hamlet || addr.road || addr.county || "Unbekannter Ort";
            // Only add if different from last point
            if (!points.length || points[points.length-1].name !== name) {
              points.push({
                id: points.length,
                lat: coords[i].lat,
                lon: coords[i].lon,
                name,
                distAlong: accumulated,
                triggered: false,
              });
            }
          } catch {}
        }
      }

      // Always add destination
      points.push({
        id: points.length,
        lat: end.lat,
        lon: end.lon,
        name: end.name,
        distAlong: dist,
        isDestination: true,
      });

      setStoryPoints(points);
      addLog(`✅ Route berechnet: ${(dist/1000).toFixed(1)} km, ${points.length} Story-Punkte`, "start");
    } catch (e) {
      setRouteError("Route konnte nicht berechnet werden: " + e.message);
    }
    setRouteLoading(false);
  }, [addLog]);

  // ─── Generate story via Claude API ─────────────────────────────────────────
  const generateStory = useCallback(async (point) => {
    if (triggeredRef.current.has(point.id)) return;
    triggeredRef.current.add(point.id);
    setTriggered(new Set(triggeredRef.current));

    const label = point.isDestination ? `Angekommen: ${point.name}` : point.name;
    addLog(`📖 ${label}`, "story");

    setStoryLoading(true);
    setActiveStory(point);
    setStoryText("");

    const prompt = buildPrompt(point.name, category, speedKmh);

    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName: point.name, category, speedKmh }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setStoryText(data.text);
        setStoryLoading(false);
        speakText(data.text);
        return;
      }
    } catch {}

    // Fallback story
    const fallback = `Du befindest dich gerade in ${point.name}. ${point.isDestination ? "Du hast dein Ziel erreicht!" : "Dieser Ort hat eine reiche Geschichte, die Jahrhunderte zurückreicht. Die Menschen hier haben diese Landschaft geprägt und hinterlassen Spuren, die bis heute sichtbar sind. Schau um dich — jeder Stein, jede Straße erzählt eine Geschichte."}`;
    setStoryText(fallback);
    setStoryLoading(false);
    speakText(fallback);
  }, [category, speedKmh, addLog]);

  // ─── Speech ─────────────────────────────────────────────────────────────────
  const speakText = useCallback((text) => {
    window.speechSynthesis?.cancel();
    clearInterval(progRef.current);
    setSpeaking(true);
    setSpProgress(0);

    const utter = new SpeechSynthesisUtterance(text);
    if (voices[voiceIdx]) utter.voice = voices[voiceIdx];
    utter.lang = "de-DE";
    utter.rate = 0.88;

    const estDur = text.length / 11.5;
    const t0 = Date.now();
    progRef.current = setInterval(() => {
      setSpProgress(Math.min((Date.now() - t0) / 1000 / estDur * 100, 100));
    }, 250);

    utter.onend = () => {
      setSpeaking(false);
      clearInterval(progRef.current);
      setSpProgress(100);
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        setQueue([...queueRef.current]);
        setTimeout(() => generateStory(next), 800);
      }
    };
    utter.onerror = () => { setSpeaking(false); clearInterval(progRef.current); };
    window.speechSynthesis?.speak(utter);
  }, [voices, voiceIdx, generateStory]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    clearInterval(progRef.current);
  }, []);

  // ─── Check proximity to story points ────────────────────────────────────────
  const checkProximity = useCallback((lat, lon, distTraveled) => {
    storyPoints.forEach(point => {
      if (triggeredRef.current.has(point.id)) return;
      const distToPoint = haversine(lat, lon, point.lat, point.lon);
      const distAlongToPoint = Math.abs(point.distAlong - distTraveled);

      if (distToPoint < STORY_RADIUS_M || distAlongToPoint < LOOKAHEAD_M) {
        if (triggeredRef.current.has("speaking")) {
          queueRef.current.push(point);
          setQueue([...queueRef.current]);
          addLog(`⏳ Warteschlange: ${point.name}`, "queue");
          triggeredRef.current.add(point.id);
          setTriggered(new Set(triggeredRef.current));
        } else {
          generateStory(point);
        }
      }
    });

    // Check arrival
    if (storyPoints.length > 0) {
      const dest = storyPoints[storyPoints.length - 1];
      const distToDest = haversine(lat, lon, dest.lat, dest.lon);
      if (distToDest < 100 && !triggeredRef.current.has("arrived")) {
        triggeredRef.current.add("arrived");
        setArrived(true);
        addLog("🏁 Ziel erreicht!", "arrival");
      }
    }
  }, [storyPoints, generateStory, addLog]);

  // ─── Real GPS ───────────────────────────────────────────────────────────────
  const startRealGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS wird von diesem Browser nicht unterstützt");
      return;
    }
    addLog("📡 GPS aktiviert", "start");
    gpsRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, speed } = pos.coords;
        const now = Date.now();

        // Calculate speed
        if (lastPosRef.current && lastTimeRef.current) {
          const dist = haversine(lastPosRef.current.lat, lastPosRef.current.lon, lat, lon);
          const time = (now - lastTimeRef.current) / 1000;
          const kmh = time > 0 ? (dist / time) * 3.6 : 0;
          setSpeedKmh(Math.round(kmh));
        }

        lastPosRef.current = { lat, lon };
        lastTimeRef.current = now;
        setGpsPos({ lat, lon });
        setGpsError("");

        if (routeWaypoints.length > 0) {
          const traveled = distAlongRoute(routeWaypoints, lat, lon);
          setCurrentDist(traveled);
          checkProximity(lat, lon, traveled);
        }
      },
      (err) => setGpsError("GPS-Fehler: " + err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, [routeWaypoints, checkProximity, addLog]);

  const stopRealGPS = useCallback(() => {
    if (gpsRef.current) navigator.geolocation.clearWatch(gpsRef.current);
    addLog("📡 GPS gestoppt", "info");
  }, [addLog]);

  // ─── Simulation ─────────────────────────────────────────────────────────────
  const generateIntro = useCallback(async (start, end, points) => {
    if (triggeredRef.current.has("intro")) return;
    triggeredRef.current.add("intro");
    setTriggered(new Set(triggeredRef.current));

    const placeNames = points.slice(0, -1).map(p => p.name).filter((v,i,a) => a.indexOf(v)===i).slice(0,4).join(", ");
    const prompt = `Du bist ein begeisternder Reisebegleiter der eine Fahrt ankündigt.

Start: "${start.name}"
Ziel: "${end.name}"
Thema heute: "${category}"
Orte unterwegs: ${placeNames || "verschiedene Orte"}

Schreibe eine persönliche, warme Einleitung (ca. 80-100 Wörter) die:
- Die Fahrt von Start nach Ziel ankündigt
- Das heutige Thema erwähnt
- 2-3 der Orte unterwegs neugierig macht ohne zu verraten was kommt
- Mit einem einladenden Satz endet wie "Lehn dich zurück — es geht los"
- Direkt beginnt ohne "Gerne" oder "Willkommen"
- Auf Deutsch, warm und persönlich klingt`;

    setStoryLoading(true);
    setActiveStory({ id: "intro", name: `${start.name} → ${end.name}`, isIntro: true });
    setStoryText("");
    addLog("🎙️ Einleitung wird generiert…", "story");

    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName: `${start.name} nach ${end.name}`, category, speedKmh, customPrompt: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setStoryText(data.text);
        setStoryLoading(false);
        speakText(data.text);
        return;
      }
    } catch {}

    const fallback = `Du fährst heute von ${start.name} nach ${end.name} — eine Route voller ${category}. ${placeNames ? `Unterwegs kommen wir an ${placeNames} vorbei.` : ""} Lehn dich zurück — es geht los.`;
    setStoryText(fallback);
    setStoryLoading(false);
    speakText(fallback);
  }, [category, speedKmh, addLog, speakText]);

  const startSim = useCallback(() => {
    simDistRef.current = 0;
    triggeredRef.current = new Set();
    queueRef.current = [];
    stopSpeech();
    setSimDist(0);
    setCurrentDist(0);
    setTriggered(new Set());
    setQueue([]);
    setLog([]);
    setArrived(false);
    setActiveStory(null);
    setStoryText("");
    setSimRunning(true);
    addLog(`🚗 Simulation gestartet`, "start");

    // Auto-trigger intro story
    setTimeout(() => {
      if (startPlace && endPlace) {
        generateIntro(startPlace, endPlace, storyPoints);
      }
    }, 800);
  }, [stopSpeech, addLog, startPlace, endPlace, storyPoints, generateIntro]);

  useEffect(() => {
    if (!simRunning || !routeWaypoints.length) return;
    simRef.current = setInterval(() => {
      simDistRef.current = Math.min(simDistRef.current + simSpeed * 0.4, totalDist);
      setSimDist(simDistRef.current);
      setCurrentDist(simDistRef.current);
      setSpeedKmh(Math.round(simSpeed * 3.6));

      // Find position at current dist
      let accumulated = 0;
      for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const seg = haversine(routeWaypoints[i].lat, routeWaypoints[i].lon, routeWaypoints[i+1].lat, routeWaypoints[i+1].lon);
        if (accumulated + seg >= simDistRef.current) {
          const t = (simDistRef.current - accumulated) / seg;
          const lat = routeWaypoints[i].lat + (routeWaypoints[i+1].lat - routeWaypoints[i].lat) * t;
          const lon = routeWaypoints[i].lon + (routeWaypoints[i+1].lon - routeWaypoints[i].lon) * t;
          checkProximity(lat, lon, simDistRef.current);
          break;
        }
        accumulated += seg;
      }

      if (simDistRef.current >= totalDist) {
        clearInterval(simRef.current);
        setSimRunning(false);
        setArrived(true);
        addLog("🏁 Simulation beendet", "arrival");
      }
    }, 400);
    return () => clearInterval(simRef.current);
  }, [simRunning, simSpeed, totalDist, routeWaypoints, checkProximity, addLog]);

  // ─── SVG Map ────────────────────────────────────────────────────────────────
  const W = 340, H = 140, P = 12;
  const mapEl = routeWaypoints.length > 0 ? (() => {
    const lats = routeWaypoints.map(w => w.lat);
    const lons = routeWaypoints.map(w => w.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const px = lon => P + (lon - minLon) / (Math.max(maxLon - minLon, 0.001)) * (W - P*2);
    const py = lat => H - P - (lat - minLat) / (Math.max(maxLat - minLat, 0.001)) * (H - P*2);

    // Car position
    let carX = px(routeWaypoints[0].lon), carY = py(routeWaypoints[0].lat);
    let accumulated = 0;
    const cd = gpsMode === "sim" ? simDist : currentDist;
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
      const seg = haversine(routeWaypoints[i].lat, routeWaypoints[i].lon, routeWaypoints[i+1].lat, routeWaypoints[i+1].lon);
      if (accumulated + seg >= cd) {
        const t = (cd - accumulated) / seg;
        carX = px(routeWaypoints[i].lon + (routeWaypoints[i+1].lon - routeWaypoints[i].lon) * t);
        carY = py(routeWaypoints[i].lat + (routeWaypoints[i+1].lat - routeWaypoints[i].lat) * t);
        break;
      }
      accumulated += seg;
    }

    return { px, py, carX, carY, minLat, maxLat, minLon, maxLon };
  })() : null;

  const pct = totalDist > 0 ? Math.min(currentDist / totalDist * 100, 100) : 0;
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(170deg,#09090f 0%,#110e08 55%,#080f08 100%)", fontFamily:"Georgia,serif", color:"#f0ede5", overflowX:"hidden" }}>
      <style>{`
        @keyframes pulse2{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dp{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes wb{from{height:3px}to{height:18px}}
        @keyframes carAnim{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
        *{box-sizing:border-box}
        input::placeholder{color:#3a2e10}
        input{caret-color:#c8860a}
        select option{background:#120e06}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#2a1f0a;border-radius:2px}
      `}</style>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"0 16px 64px" }}>

        {/* Header */}
        <div style={{ textAlign:"center", padding:"26px 0 14px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:9, marginBottom:3 }}>
            <span style={{ fontSize:20 }}>🧭</span>
            <span style={{ fontSize:"1.65rem", fontWeight:700, letterSpacing:"-.02em" }}>
              Weg<em style={{ color:"#c8860a", fontStyle:"italic" }}>geflüster</em>
            </span>
          </div>
          <div style={{ fontSize:".67rem", color:"#4a3a1a", letterSpacing:".18em", textTransform:"uppercase" }}>
            Dein KI-Reisebegleiter
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {["sim","real"].map(m => (
            <button key={m} onClick={() => { setGpsMode(m); if(m==="real") startRealGPS(); else stopRealGPS(); }}
              style={{ flex:1, padding:"9px", borderRadius:10,
                border:`1px solid ${gpsMode===m?"#c8860a":"rgba(200,134,10,.2)"}`,
                background:gpsMode===m?"rgba(200,134,10,.12)":"transparent",
                color:gpsMode===m?"#c8860a":"#6a5830",
                fontFamily:"sans-serif", fontSize:".8rem", cursor:"pointer", transition:"all .2s" }}>
              {m==="sim" ? "🚗 Simulation" : "📡 Echtes GPS"}
            </button>
          ))}
        </div>

        {gpsError && <div style={{ marginBottom:10, padding:"8px 12px", background:"rgba(180,50,30,.1)", border:"1px solid rgba(180,50,30,.25)", borderRadius:8, fontSize:".78rem", color:"#c88070" }}>⚠️ {gpsError}</div>}

        {/* Route input */}
        <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(200,134,10,.2)", borderRadius:16, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:".66rem", color:"#5a4820", textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Route eingeben</div>

          {/* Start */}
          <div style={{ position:"relative", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#5ab05a", flexShrink:0 }}/>
              <span style={{ fontSize:".72rem", color:"#6a5830" }}>Start</span>
            </div>
            <input value={startInput} onChange={e=>onStartInput(e.target.value)}
              placeholder="z.B. Grenzweg 9, Walbeck…"
              style={{ width:"100%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(200,134,10,.25)", borderRadius:9, padding:"9px 12px", color:"#f0ede5", fontFamily:"sans-serif", fontSize:".85rem", outline:"none" }}/>
            {startSugg.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#1a1208", border:"1px solid rgba(200,134,10,.2)", borderRadius:9, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,.6)" }}>
                {startSugg.map((s,i) => {
                  const parts = s.display_name.split(", ");
                  return <div key={i} onClick={()=>{ setStartPlace({name:parts[0], lat:parseFloat(s.lat), lon:parseFloat(s.lon)}); setStartInput(parts[0]); setStartSugg([]); }}
                    style={{ padding:"9px 12px", cursor:"pointer", borderBottom:"1px solid rgba(200,134,10,.08)" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(200,134,10,.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{ fontSize:".85rem" }}>{parts[0]}</div>
                    <div style={{ fontSize:".7rem", color:"#5a4820", marginTop:2 }}>{parts.slice(1,3).join(", ")}</div>
                  </div>;
                })}
              </div>
            )}
          </div>

          {/* End */}
          <div style={{ position:"relative", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#c84030", flexShrink:0 }}/>
              <span style={{ fontSize:".72rem", color:"#6a5830" }}>Ziel</span>
            </div>
            <input value={endInput} onChange={e=>onEndInput(e.target.value)}
              placeholder="z.B. Südwall 21, Geldern…"
              style={{ width:"100%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(200,134,10,.25)", borderRadius:9, padding:"9px 12px", color:"#f0ede5", fontFamily:"sans-serif", fontSize:".85rem", outline:"none" }}/>
            {endSugg.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#1a1208", border:"1px solid rgba(200,134,10,.2)", borderRadius:9, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,.6)" }}>
                {endSugg.map((s,i) => {
                  const parts = s.display_name.split(", ");
                  return <div key={i} onClick={()=>{ setEndPlace({name:parts[0], lat:parseFloat(s.lat), lon:parseFloat(s.lon)}); setEndInput(parts[0]); setEndSugg([]); }}
                    style={{ padding:"9px 12px", cursor:"pointer", borderBottom:"1px solid rgba(200,134,10,.08)" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(200,134,10,.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{ fontSize:".85rem" }}>{parts[0]}</div>
                    <div style={{ fontSize:".7rem", color:"#5a4820", marginTop:2 }}>{parts.slice(1,3).join(", ")}</div>
                  </div>;
                })}
              </div>
            )}
          </div>

          <button onClick={()=>{ if(startPlace&&endPlace) fetchRoute(startPlace,endPlace); }}
            disabled={!startPlace||!endPlace||routeLoading}
            style={{ width:"100%", padding:"11px", background:startPlace&&endPlace?"linear-gradient(135deg,#c8860a,#9a6408)":"rgba(200,134,10,.2)", border:"none", borderRadius:10, color:startPlace&&endPlace?"#120e06":"#5a4820", fontFamily:"sans-serif", fontSize:".88rem", fontWeight:600, cursor:startPlace&&endPlace?"pointer":"default", transition:"all .2s" }}>
            {routeLoading ? "Route wird berechnet…" : "🗺️ Route berechnen"}
          </button>

          {routeError && <div style={{ marginTop:8, fontSize:".75rem", color:"#c88070" }}>⚠️ {routeError}</div>}
        </div>

        {/* Category */}
        <div style={{ display:"flex", gap:7, overflowX:"auto", padding:"4px 0 8px", scrollbarWidth:"none" }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={()=>setCategory(c)} style={{ flexShrink:0, padding:"6px 12px", borderRadius:18, border:`1px solid ${category===c?"#c8860a":"#3a2f1a"}`, background:category===c?"rgba(200,134,10,.12)":"transparent", color:category===c?"#c8860a":"#6a5830", fontFamily:"sans-serif", fontSize:".74rem", cursor:"pointer", whiteSpace:"nowrap" }}>
              {c}
            </button>
          ))}
        </div>

        {/* Map */}
        {routeWaypoints.length > 0 && mapEl && (
          <div style={{ background:"rgba(0,0,0,.45)", border:"1px solid rgba(200,134,10,.12)", borderRadius:12, overflow:"hidden", marginBottom:11, position:"relative" }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
              {routeWaypoints.slice(0,-1).map((wp,i) => {
                const nx = routeWaypoints[i+1];
                return <line key={i} x1={mapEl.px(wp.lon)} y1={mapEl.py(wp.lat)} x2={mapEl.px(nx.lon)} y2={mapEl.py(nx.lat)} stroke="rgba(200,134,10,.2)" strokeWidth="2" strokeLinecap="round"/>;
              })}

              {storyPoints.map(sp => (
                <circle key={sp.id} cx={mapEl.px(sp.lon)} cy={mapEl.py(sp.lat)} r={triggered.has(sp.id)?5:3.5}
                  fill={triggered.has(sp.id)?"#c8860a":"rgba(200,134,10,.3)"}
                  stroke={triggered.has(sp.id)?"#e8a820":"rgba(200,134,10,.5)"} strokeWidth="1.5"/>
              ))}

              <circle cx={mapEl.px(routeWaypoints[0].lon)} cy={mapEl.py(routeWaypoints[0].lat)} r={5} fill="#5ab05a" stroke="#7ad07a" strokeWidth="1.5"/>
              <circle cx={mapEl.px(routeWaypoints[routeWaypoints.length-1].lon)} cy={mapEl.py(routeWaypoints[routeWaypoints.length-1].lat)} r={5} fill="#c84030" stroke="#e86050" strokeWidth="1.5"/>

              {(simDist > 0 || gpsPos) && (
                <g style={{ animation:(simRunning||gpsMode==="real")?"carAnim .5s ease-in-out infinite":"none" }}>
                  <circle cx={mapEl.carX} cy={mapEl.carY} r={8} fill="rgba(200,134,10,.2)" stroke="#c8860a" strokeWidth="1.5"/>
                  <text x={mapEl.carX} y={mapEl.carY+5.5} textAnchor="middle" fontSize="10" style={{userSelect:"none"}}>
                    {speedKmh < 8 ? "🚶" : speedKmh < 25 ? "🚴" : "🚗"}
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}

        {/* Progress */}
        {totalDist > 0 && (
          <div style={{ marginBottom:11 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:".7rem", color:"#5a4820" }}>{startPlace?.name}</span>
              <span style={{ fontSize:".72rem", color:"#c8860a", fontWeight:600 }}>{pct.toFixed(1)}%</span>
              <span style={{ fontSize:".7rem", color:"#5a4820" }}>{endPlace?.name}</span>
            </div>
            <div style={{ height:4, background:"rgba(200,134,10,.1)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:pct+"%", background:"linear-gradient(90deg,#c8860a,#e8a820)", borderRadius:2, transition:"width .4s linear" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{(currentDist/1000).toFixed(2)} km</span>
              <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{speedKmh} km/h</span>
              <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{((totalDist-currentDist)/1000).toFixed(2)} km verbleibend</span>
            </div>
          </div>
        )}

        {/* Voice + Speed */}
        {routeWaypoints.length > 0 && (
          <>
            {gpsMode === "sim" && (
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <span style={{ fontSize:".68rem", color:"#3a2e10", flexShrink:0 }}>🚗</span>
                <input type="range" min={3} max={30} value={simSpeed} onChange={e=>setSimSpeed(+e.target.value)} style={{ flex:1, accentColor:"#c8860a" }}/>
                <span style={{ fontSize:".73rem", color:"#c8860a", width:48, textAlign:"right" }}>{Math.round(simSpeed*3.6)} km/h</span>
              </div>
            )}

            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <span style={{ fontSize:".68rem", color:"#3a2e10", flexShrink:0 }}>🎙️</span>
              <select value={voiceIdx} onChange={e=>setVoiceIdx(+e.target.value)}
                style={{ flex:1, background:"rgba(255,255,255,.04)", border:"1px solid rgba(200,134,10,.18)", borderRadius:8, color:"#f0ede5", fontFamily:"sans-serif", fontSize:".79rem", padding:"6px 9px", outline:"none", cursor:"pointer" }}>
                {voices.map((v,i)=><option key={i} value={i}>{v.lang.startsWith("de")?"🇩🇪 ":"🌐 "}{v.name}</option>)}
                {!voices.length && <option>Standard</option>}
              </select>
            </div>

            {/* CTA */}
            {gpsMode === "sim" && (
              <div style={{ display:"flex", gap:9, marginBottom:14 }}>
                {!simRunning && currentDist === 0 ? (
                  <button onClick={startSim} style={{ flex:1, padding:15, background:"linear-gradient(135deg,#c8860a,#9a6408)", border:"none", borderRadius:13, color:"#120e06", fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:700, cursor:"pointer", boxShadow:"0 4px 22px rgba(200,134,10,.3)" }}>
                    🚗 Fahrt simulieren
                  </button>
                ) : (
                  <>
                    <button onClick={()=>setSimRunning(r=>!r)} style={{ flex:1, padding:13, background:simRunning?"rgba(200,134,10,.12)":"linear-gradient(135deg,#c8860a,#9a6408)", border:`1px solid ${simRunning?"rgba(200,134,10,.3)":"transparent"}`, borderRadius:12, color:simRunning?"#c8860a":"#120e06", fontFamily:"sans-serif", fontSize:".88rem", fontWeight:600, cursor:"pointer" }}>
                      {simRunning?"⏸ Pause":"▶ Weiter"}
                    </button>
                    <button onClick={startSim} style={{ padding:"13px 16px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:12, color:"#5a4820", fontFamily:"sans-serif", fontSize:".88rem", cursor:"pointer" }}>
                      ↺ Neu
                    </button>
                  </>
                )}
              </div>
            )}

            {gpsMode === "real" && (
              <div style={{ padding:"12px 16px", background:"rgba(200,134,10,.06)", border:"1px solid rgba(200,134,10,.2)", borderRadius:12, marginBottom:14, fontSize:".82rem", color:"#8a7840" }}>
                📡 GPS aktiv — fahre einfach los. Stories spielen automatisch ab wenn du an einem Punkt vorbeikommst.
                {gpsPos && <div style={{ marginTop:4, fontSize:".72rem", color:"#5a4820" }}>Position: {gpsPos.lat.toFixed(5)}°N, {gpsPos.lon.toFixed(5)}°E</div>}
              </div>
            )}
          </>
        )}

        {/* Active story */}
        {(activeStory || storyLoading) && (
          <div style={{ background:"rgba(200,134,10,.07)", border:"1px solid rgba(200,134,10,.28)", borderRadius:18, overflow:"hidden", marginBottom:13, animation:"slideIn .35s ease" }}>
            <div style={{ padding:"15px 17px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:".66rem", color:"#6a5228", textTransform:"uppercase", letterSpacing:".12em", marginBottom:3 }}>
                  {activeStory?.isDestination ? "🏁 Ziel erreicht" : "📍 Story"}
                </div>
                <div style={{ fontStyle:"italic", fontSize:"1.1rem", color:"#c8860a", lineHeight:1.25 }}>{activeStory?.name}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:2.5, paddingTop:5 }}>
                {[8,13,18,22,17,12,9,16,20,13].map((h,i)=>(
                  <div key={i} style={{ width:2.5, borderRadius:2, background:"#c8860a",
                    height:speaking?undefined:h+"px", opacity:speaking?.85:.2,
                    animation:speaking?`wb ${.28+(i%4)*.13}s ${i*.05}s ease-in-out infinite alternate`:"none",
                    minHeight:speaking?"3px":undefined, maxHeight:speaking?"22px":undefined }}/>
                ))}
              </div>
            </div>

            <div style={{ padding:"12px 17px", maxHeight:220, overflowY:"auto" }}>
              {storyLoading ? (
                <div style={{ display:"flex", gap:6, justifyContent:"center", padding:"12px 0" }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#c8860a", animation:`dp 1.2s ${i*.2}s infinite` }}/>)}
                </div>
              ) : (
                <div style={{ fontSize:".9rem", lineHeight:1.9, color:"#b0a890", fontWeight:300 }}>
                  {storyText.split("\n\n").map((p,i)=><p key={i} style={{marginBottom:10}}>{p}</p>)}
                </div>
              )}
            </div>

            {storyText && (
              <div style={{ padding:"10px 17px 15px", borderTop:"1px solid rgba(200,134,10,.1)", display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={()=>speaking?stopSpeech():speakText(storyText)}
                  style={{ width:38, height:38, borderRadius:"50%", background:"#c8860a", border:"none", cursor:"pointer", fontSize:16, flexShrink:0 }}>
                  {speaking?"⏸":"▶"}
                </button>
                <div style={{ flex:1, height:3, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:spProgress+"%", background:"#c8860a", transition:"width .3s linear" }}/>
                </div>
                {speaking && <span style={{ fontSize:".67rem", color:"#c8860a" }}>● LIVE</span>}
              </div>
            )}
          </div>
        )}

        {/* Story points list */}
        {storyPoints.length > 0 && (
          <div style={{ marginBottom:13 }}>
            <div style={{ fontSize:".65rem", color:"#3a2e10", textTransform:"uppercase", letterSpacing:".13em", marginBottom:8 }}>Story-Punkte</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {storyPoints.map(sp => {
                const done = triggered.has(sp.id);
                const rem = Math.max(0, sp.distAlong - currentDist);
                const isCur = activeStory?.id === sp.id;
                return (
                  <div key={sp.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 11px", borderRadius:10,
                    background:isCur?"rgba(200,134,10,.1)":"rgba(255,255,255,.02)",
                    border:`1px solid ${isCur?"rgba(200,134,10,.28)":"rgba(255,255,255,.04)"}`,
                    opacity:done?.55:1, transition:"all .3s" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                      background:done?"#c8860a":rem<300?"#e8a820":"rgba(200,134,10,.28)",
                      border:`1.5px solid ${done?"#e8a820":"rgba(200,134,10,.4)"}` }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:".78rem", color:done?"#5a4820":"#c0b898" }}>
                        {sp.isDestination ? "🏁 " : ""}{sp.name}
                      </div>
                    </div>
                    <div style={{ fontSize:".69rem", color:done?"#3a2e10":rem<100?"#e8a820":"#4a3810", flexShrink:0 }}>
                      {done?"✓":rem<50?"jetzt":`${Math.round(rem)}m`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {routeWaypoints.length === 0 && (
          <div style={{ textAlign:"center", padding:"30px 20px", color:"#4a3a1a", fontSize:".87rem", lineHeight:1.7 }}>
            <div style={{ fontSize:"2.4rem", marginBottom:11 }}>🗺️</div>
            Start und Ziel eingeben<br/>dann Route berechnen — los geht's!
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background:"rgba(0,0,0,.35)", border:"1px solid rgba(255,255,255,.04)", borderRadius:10, padding:"9px 12px", maxHeight:110, overflowY:"auto" }}>
            <div style={{ fontSize:".63rem", color:"#2a2010", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Log</div>
            {log.map((e,i)=>(
              <div key={i} style={{ fontSize:".71rem", color:e.type==="story"?"#c8860a":e.type==="arrival"?"#5ab05a":"#3a2e10", marginBottom:3, display:"flex", gap:8 }}>
                <span style={{ flexShrink:0, opacity:.5 }}>{e.t}</span><span>{e.msg}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
