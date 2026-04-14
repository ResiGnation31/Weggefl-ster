import { useState, useEffect, useRef } from "react";

function deg2rad(d) { return d * Math.PI / 180; }
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function totalDist(wps) {
  let d = 0;
  for (let i = 0; i < wps.length-1; i++) d += haversine(wps[i].lat, wps[i].lon, wps[i+1].lat, wps[i+1].lon);
  return d;
}
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}
function getWordCount(kmh) {
  if (kmh < 8) return 350;
  if (kmh < 25) return 250;
  if (kmh < 60) return 180;
  return 120;
}

const CATEGORIES = ["Geschichte", "Natur", "Persönlichkeiten", "Mythen", "Kulinarik", "Architektur"];

export default function App() {
  const prefersDark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  const [isDark, setIsDark] = useState(prefersDark);

  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput]     = useState("");
  const [startSugg, setStartSugg]   = useState([]);
  const [endSugg, setEndSugg]       = useState([]);
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace]     = useState(null);
  const [route, setRoute]           = useState([]);
  const [routeDist, setRouteDist]   = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [gpsMode, setGpsMode]       = useState("sim");
  const [simDist, setSimDist]       = useState(0);
  const [simSpeed, setSimSpeed]     = useState(10);
  const [simRunning, setSimRunning] = useState(false);
  const [currentDist, setCurrentDist] = useState(0);
  const [speedKmh, setSpeedKmh]     = useState(36);
  const [gpsPos, setGpsPos]         = useState(null);
  const [gpsError, setGpsError]     = useState("");
  const [currentLoc, setCurrentLoc] = useState("");
  const [storyAudio, setStoryAudio] = useState(null);
  const [category, setCategory]     = useState("Geschichte");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyText, setStoryText]   = useState("");
  const [storyLoading, setStoryLoading] = useState(false);
  const [speaking, setSpeaking]     = useState(false);
  const [spProgress, setSpProgress] = useState(0);
  const [storyCount, setStoryCount] = useState(0);
  const [arrived, setArrived]       = useState(false);
  const [voices, setVoices]         = useState([]);
  const [voiceIdx, setVoiceIdx]     = useState(0);
  const [log, setLog]               = useState([]);

  const simRef      = useRef(null);
  const simDistR    = useRef(0);
  const routeR      = useRef([]);
  const routeDistR  = useRef(0);
  const speedR      = useRef(36);
  const categoryR   = useRef("Geschichte");
  const speakingR   = useRef(false);
  const generatingR = useRef(false);
  const arrivedR    = useRef(false);
  const progRef     = useRef(null);
  const gpsRef      = useRef(null);
  const audioRef    = useRef(null);
  const memoryR     = useRef([]);
  const searchT     = useRef({});
  const voicesR     = useRef([]);
  const voiceIdxR   = useRef(0);
  const geocodeT    = useRef(0);

  useEffect(() => { categoryR.current = category; }, [category]);
  useEffect(() => { speedR.current = speedKmh; }, [speedKmh]);
  useEffect(() => { routeR.current = route; }, [route]);
  useEffect(() => { routeDistR.current = routeDist; }, [routeDist]);
  useEffect(() => { voicesR.current = voices; }, [voices]);
  useEffect(() => { voiceIdxR.current = voiceIdx; }, [voiceIdx]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() || [];
      const sorted = [...all.filter(v => v.lang.startsWith("de")), ...all.filter(v => !v.lang.startsWith("de"))];
      setVoices(sorted);
      voicesR.current = sorted;
    };
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);

  function addLog(msg, type) {
    const t = new Date().toLocaleTimeString("de", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    setLog(prev => [{ msg, type: type||"info", t }, ...prev].slice(0, 20));
  }

  async function geocode(lat, lon) {
    try {
      const r = await fetch(
        "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json&accept-language=de",
        { headers: { "User-Agent": "Weggefluesterer/1.0" } }
      );
      const d = await r.json();
      const a = d.address;
      return a.city || a.town || a.village || a.hamlet || a.suburb || a.road || a.county || "Unbekannter Ort";
    } catch { return ""; }
  }

  function stopAudio() {
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    clearInterval(progRef.current);
    setSpeaking(false);
    speakingR.current = false;
  }

  function onStoryEnd() {
    setSpeaking(false);
    speakingR.current = false;
    clearInterval(progRef.current);
    setSpProgress(100);
    setTimeout(() => {
      if (!speakingR.current && !generatingR.current && simDistR.current > 0 && simDistR.current < routeDistR.current && !arrivedR.current) {
        triggerNextStory();
      }
    }, 2000);
  }

  async function speakText(text, audioBase64) {
    stopAudio();
    setSpeaking(true);
    speakingR.current = true;
    setSpProgress(0);
    const estDur = text.length / 11.5;
    const t0 = Date.now();
    progRef.current = setInterval(() => {
      setSpProgress(Math.min((Date.now()-t0)/1000/estDur*100, 100));
    }, 300);
    if (audioBase64) {
      try {
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); onStoryEnd(); };
        audio.onerror = (e) => { console.error("Audio error:", e); URL.revokeObjectURL(url); fallbackTTS(text); };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => { console.error("Play failed:", err); URL.revokeObjectURL(url); fallbackTTS(text); });
        }
        return;
      } catch(err) { console.error("ElevenLabs decode error:", err); }
    }
    fallbackTTS(text);
  }

  function fallbackTTS(text) {
    const utter = new SpeechSynthesisUtterance(text);
    const v = voicesR.current[voiceIdxR.current];
    if (v) utter.voice = v;
    utter.lang = "de-DE";
    utter.rate = 0.88;
    utter.onend = onStoryEnd;
    utter.onerror = onStoryEnd;
    window.speechSynthesis?.speak(utter);
  }

  async function generateStory(locationName, isIntro, introData) {
    if (generatingR.current) return;
    generatingR.current = true;
    const kmh = speedR.current;
    const cat = categoryR.current;
    const words = getWordCount(kmh);
    const memory = memoryR.current;
    let prompt;
    if (isIntro && introData) {
      const tod = getTimeOfDay();
      const placeList = introData.places.join(", ");
      prompt = tod + "! Kuendige diese Fahrt an:\n" +
        "Start: " + introData.start + "\n" +
        "Ziel: " + introData.end + "\n" +
        "Thema: " + cat + "\n" +
        "Orte unterwegs: " + placeList + "\n\n" +
        "Schreibe eine persoenliche Einleitung (ca. 80 Woerter):\n" +
        "- Beginne mit '" + tod + "! Du startest jetzt...'\n" +
        "- Erwaehne Start und Ziel\n" +
        "- Mache 2-3 Orte neugierig ohne zu verraten was kommt\n" +
        "- Ende mit 'Lehn dich zurueck - es geht los.'\n" +
        "- Auf Deutsch, warm und einladend";
    } else {
      const count = storyCount;
      let memCtx = "";
      if (memory.length > 0) {
        const memLines = memory.map(function(m, i) { return (i+1) + ". " + m.place + ": " + m.summary; }).join("\n");
        memCtx = "Bereits erzaehlt:\n" + memLines + "\n\nWICHTIG: Wiederhole KEINE dieser Fakten. Knaepfe mit einem natuerlichen Uebergang an.\n\n";
      }
      const transition = count === 0
        ? "Beginne sofort mit der Geschichte."
        : "Dies ist Story " + (count+1) + ". Beginne mit einem kurzen Uebergang wie 'Und waehrend du weiterfaehrst...', 'Apropos...', oder aehnlichem.";
      prompt = memCtx +
        "Du bist ein faszinierender Reisebegleiter. Der Fahrer faehrt mit " + kmh + " km/h.\n" +
        "Aktueller Ort: " + locationName + "\n" +
        "Thema: " + cat + "\n" +
        "Laenge: ca. " + words + " Woerter\n\n" +
        transition + "\n\n" +
        "Regeln:\n" +
        "- NIEMALS mit 'Du faehrst durch [Ort], eine/eines der...' beginnen\n" +
        "- Starte mit einer konkreten Szene, Person oder Jahreszahl\n" +
        "- Sprich den Hoerer direkt an: 'Schau mal...', 'Stell dir vor...'\n" +
        "- Echte, spezifische Details: Namen, Jahreszahlen, unbekannte Fakten\n" +
        "- Ende mit einer Wendung oder einem Gedanken\n" +
        "- Nur fliesender Text auf Deutsch";
    }
    setStoryLoading(true);
    setStoryTitle(isIntro ? (introData.start + " -> " + introData.end) : locationName);
    setStoryText("");
    addLog((isIntro ? "Einleitung" : locationName), "story");
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName: locationName, category: cat, speedKmh: kmh, customPrompt: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setStoryText(data.text);
        setStoryAudio(data.audio || null);
        setStoryLoading(false);
        if (!isIntro) {
          const summary = data.text.slice(0, 120) + "...";
          memoryR.current = [...memoryR.current.slice(-4), { place: locationName, summary }];
          setStoryCount(c => c + 1);
        }
        generatingR.current = false;
        await speakText(data.text, data.audio || null);
        return;
      }
    } catch(e) { console.error(e); }
    const fallback = isIntro
      ? getTimeOfDay() + "! Du startest jetzt von " + introData.start + " nach " + introData.end + ". Lehn dich zurueck - es geht los."
      : "Du befindest dich gerade in " + locationName + " am Niederrhein.";
    setStoryText(fallback);
    setStoryLoading(false);
    generatingR.current = false;
    await speakText(fallback, null);
  }

  async function triggerNextStory() {
    if (speakingR.current || generatingR.current) return;
    const wps = routeR.current;
    if (!wps.length) return;
    const idx = Math.min(Math.floor(simDistR.current / routeDistR.current * wps.length), wps.length-1);
    const pos = wps[idx];
    const name = await geocode(pos.lat, pos.lon);
    if (name) generateStory(name, false, null);
  }

  async function searchPlaces(q, setter) {
    if (q.length < 2) { setter([]); return; }
    try {
      const r = await fetch(
        "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(q) + "&format=json&limit=5&accept-language=de",
        { headers: { "User-Agent": "Weggefluesterer/1.0" } }
      );
      setter(await r.json());
    } catch { setter([]); }
  }

  function onStartInput(val) {
    setStartInput(val);
    clearTimeout(searchT.current.s);
    searchT.current.s = setTimeout(() => searchPlaces(val, setStartSugg), 350);
  }
  function onEndInput(val) {
    setEndInput(val);
    clearTimeout(searchT.current.e);
    searchT.current.e = setTimeout(() => searchPlaces(val, setEndSugg), 350);
  }

  async function fetchRoute(start, end) {
    setRouteLoading(true);
    setRouteError("");
    stopAudio();
    simDistR.current = 0;
    setSimDist(0);
    setCurrentDist(0);
    setArrived(false);
    arrivedR.current = false;
    setStoryCount(0);
    memoryR.current = [];
    setLog([]);
    setStoryText("");
    setStoryTitle("");
    generatingR.current = false;
    try {
      const url = "https://router.project-osrm.org/route/v1/driving/" + start.lon + "," + start.lat + ";" + end.lon + "," + end.lat + "?overview=full&geometries=geojson";
      const r = await fetch(url);
      const data = await r.json();
      if (!data.routes?.length) throw new Error("Keine Route gefunden");
      const coords = data.routes[0].geometry.coordinates.map(function(c) { return { lat: c[1], lon: c[0] }; });
      setRoute(coords);
      routeR.current = coords;
      const dist = totalDist(coords);
      setRouteDist(dist);
      routeDistR.current = dist;
      const places = [];
      const step = dist / 4;
      for (let i = 1; i <= 3; i++) {
        let acc = 0;
        for (let j = 0; j < coords.length-1; j++) {
          const seg = haversine(coords[j].lat, coords[j].lon, coords[j+1].lat, coords[j+1].lon);
          if (acc + seg >= step * i) {
            const name = await geocode(coords[j].lat, coords[j].lon);
            if (name && !places.includes(name)) places.push(name);
            break;
          }
          acc += seg;
        }
      }
      addLog("Route: " + (dist/1000).toFixed(1) + " km", "start");
      setRouteLoading(false);
      return places;
    } catch(e) {
      setRouteError("Route nicht gefunden: " + e.message);
      setRouteLoading(false);
      return [];
    }
  }

  async function startSim() {
    if (!startPlace || !endPlace) return;
    try {
      const silence = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const a = new Audio(silence);
      await a.play();
    } catch(e) {}
    clearInterval(simRef.current);
    stopAudio();
    simDistR.current = 0;
    setSimDist(0);
    setCurrentDist(0);
    setArrived(false);
    arrivedR.current = false;
    setStoryCount(0);
    memoryR.current = [];
    setLog([]);
    setStoryText("");
    generatingR.current = false;
    const places = await fetchRoute(startPlace, endPlace);
    setSimRunning(true);
    addLog("Fahrt gestartet", "start");
    setTimeout(() => {
      generateStory(startPlace.name, true, {
        start: startPlace.name,
        end: endPlace.name,
        places: places.length > 0 ? places : [startPlace.name, endPlace.name],
      });
    }, 800);
  }

  useEffect(() => {
    if (!simRunning || !route.length) return;
    simRef.current = setInterval(async () => {
      simDistR.current = Math.min(simDistR.current + simSpeed * 0.4, routeDist);
      setSimDist(simDistR.current);
      setCurrentDist(simDistR.current);
      setSpeedKmh(Math.round(simSpeed * 3.6));
      speedR.current = Math.round(simSpeed * 3.6);
      const now = Date.now();
      if (now - geocodeT.current > 8000) {
        geocodeT.current = now;
        const idx = Math.min(Math.floor(simDistR.current / routeDist * route.length), route.length-1);
        const name = await geocode(route[idx].lat, route[idx].lon);
        if (name) setCurrentLoc(name);
      }
      if (simDistR.current >= routeDist && !arrivedR.current) {
        arrivedR.current = true;
        setArrived(true);
        clearInterval(simRef.current);
        setSimRunning(false);
        addLog("Ziel erreicht!", "arrival");
        if (!speakingR.current && !generatingR.current && endPlace) {
          generateStory(endPlace.name, false, null);
        }
      }
    }, 400);
    return () => clearInterval(simRef.current);
  }, [simRunning, simSpeed, routeDist, route]);

  function startGPS() {
    if (!navigator.geolocation) { setGpsError("GPS nicht verfügbar"); return; }
    addLog("GPS aktiv", "start");
    gpsRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsError("");
        if (!speakingR.current && !generatingR.current) {
          const name = await geocode(pos.coords.latitude, pos.coords.longitude);
          if (name) { setCurrentLoc(name); generateStory(name, false, null); }
        }
      },
      (err) => setGpsError("GPS Fehler: " + err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  }
  function stopGPS() {
    if (gpsRef.current) navigator.geolocation.clearWatch(gpsRef.current);
  }

  const W = 340, H = 140, P = 12;
  let mapData = null;
  if (route.length > 0) {
    const lats = route.map(w => w.lat), lons = route.map(w => w.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const px = lon => P + (lon-minLon)/Math.max(maxLon-minLon,0.001)*(W-P*2);
    const py = lat => H-P-(lat-minLat)/Math.max(maxLat-minLat,0.001)*(H-P*2);
    const idx = Math.min(Math.floor(currentDist/Math.max(routeDist,1)*route.length), route.length-1);
    mapData = { px, py, carX: px(route[idx].lon), carY: py(route[idx].lat) };
  }

  const pct = routeDist > 0 ? Math.min(currentDist/routeDist*100,100) : 0;

  const T = isDark ? {
    bg:"#0f0e0b", bgCard:"rgba(255,255,255,0.04)", bgInput:"rgba(255,255,255,0.06)", bgSugg:"#1a1208", bgMap:"rgba(0,0,0,0.45)",
    text:"#f0ede5", textMuted:"#6a5830", textFaint:"#3a2e10",
    accent:"#c8860a", accentDim:"rgba(200,134,10,0.12)", accentBorder:"rgba(200,134,10,0.25)", accentGlow:"rgba(200,134,10,0.2)",
    border:"rgba(200,134,10,0.2)", borderFaint:"rgba(200,134,10,0.08)",
    btnPrimary:"linear-gradient(135deg,#c8860a,#9a6408)", btnText:"#120e06",
    segBg:"rgba(255,255,255,0.06)", storyBg:"rgba(200,134,10,0.07)", storyBorder:"rgba(200,134,10,0.28)", storyText:"#b0a890",
    logBg:"rgba(0,0,0,0.35)", logBorder:"rgba(255,255,255,0.04)",
    toggleBg:"rgba(255,255,255,0.08)", toggleBorder:"rgba(200,134,10,0.3)",
    errorBg:"rgba(180,50,30,0.1)", errorBorder:"rgba(180,50,30,0.25)", errorText:"#c88070",
    gpsBg:"rgba(200,134,10,0.06)", inputColor:"#f0ede5",
  } : {
    bg:"#FAF7F2", bgCard:"#ffffff", bgInput:"#F2EFE8", bgSugg:"#ffffff", bgMap:"rgba(230,220,205,0.9)",
    text:"#1C1C1E", textMuted:"#A89880", textFaint:"#C5B99A",
    accent:"#B25E00", accentDim:"rgba(178,94,0,0.10)", accentBorder:"rgba(178,94,0,0.3)", accentGlow:"rgba(178,94,0,0.15)",
    border:"rgba(178,94,0,0.2)", borderFaint:"rgba(178,94,0,0.1)",
    btnPrimary:"linear-gradient(135deg,#B25E00,#8B4800)", btnText:"#ffffff",
    segBg:"#EDE8E0", storyBg:"rgba(178,94,0,0.05)", storyBorder:"rgba(178,94,0,0.25)", storyText:"#5C4A30",
    logBg:"rgba(0,0,0,0.04)", logBorder:"rgba(0,0,0,0.08)",
    toggleBg:"#EDE8E0", toggleBorder:"rgba(178,94,0,0.3)",
    errorBg:"rgba(180,50,30,0.08)", errorBorder:"rgba(180,50,30,0.2)", errorText:"#c84030",
    gpsBg:"rgba(178,94,0,0.05)", inputColor:"#1C1C1E",
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"Georgia,serif", color:T.text, overflowX:"hidden", transition:"background 0.3s, color 0.3s" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dp{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes wb{from{height:3px}to{height:18px}}
        @keyframes car{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
        *{box-sizing:border-box}
        input::placeholder{color:${T.textMuted}}
        input{caret-color:${T.accent}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${T.accentDim};border-radius:2px}
      `}</style>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"0 16px 64px" }}>

        {/* Header */}
        <div style={{ textAlign:"center", padding:"28px 0 16px", position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4 }}>
            <span style={{ fontSize:"1.8rem", fontWeight:700, letterSpacing:"-.02em", color:T.text, fontFamily:"Georgia,serif" }}>
              Weg<em style={{ color:T.accent, fontStyle:"italic" }}>geflüster</em>
            </span>
          </div>
          <div style={{ fontSize:".72rem", color:T.textMuted, letterSpacing:".06em" }}>
            Dein Reisebegleiter
          </div>
          <button onClick={() => setIsDark(d => !d)}
            style={{ position:"absolute", right:0, top:28, width:36, height:36, borderRadius:"50%", border:`1px solid ${T.toggleBorder}`, background:T.toggleBg, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s" }}>
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", gap:4, marginBottom:14, background:T.segBg, borderRadius:12, padding:3 }}>
          {["sim","real"].map(m => (
            <button key={m} onClick={() => { setGpsMode(m); if(m==="real") startGPS(); else stopGPS(); }}
              style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background:gpsMode===m?T.bgCard:"transparent", color:gpsMode===m?T.text:T.textMuted, fontFamily:"sans-serif", fontSize:".82rem", fontWeight:gpsMode===m?600:400, cursor:"pointer", transition:"all 0.2s", boxShadow:gpsMode===m?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
              {m==="sim" ? "Simulation" : "GPS"}
            </button>
          ))}
        </div>

        {gpsError && <div style={{ marginBottom:10, padding:"10px 14px", background:T.errorBg, border:`1px solid ${T.errorBorder}`, borderRadius:10, fontSize:".78rem", color:T.errorText }}>⚠️ {gpsError}</div>}

        {/* Route card */}
        <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:18, padding:18, marginBottom:14, boxShadow:isDark?"none":"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize:".66rem", color:T.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:14, textAlign:"center" }}>Route</div>

          <div style={{ position:"relative", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#34C759" }}/>
              <span style={{ fontSize:".72rem", color:T.textMuted }}>Start</span>
            </div>
            <input value={startInput} onChange={e=>onStartInput(e.target.value)}
              placeholder="z.B. Walbeck, Geldern..."
              style={{ width:"100%", background:T.bgInput, border:`1px solid ${T.accentBorder}`, borderRadius:10, padding:"10px 14px", color:T.inputColor, fontFamily:"sans-serif", fontSize:".88rem", outline:"none" }}/>
            {startSugg.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:T.bgSugg, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,0.15)" }}>
                {startSugg.map((s,i) => {
                  const p = s.display_name.split(", ");
                  return (
                    <div key={i} onClick={() => { setStartPlace({name:p[0],lat:parseFloat(s.lat),lon:parseFloat(s.lon)}); setStartInput(p[0]); setStartSugg([]); }}
                      style={{ padding:"10px 14px", cursor:"pointer", borderBottom:`1px solid ${T.borderFaint}` }}
                      onMouseEnter={e=>e.currentTarget.style.background=T.accentDim}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div style={{ fontSize:".85rem", color:T.text }}>{p[0]}</div>
                      <div style={{ fontSize:".7rem", color:T.textMuted, marginTop:2 }}>{p.slice(1,3).join(", ")}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ position:"relative", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#FF3B30" }}/>
              <span style={{ fontSize:".72rem", color:T.textMuted }}>Ziel</span>
            </div>
            <input value={endInput} onChange={e=>onEndInput(e.target.value)}
              placeholder="z.B. Kevelaer, Geldern..."
              style={{ width:"100%", background:T.bgInput, border:`1px solid ${T.accentBorder}`, borderRadius:10, padding:"10px 14px", color:T.inputColor, fontFamily:"sans-serif", fontSize:".88rem", outline:"none" }}/>
            {endSugg.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:T.bgSugg, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,0.15)" }}>
                {endSugg.map((s,i) => {
                  const p = s.display_name.split(", ");
                  return (
                    <div key={i} onClick={() => { setEndPlace({name:p[0],lat:parseFloat(s.lat),lon:parseFloat(s.lon)}); setEndInput(p[0]); setEndSugg([]); }}
                      style={{ padding:"10px 14px", cursor:"pointer", borderBottom:`1px solid ${T.borderFaint}` }}
                      onMouseEnter={e=>e.currentTarget.style.background=T.accentDim}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div style={{ fontSize:".85rem", color:T.text }}>{p[0]}</div>
                      <div style={{ fontSize:".7rem", color:T.textMuted, marginTop:2 }}>{p.slice(1,3).join(", ")}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ fontSize:".66rem", color:T.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8, textAlign:"center" }}>Thema</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding:"6px 13px", borderRadius:20, border:`1px solid ${category===c?T.accent:T.border}`, background:category===c?T.accentDim:"transparent", color:category===c?T.accent:T.textMuted, fontFamily:"sans-serif", fontSize:".75rem", fontWeight:category===c?600:400, cursor:"pointer", transition:"all 0.15s" }}>
                {c}
              </button>
            ))}
          </div>
          {routeError && <div style={{ fontSize:".75rem", color:T.errorText, marginTop:10 }}>⚠️ {routeError}</div>}
        </div>

        {/* Map */}
        {route.length > 0 && mapData && (
          <div style={{ background:T.bgMap, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden", marginBottom:12, position:"relative" }}>
            <svg width="100%" viewBox={"0 0 " + W + " " + H} style={{ display:"block" }}>
              {route.slice(0,-1).map((wp,i) => (
                <line key={i} x1={mapData.px(wp.lon)} y1={mapData.py(wp.lat)} x2={mapData.px(route[i+1].lon)} y2={mapData.py(route[i+1].lat)} stroke={T.accent} strokeWidth="1.5" strokeOpacity="0.35" strokeLinecap="round"/>
              ))}
              <circle cx={mapData.px(route[0].lon)} cy={mapData.py(route[0].lat)} r={5} fill="#34C759" stroke="#5ad079" strokeWidth="1.5"/>
              <circle cx={mapData.px(route[route.length-1].lon)} cy={mapData.py(route[route.length-1].lat)} r={5} fill="#FF3B30" stroke="#ff6b60" strokeWidth="1.5"/>
              {currentDist > 0 && (
                <g style={{ animation:simRunning?"car .5s ease-in-out infinite":"none" }}>
                  <circle cx={mapData.carX} cy={mapData.carY} r={8} fill={T.accentGlow} stroke={T.accent} strokeWidth="1.5"/>
                  <text x={mapData.carX} y={mapData.carY+5.5} textAnchor="middle" fontSize="10" style={{userSelect:"none"}}>
                    {speedKmh < 8 ? "🚶" : speedKmh < 25 ? "🚴" : "🚗"}
                  </text>
                </g>
              )}
            </svg>
            {currentLoc && <div style={{ position:"absolute", bottom:6, left:8, fontSize:".65rem", color:T.textMuted }}>📍 {currentLoc}</div>}
          </div>
        )}

        {/* Progress */}
        {routeDist > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:".7rem", color:T.textMuted }}>{startPlace?.name}</span>
              <span style={{ fontSize:".72rem", color:T.accent, fontWeight:600 }}>{pct.toFixed(1)}%</span>
              <span style={{ fontSize:".7rem", color:T.textMuted }}>{endPlace?.name}</span>
            </div>
            <div style={{ height:4, background:T.accentDim, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:pct+"%", background:`linear-gradient(90deg,${T.accent},${isDark?"#e8a820":"#D4820A"})`, borderRadius:2, transition:"width .4s linear" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
              <span style={{ fontSize:".67rem", color:T.textFaint }}>{(currentDist/1000).toFixed(2)} km</span>
              <span style={{ fontSize:".67rem", color:T.accent }}>{speedKmh} km/h · {storyCount} Stories</span>
              <span style={{ fontSize:".67rem", color:T.textFaint }}>{((routeDist-currentDist)/1000).toFixed(2)} km</span>
            </div>
          </div>
        )}

        {/* Speed */}
        {route.length > 0 && gpsMode === "sim" && (
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:"10px 14px" }}>
            <span style={{ fontSize:".75rem", color:T.textMuted }}>🚗</span>
            <input type="range" min={3} max={30} value={simSpeed} onChange={e=>setSimSpeed(+e.target.value)} style={{ flex:1, accentColor:T.accent }}/>
            <span style={{ fontSize:".75rem", color:T.accent, width:52, textAlign:"right", fontWeight:600 }}>{Math.round(simSpeed*3.6)} km/h</span>
          </div>
        )}

        {/* Voice */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:"10px 14px" }}>
          <span style={{ fontSize:".75rem", color:T.textMuted }}>🎙</span>
          <span style={{ flex:1, color:T.text, fontFamily:"sans-serif", fontSize:".82rem" }}>🎭 Helmut Stieglbauer</span>
        </div>

        {/* CTA */}
        {gpsMode === "sim" && (
          <div style={{ display:"flex", gap:9, marginBottom:16 }}>
            {!simRunning && !arrived ? (
              <button onClick={startSim} disabled={!startPlace||!endPlace||routeLoading}
                style={{ flex:1, padding:16, background:startPlace&&endPlace?T.btnPrimary:T.accentDim, border:"none", borderRadius:14, color:startPlace&&endPlace?T.btnText:T.textMuted, fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:700, cursor:startPlace&&endPlace?"pointer":"default", boxShadow:startPlace&&endPlace?`0 4px 20px ${T.accentGlow}`:"none", transition:"all 0.2s" }}>
                {routeLoading ? "Berechne Route..." : !startPlace||!endPlace ? "Start & Ziel eingeben" : "🚗 Fahrt starten"}
              </button>
            ) : (
              <>
                <button onClick={() => setSimRunning(r => !r)}
                  style={{ flex:1, padding:14, background:simRunning?T.accentDim:T.btnPrimary, border:`1px solid ${simRunning?T.accentBorder:"transparent"}`, borderRadius:13, color:simRunning?T.accent:T.btnText, fontFamily:"sans-serif", fontSize:".9rem", fontWeight:600, cursor:"pointer" }}>
                  {simRunning ? "⏸ Pause" : "▶ Weiter"}
                </button>
                <button onClick={startSim}
                  style={{ padding:"14px 18px", background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:13, color:T.textMuted, fontFamily:"sans-serif", fontSize:".9rem", cursor:"pointer" }}>
                  ↺ Neu
                </button>
              </>
            )}
          </div>
        )}

        {gpsMode === "real" && (
          <div style={{ padding:"14px 16px", background:T.gpsBg, border:`1px solid ${T.border}`, borderRadius:14, marginBottom:16, fontSize:".84rem", color:T.textMuted }}>
            📡 GPS aktiv — fahre los. Stories starten automatisch.
            {gpsPos && <div style={{ marginTop:4, fontSize:".72rem" }}>📍 {gpsPos.lat.toFixed(4)}N, {gpsPos.lon.toFixed(4)}E</div>}
          </div>
        )}

        {/* Story panel */}
        {(storyTitle || storyLoading) && (
          <div style={{ background:T.storyBg, border:`1px solid ${T.storyBorder}`, borderRadius:18, overflow:"hidden", marginBottom:14, animation:"slideIn .35s ease", boxShadow:isDark?"none":"0 2px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ padding:"16px 18px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:".66rem", color:T.textMuted, textTransform:"uppercase", letterSpacing:".12em", marginBottom:4 }}>
                  {storyCount === 0 ? "🎙️ Einleitung" : "📍 Story " + storyCount}
                </div>
                <div style={{ fontStyle:"italic", fontSize:"1.1rem", color:T.accent, lineHeight:1.25 }}>{storyTitle}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:2.5, paddingTop:4 }}>
                {[8,13,18,22,17,12,9,16,20,13].map((h,i) => (
                  <div key={i} style={{ width:2.5, borderRadius:2, background:T.accent, height:speaking?undefined:h+"px", opacity:speaking?.85:.2, animation:speaking?("wb "+(.28+(i%4)*.13)+"s "+(i*.05)+"s ease-in-out infinite alternate"):"none", minHeight:speaking?"3px":undefined, maxHeight:speaking?"22px":undefined }}/>
                ))}
              </div>
            </div>
            <div style={{ padding:"12px 18px", maxHeight:220, overflowY:"auto" }}>
              {storyLoading ? (
                <div style={{ display:"flex", gap:6, justifyContent:"center", padding:"14px 0" }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:T.accent, animation:"dp 1.2s "+(i*.2)+"s infinite" }}/>)}
                </div>
              ) : (
                <div style={{ fontSize:".9rem", lineHeight:1.9, color:T.storyText, fontWeight:300 }}>
                  {storyText.split("\n\n").map((p,i) => <p key={i} style={{ marginBottom:10 }}>{p}</p>)}
                </div>
              )}
            </div>
            {storyText && (
              <div style={{ padding:"10px 18px 16px", borderTop:`1px solid ${T.borderFaint}`, display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={() => speaking ? stopAudio() : speakText(storyText, storyAudio || null)}
                  style={{ width:40, height:40, borderRadius:"50%", background:T.accent, border:"none", cursor:"pointer", fontSize:16, flexShrink:0, color:T.btnText }}>
                  {speaking ? "⏸" : "▶"}
                </button>
                <div style={{ flex:1, height:3, background:T.accentDim, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:spProgress+"%", background:T.accent, transition:"width .3s linear" }}/>
                </div>
                {speaking && <span style={{ fontSize:".67rem", color:T.accent }}>● LIVE</span>}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!storyTitle && !storyLoading && route.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px 20px", color:T.textMuted, fontSize:".87rem", lineHeight:1.7 }}>
            <div style={{ fontSize:"2.8rem", marginBottom:12 }}>🗺️</div>
            Start und Ziel eingeben<br/>Thema wählen → Fahrt starten<br/>
            <span style={{ fontSize:".75rem", color:T.textFaint }}>Durchgehende Stories, angepasst an Ort und Geschwindigkeit</span>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background:T.logBg, border:`1px solid ${T.logBorder}`, borderRadius:10, padding:"10px 14px", maxHeight:100, overflowY:"auto" }}>
            {log.map((e,i) => (
              <div key={i} style={{ fontSize:".71rem", color:e.type==="story"?T.accent:e.type==="arrival"?"#34C759":T.textFaint, marginBottom:3, display:"flex", gap:8 }}>
                <span style={{ flexShrink:0, opacity:.5 }}>{e.t}</span><span>{e.msg}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}