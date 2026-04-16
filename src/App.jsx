import { useState, useEffect, useRef } from "react";
import MapView from "./MapView";

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
function getWordCount(kmh, transport) {
  if (transport === "walk") return 400;
  if (transport === "bike") return 300;
  if (transport === "bus") return 250;
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
  const [gpsSubMode, setGpsSubMode]   = useState(null);
  const [transport, setTransport]     = useState("car");
  const [bgProgress, setBgProgress]   = useState({ car:1, bus:0, bike:0, walk:0 });
  const prevTransport = useRef("car");

  useEffect(() => {
    if (gpsMode === "real" && !currentLoc) {
      navigator.geolocation && navigator.geolocation.getCurrentPosition(async pos => {
        const name = await geocode(pos.coords.latitude, pos.coords.longitude);
        if (name) setCurrentLoc(name);
      });
    }
  }, [gpsMode]);
  const [gpsEndPlace, setGpsEndPlace] = useState(null);
  const [gpsEndInput, setGpsEndInput] = useState("");
  const [gpsEndSugg, setGpsEndSugg]   = useState([]);

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
  const transportR  = useRef("car");
  const audioRef    = useRef(null);
  const memoryR     = useRef([]);
  const searchT     = useRef({});
  const voicesR     = useRef([]);
  const voiceIdxR   = useRef(0);
  const geocodeT    = useRef(0);

  useEffect(() => { categoryR.current = category; }, [category]);
  useEffect(() => { speedR.current = speedKmh; }, [speedKmh]);
  useEffect(() => { transportR.current = transport; }, [transport]);
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
      const r = await fetch("/api/geocode?lat=" + lat + "&lon=" + lon);
      const d = await r.json();
      return d.name || "";
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
        body: JSON.stringify({ placeName: locationName, category: cat, speedKmh: kmh, transport: transportR.current, customPrompt: prompt }),
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

  function startGPS(subMode, endDest) {
    if (!navigator.geolocation) { setGpsError("GPS nicht verfügbar"); return; }
    addLog("GPS aktiv", "start");
    let firstPosition = true;
    let lastGeocode = 0;
    gpsRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsError("");
        const now = Date.now();
        if (now - lastGeocode < 15000) return;
        lastGeocode = now;
        const name = await geocode(pos.coords.latitude, pos.coords.longitude);
        if (name) {
          setCurrentLoc(name);
          if (firstPosition) {
            firstPosition = false;
            generateStory(name, false, null);
          } else if (!speakingR.current && !generatingR.current) {
            generateStory(name, false, null);
          }
        }
      },
      (err) => setGpsError("GPS Fehler: " + err.message),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
  }
  async function onGpsEndInput(val) {
    setGpsEndInput(val);
    if (val.length < 2) { setGpsEndSugg([]); return; }
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(val) + "&format=json&limit=4&accept-language=de", { headers: { "User-Agent": "Weggefluesterer/1.0" } });
      setGpsEndSugg(await r.json());
    } catch { setGpsEndSugg([]); }
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
    bg:"#1A1714", bgCard:"rgba(40,36,30,0.9)", bgInput:"rgba(255,255,255,0.06)", bgSugg:"rgba(30,26,22,0.97)",
    text:"#F0EAE0", textMuted:"#8A8070", textFaint:"#5A5448", inputColor:"#F0EAE0",
    accent:"#C9A84C", accentDim:"rgba(201,168,76,0.14)", accentBorder:"rgba(201,168,76,0.28)", accentGlow:"rgba(201,168,76,0.22)",
    btnPrimary:"#C9841C", btnText:"#ffffff",
    border:"rgba(255,255,255,0.07)", borderFaint:"rgba(255,255,255,0.04)",
    segBg:"rgba(255,255,255,0.07)", storyBg:"rgba(40,36,30,0.9)", storyBorder:"rgba(201,168,76,0.2)",
    errorBg:"rgba(180,40,40,0.15)", errorBorder:"rgba(180,40,40,0.3)", errorText:"#ff8080",
    gpsBg:"rgba(40,36,30,0.9)",
  } : {
    bg:"#F5F0E8", bgCard:"rgba(255,255,255,0.75)", bgInput:"rgba(255,255,255,0.75)", bgSugg:"rgba(250,247,242,0.97)",
    text:"#2C2014", textMuted:"#9A8060", textFaint:"#B0A080", inputColor:"#2C2014",
    accent:"#C9841C", accentDim:"rgba(201,132,28,0.12)", accentBorder:"rgba(201,132,28,0.28)", accentGlow:"rgba(201,132,28,0.2)",
    btnPrimary:"#C9841C", btnText:"#ffffff",
    border:"rgba(0,0,0,0.08)", borderFaint:"rgba(0,0,0,0.04)",
    segBg:"rgba(0,0,0,0.06)", storyBg:"rgba(255,255,255,0.75)", storyBorder:"rgba(201,132,28,0.2)",
    errorBg:"rgba(255,59,48,0.08)", errorBorder:"rgba(255,59,48,0.2)", errorText:"#C0392B",
    gpsBg:"rgba(255,255,255,0.75)",
  };
  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif", color:T.text, overflowX:"hidden", transition:"background 0.3s, color 0.3s" }}>
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

      <div style={{ maxWidth:480, margin:"0 auto", padding:"0 16px 100px" }}>

        {/* Header */}
        <div style={{ padding:"44px 24px 8px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h1 style={{ margin:0, lineHeight:1 }}>
              <span style={{ fontSize:"1.9rem", fontWeight:700, color:T.text }}>Weg</span><em style={{ fontSize:"1.9rem", fontWeight:400, color:T.accent }}>geflüster</em>
            </h1>
            <p style={{ margin:"4px 0 0", fontSize:11, color:T.textMuted, letterSpacing:"1px" }}>Dein Reisebegleiter</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => setIsDark(d => !d)}
            style={{ width:36, height:36, borderRadius:"50%", border:"none", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>
            {isDark ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <circle cx="12" cy="12" r="4.2" fill="#E09020"/>
                {[0,45,90,135,180,225,270,315].map((a,i)=>{
                  const rad=a*Math.PI/180;
                  return <line key={i} x1={12+6.8*Math.cos(rad)} y1={12+6.8*Math.sin(rad)}
                    x2={12+9.2*Math.cos(rad)} y2={12+9.2*Math.sin(rad)}
                    stroke="#E09020" strokeWidth="1.8" strokeLinecap="round"/>;
                })}
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="#C9B870"/>
              </svg>
            )}
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:14 }}>
        <div style={{ display:"inline-flex", background:T.segBg, borderRadius:12, padding:3, gap:2 }}>
          {["sim","real"].map(m => (
            <button key={m} onClick={() => { setGpsMode(m); if(m==="sim") stopGPS(); }}
              style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background:gpsMode===m?T.bgCard:"transparent", color:gpsMode===m?T.text:T.textMuted, fontFamily:"sans-serif", fontSize:".82rem", fontWeight:gpsMode===m?600:400, cursor:"pointer", transition:"all 0.2s", boxShadow:gpsMode===m?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
              {m==="sim" ? "Simulation" : "GPS"}
            </button>
          ))}
        </div>
        </div>

        {gpsError && <div style={{ marginBottom:10, padding:"10px 14px", background:T.errorBg, border:`1px solid ${T.errorBorder}`, borderRadius:10, fontSize:".78rem", color:T.errorText }}>⚠️ {gpsError}</div>}

        {/* Route card */}
        {gpsMode === "sim" && <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:18, padding:18, marginBottom:14, boxShadow:isDark?"none":"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize:".66rem", color:T.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:14 }}>Route</div>

          <div style={{ position:"relative", marginBottom:10 }}>
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", width:8, height:8, borderRadius:"50%", background:"#34C759", pointerEvents:"none" }}/>
              <input value={gpsMode==="real" ? "Dein Standort" : startInput} onChange={e=>gpsMode==="sim"&&onStartInput(e.target.value)}
                placeholder="z.B. Berlin..."
                readOnly={gpsMode==="real"}
                style={{ width:"100%", background:T.bgInput, border:`1px solid ${T.accentBorder}`, borderRadius:10, padding:"10px 14px 10px 28px", color:gpsMode==="real"?T.textMuted:T.inputColor, fontFamily:"sans-serif", fontSize:".88rem", outline:"none", cursor:gpsMode==="real"?"default":"text" }}/>
            </div>
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
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", width:8, height:8, borderRadius:"50%", background:"#FF3B30", pointerEvents:"none" }}/>
              <input value={endInput} onChange={e=>onEndInput(e.target.value)}
                placeholder="z.B. Paris..."
                style={{ width:"100%", background:T.bgInput, border:`1px solid ${T.accentBorder}`, borderRadius:10, padding:"10px 14px 10px 28px", color:T.inputColor, fontFamily:"sans-serif", fontSize:".88rem", outline:"none" }}/>
            </div>
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

          {routeError && <div style={{ fontSize:".75rem", color:T.errorText, marginTop:10 }}>⚠️ {routeError}</div>}
        </div>}

        <div style={{ padding:"0 0 4px", marginBottom:14 }}>
          <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:"0.8px", textTransform:"uppercase" }}>Thema</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            <button onClick={() => {}}
              style={{ padding:"7px 14px", borderRadius:100, fontSize:13, cursor:"pointer", border:"none", background:T.accent, color:"#fff", fontWeight:600, display:"flex", alignItems:"center", gap:5 }}>
              <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
                <path d="M6 1l1.3 2.6L10 4.1l-2 1.9.5 2.7L6 7.4 3.5 8.7l.5-2.7-2-1.9 2.7-.5z" fill="#fff" opacity="0.9"/>
              </svg>
              Lieblingsthemen
            </button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding:"7px 14px", borderRadius:100, fontSize:13, cursor:"pointer", border:"none", background: category===c ? T.accentDim : (isDark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.55)"), color: category===c ? T.accent : T.textMuted, fontWeight: category===c ? 600 : 400, backdropFilter:"blur(4px)", transition:"all 0.2s" }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        {route.length > 0 && (
          <MapView
            route={route}
            currentDist={currentDist}
            routeDist={routeDist}
            simRunning={simRunning}
            speedKmh={speedKmh}
            currentLoc={currentLoc}
          />
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <span style={{ flex:1, color:T.text, fontFamily:"sans-serif", fontSize:".82rem" }}>🎭 Helmut Stieglbauer</span>
        </div>

        {/* CTA */}
        {gpsMode === "sim" && (
          <div style={{ display:"flex", gap:9, marginBottom:16 }}>
            {!simRunning && !arrived ? (
              <button onClick={startSim} disabled={!startPlace||!endPlace||routeLoading}
                style={{ flex:1, padding:16, background:startPlace&&endPlace?T.btnPrimary:T.accentDim, border:"none", borderRadius:14, color:startPlace&&endPlace?T.btnText:T.textMuted, fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:700, cursor:startPlace&&endPlace?"pointer":"default", boxShadow:startPlace&&endPlace?`0 4px 20px ${T.accentGlow}`:"none", transition:"all 0.2s" }}>
                {routeLoading ? "Berechne Route..." : !startPlace||!endPlace ? "Start & Ziel eingeben" : "Fahrt starten"}
              </button>
            ) : (
              <>
                <button onClick={() => setSimRunning(r => !r)}
                  style={{ flex:1, padding:14, background:simRunning?T.accentDim:T.btnPrimary, border:`1px solid ${simRunning?T.accentBorder:"transparent"}`, borderRadius:13, color:simRunning?T.accent:T.btnText, fontFamily:"sans-serif", fontSize:".9rem", fontWeight:600, cursor:"pointer" }}>
                  {simRunning ? "Pause" : "Weiter"}
                </button>
                <button onClick={startSim}
                  style={{ padding:"14px 18px", background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:13, color:T.textMuted, fontFamily:"sans-serif", fontSize:".9rem", cursor:"pointer" }}>
                  Neu
                </button>
              </>
            )}
          </div>
        )}

        {gpsMode === "real" && (
          <div style={{ marginBottom:16 }}>
            {!gpsSubMode ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ background:T.bgCard, border:"1px solid " + T.border, borderRadius:14, padding:14 }}>
                  <div style={{ fontSize:".72rem", color:T.textMuted, marginBottom:8, textTransform:"uppercase", letterSpacing:".1em" }}>Mit Ziel fahren</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, padding:"8px 12px", background:T.bgInput, borderRadius:10 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#34C759", flexShrink:0 }}/>
                    <span style={{ fontSize:".83rem", color:T.textMuted }}>{currentLoc || "Warte auf GPS..."}</span>
                  </div>
                  <div style={{ position:"relative", marginBottom:10 }}>
                    <input value={gpsEndInput} onChange={e => onGpsEndInput(e.target.value)} placeholder="z.B. München Hauptbahnhof"
                      style={{ width:"100%", background:T.bgInput, border:"1px solid " + T.border, borderRadius:10, padding:"10px 14px", color:T.inputColor, fontFamily:"sans-serif", fontSize:".88rem", outline:"none", boxSizing:"border-box" }} />
                    {gpsEndSugg.length > 0 && (
                      <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:T.bgCard, border:"1px solid " + T.border, borderRadius:12, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,0.15)" }}>
                        {gpsEndSugg.map((s,i) => {
                          const p = s.display_name.split(", ");
                          return (
                            <div key={i} onClick={() => { setGpsEndPlace({name:p[0],lat:parseFloat(s.lat),lon:parseFloat(s.lon)}); setGpsEndInput(p[0]); setGpsEndSugg([]); }}
                              style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid " + T.border }}
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
                  <button onClick={() => { if (gpsEndPlace) { setGpsSubMode("guided"); startGPS("guided", gpsEndPlace); } }}
                    style={{ width:"100%", padding:13, background:gpsEndPlace?T.btnPrimary:T.accentDim, border:"none", borderRadius:12, color:gpsEndPlace?T.btnText:T.textMuted, fontFamily:"Georgia,serif", fontSize:".95rem", fontWeight:700, cursor:gpsEndPlace?"pointer":"default", transition:"all 0.2s" }}>
                    {gpsEndPlace ? "Mit Ziel fahren" : "Ziel eingeben"}
                  </button>
                </div>
                <div style={{ fontSize:".72rem", color:T.textMuted, textAlign:"center" }}>— oder —</div>
                <button onClick={() => { setGpsSubMode("free"); startGPS("free", null); }}
                  style={{ width:"100%", padding:15, background:"transparent", border:"1px solid " + T.border, borderRadius:14, color:T.text, fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
                  Frei erkunden
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", gap:9 }}>
                <div style={{ flex:1, padding:"12px 16px", background:T.bgCard, border:"1px solid " + T.border, borderRadius:14, fontSize:".84rem", color:T.textMuted }}>
                  GPS aktiv — {gpsSubMode === "free" ? "Freies Erkunden" : "Nach " + (gpsEndPlace ? gpsEndPlace.name : "")}
                </div>
                <button onClick={() => { stopGPS(); setGpsSubMode(null); setGpsEndPlace(null); setGpsEndInput(""); setGpsEndSugg([]); }}
                  style={{ padding:"12px 16px", background:T.bgCard, border:"1px solid " + T.border, borderRadius:14, color:T.textMuted, fontFamily:"sans-serif", fontSize:".88rem", cursor:"pointer" }}>
                  Stop
                </button>
              </div>
            )}
          </div>
        )}
        {/* CTA */}
        {gpsMode === "sim" && (
          <div style={{ display:"flex", gap:9, marginBottom:16 }}>
            {!simRunning && !arrived ? (
              <button onClick={startSim} disabled={!startPlace||!endPlace||routeLoading}
              style={{ flex:1, padding:16, background:T.btnPrimary, border:"none", borderRadius:14, color:T.btnText, fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:700, cursor:"pointer", boxShadow:`0 4px 20px ${T.accentGlow}`, transition:"all 0.2s" }}>
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
            <div style={{ display:"flex", justifyContent:"center", gap:24, marginBottom:20 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:.6 }}>
                <circle cx="12" cy="12" r="10"/>
                <polygon points="12,2 15,9 12,7 9,9" fill={T.accent} opacity=".9"/>
                <polygon points="12,22 9,15 12,17 15,15" fill={T.textMuted} opacity=".6"/>
                <line x1="12" y1="2" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="22" y2="12" strokeOpacity=".3"/>
              </svg>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:.6 }}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20"/>
                <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>
                <path d="M2 7h20M2 17h20" strokeOpacity=".4"/>
              </svg>
            </div>
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

      {/* Transport Bar */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background: isDark ? "rgba(26,23,20,0.92)" : "rgba(245,240,232,0.88)", backdropFilter:"blur(20px)", borderTop:"0.5px solid " + T.border, padding:"10px 0 18px", zIndex:200, transition:"background 0.4s" }}>
        <div style={{ display:"flex" }}>
          {[
            { id:"car", label:"Auto", svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:24,height:24}}><rect x="1" y="11" width="22" height="9" rx="2"/><path d="M5 11L7 6h10l2 5"/><circle cx="7.5" cy="20" r="1.5"/><circle cx="16.5" cy="20" r="1.5"/></svg> },
            { id:"bus", label:"Bus", svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:24,height:24}}><rect x="3" y="3" width="18" height="16" rx="2"/><path d="M3 10h18M8 19v2M16 19v2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></svg> },
            { id:"bike", label:"Fahrrad", svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:24,height:24}}><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M6 15l4-8h4l2 4-4 4-2-4"/><path d="M14 7h2"/></svg> },
            { id:"walk", label:"Zu Fuß", svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:24,height:24}}><circle cx="12" cy="4" r="1.5"/><path d="M10 8l-2 5h4l2 5M8 13l-2 6M16 13l1 6"/></svg> },
          ].map(({ id, label, svg }) => (
            <button key={id} onClick={() => { setTransport(id); transportR.current = id; }}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"transparent", border:"none", cursor:"pointer", padding:"4px 0" }}>
              <div style={{ width:44, height:44, borderRadius:12,
                background: transport===id ? T.accentDim : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                color: transport===id ? T.accent : T.textMuted,
                transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                transform: transport===id ? "scale(1.08)" : "scale(1)" }}>
                {svg}
              </div>
              <span style={{ fontSize:10, letterSpacing:"0.1px", color: transport===id ? T.accent : T.textMuted, fontWeight: transport===id ? 600 : 400, transition:"color 0.2s" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}