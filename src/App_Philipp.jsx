import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const STORY_RADIUS_M = 200;      // within this radius = "at this place"
const CHECK_INTERVAL = 3000;     // check location every 3 seconds
const GEOCODE_INTERVAL = 8000;   // reverse geocode every 8 seconds

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deg2rad(d) { return d * Math.PI / 180; }
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function totalRouteDist(wps) {
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

// ─── Story length based on speed ─────────────────────────────────────────────
function getStoryLength(kmh) {
  if (kmh < 8)  return { words: 350, label: "lang (zu Fuß)" };
  if (kmh < 25) return { words: 250, label: "mittel (Fahrrad)" };
  if (kmh < 60) return { words: 180, label: "kurz (Stadt)" };
  return { words: 120, label: "sehr kurz (Autobahn)" };
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Route
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput]     = useState("");
  const [startSugg, setStartSugg]   = useState([]);
  const [endSugg, setEndSugg]       = useState([]);
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace]     = useState(null);
  const [routeWPs, setRouteWPs]     = useState([]);
  const [totalDist, setTotalDist]   = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  // GPS / Sim
  const [gpsMode, setGpsMode]       = useState("sim");
  const [simDist, setSimDist]       = useState(0);
  const [simSpeed, setSimSpeed]     = useState(10);
  const [simRunning, setSimRunning] = useState(false);
  const [currentDist, setCurrentDist] = useState(0);
  const [speedKmh, setSpeedKmh]     = useState(36);
  const [gpsPos, setGpsPos]         = useState(null);
  const [gpsError, setGpsError]     = useState("");

  // Current location name (reverse geocoded)
  const [currentLocationName, setCurrentLocationName] = useState("");
  const [lastGeocodedDist, setLastGeocodedDist]       = useState(-99999);

  // Story
  const [activeStory, setActiveStory]   = useState(null);
  const [storyText, setStoryText]       = useState("");
  const [storyLoading, setStoryLoading] = useState(false);
  const [speaking, setSpeaking]         = useState(false);
  const [spProgress, setSpProgress]     = useState(0);
  const [category, setCategory]         = useState("Geschichte");
  const [log, setLog]                   = useState([]);
  const [arrived, setArrived]           = useState(false);
  const [storyCount, setStoryCount]     = useState(0);

  // Voices
  const [voices, setVoices]   = useState([]);
  const [voiceIdx, setVoiceIdx] = useState(0);

  // Refs
  const simRef          = useRef(null);
  const simDistRef      = useRef(0);
  const progRef         = useRef(null);
  const gpsRef          = useRef(null);
  const isSpeakingRef   = useRef(false);
  const isGeneratingRef = useRef(false);
  const routeWPsRef     = useRef([]);
  const totalDistRef    = useRef(0);
  const speedRef        = useRef(36);
  const categoryRef     = useRef("Geschichte");
  const currentLocRef   = useRef("");
  const lastGeoRef      = useRef(-99999);
  const storyCountRef   = useRef(0);
  const searchTimers    = useRef({});
  const startPlaceRef   = useRef(null);
  const endPlaceRef     = useRef(null);
  const arrivedRef      = useRef(false);
  const voiceIdxRef     = useRef(0);
  const voicesRef       = useRef([]);

  const CATEGORIES = ["Geschichte", "Natur", "Persönlichkeiten", "Mythen", "Kulinarik", "Architektur"];

  // Sync refs
  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { speedRef.current = speedKmh; }, [speedKmh]);
  useEffect(() => { routeWPsRef.current = routeWPs; }, [routeWPs]);
  useEffect(() => { totalDistRef.current = totalDist; }, [totalDist]);
  useEffect(() => { startPlaceRef.current = startPlace; }, [startPlace]);
  useEffect(() => { endPlaceRef.current = endPlace; }, [endPlace]);
  useEffect(() => { voiceIdxRef.current = voiceIdx; }, [voiceIdx]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);

  // Load voices
  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() || [];
      const sorted = [...all.filter(v => v.lang.startsWith("de")), ...all.filter(v => !v.lang.startsWith("de"))];
      setVoices(sorted);
      voicesRef.current = sorted;
    };
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const addLog = useCallback((msg, type = "info") => {
    const t = new Date().toLocaleTimeString("de", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    setLog(prev => [{ msg, type, t }, ...prev].slice(0, 20));
  }, []);

  // ─── Reverse geocode current position ────────────────────────────────────
  const geocodePosition = useCallback(async (lat, lon) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
        { headers: { "User-Agent": "Weggefluesterer/1.0" } }
      );
      const d = await r.json();
      const addr = d.address;
      const name = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.road || addr.county || "Niederrhein";
      currentLocRef.current = name;
      setCurrentLocationName(name);
      return name;
    } catch {
      return currentLocRef.current || "Unbekannter Ort";
    }
  }, []);

  // ─── Story memory ────────────────────────────────────────────────────────
  const storyMemory = useRef([]); // remembers what was told

  // ─── Generate story via API ───────────────────────────────────────────────
  const generateStory = useCallback(async (locationName, isIntro = false, introData = null) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    const kmh = speedRef.current;
    const cat = categoryRef.current;
    const { words } = getStoryLength(kmh);
    const count = storyCountRef.current;
    const memory = storyMemory.current;

    let prompt;
    if (isIntro && introData) {
      const { start, end, places } = introData;
      const tod = getTimeOfDay();
      prompt = `Du bist ein begeisternder Reisebegleiter.

${tod}! Kündige diese Fahrt an:
Start: "${start}"
Ziel: "${end}"  
Thema: "${cat}"
Orte unterwegs: ${places.join(", ")}

Schreibe eine persönliche Einleitung (ca. 80 Wörter):
- Beginne mit "${tod}! Du startest jetzt..."
- Erwähne Start und Ziel
- Mache 2-3 Orte neugierig ohne zu verraten was kommt
- Ende mit "Lehn dich zurück — es geht los."
- Auf Deutsch, warm und einladend`;
    } else {
      const isFirst = count === 0;

      // Build memory context
      const memoryContext = memory.length > 0
        ? `Bereits erzählt auf dieser Fahrt:
${memory.map((m,i) => (i+1) + ". " + m.place + ": " + m.summary).join("\n")}

WICHTIG: Wiederhole KEINE der oben genannten Fakten. Knüpfe mit einem natürlichen Uebergang an.`
        : "";

      const transition = isFirst
        ? `Beginne sofort mit der Geschichte.`
        : `Dies ist Story ${count + 1}. Beginne mit einem kurzen Uebergang wie "Und während du weiterfährst...", "Apropos...", "Nur ein paar Meter weiter..." oder ähnlichem — dann direkt in die neue Geschichte.`;

      prompt = `Du bist ein faszinierender Reisebegleiter auf einer Fahrt. Der Fahrer fährt mit ${kmh} km/h.

Aktueller Ort: "${locationName}"
Thema heute: "${cat}"
Story-Länge: ca. ${words} Wörter

${memoryContext}

${transition}

Regeln:
- NIEMALS mit "Du fährst durch [Ort], eine/eines der..." beginnen — das klingt wie Wikipedia
- Starte mit einer konkreten Szene, Person, Jahreszahl oder Anekdote
- Sprich den Hörer direkt an: "Schau mal...", "Stell dir vor...", "Hier passierte..."
- Echte, spezifische Details: Namen, Jahreszahlen, unbekannte Fakten
- Lebendige Erzählstimme — wie ein lokaler Experte im Beifahrersitz
- Ende mit einer Wendung oder einem Gedanken der nachhallt
- Nur fließender Text auf Deutsch, keine Aufzählungen`;
    }

    setStoryLoading(true);
    setActiveStory({ name: isIntro ? `${introData?.start} → ${introData?.end}` : locationName, isIntro });
    setStoryText("");
    addLog(`📖 ${isIntro ? "Einleitung" : locationName}`, "story");

    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName: locationName, category: cat, speedKmh: kmh, customPrompt: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setStoryText(data.text);
        setStoryLoading(false);

        // Use ElevenLabs audio if available, otherwise browser TTS
        if (data.audio) {
          playBase64Audio(data.audio, data.text);
        } else {
          speakStory(data.text);
        }

        if (!isIntro) {
          storyCountRef.current += 1;
          setStoryCount(c => c + 1);
          const summary = data.text.replace(/\n/g, " ").slice(0, 120) + "...";
          storyMemory.current = [...storyMemory.current.slice(-4), { place: locationName, summary }];
        }
        isGeneratingRef.current = false;
        return;
      }
    } catch {}

    // Fallback
    const fallback = isIntro
      ? `${getTimeOfDay()}! Du startest jetzt deine Fahrt von ${introData?.start} nach ${introData?.end}. Unterwegs warten ${introData?.places?.slice(0,2).join(" und ")} auf dich. Lehn dich zurück — es geht los.`
      : `Du befindest dich gerade in ${locationName} — einem Ort mit einer langen Geschichte am Niederrhein.`;
    setStoryText(fallback);
    setStoryLoading(false);
    speakStory(fallback);
    isGeneratingRef.current = false;
  }, [addLog]);

  // ─── Play ElevenLabs audio ───────────────────────────────────────────────
  const audioRef = useRef(null);

  const playBase64Audio = useCallback((base64, text) => {
    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    clearInterval(progRef.current);
    setSpeaking(true);
    isSpeakingRef.current = true;
    setSpProgress(0);

    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      const estDur = text.length / 11.5;
      const t0 = Date.now();
      progRef.current = setInterval(() => {
        setSpProgress(Math.min((Date.now()-t0)/1000/estDur*100, 100));
      }, 300);

      audio.onended = () => {
        setSpeaking(false);
        isSpeakingRef.current = false;
        clearInterval(progRef.current);
        setSpProgress(100);
        URL.revokeObjectURL(url);
        // Generate next story after 1.5s
        if (simDistRef.current > 0 && simDistRef.current < totalDistRef.current && !arrivedRef.current) {
          setTimeout(async () => {
            if (isSpeakingRef.current || isGeneratingRef.current) return;
            const wps = routeWPsRef.current;
            if (!wps.length) return;
            const idx = Math.min(Math.floor(simDistRef.current / totalDistRef.current * wps.length), wps.length-1);
            const name = await geocodePosition(wps[idx].lat, wps[idx].lon);
            generateStory(name);
          }, 1500);
        }
      };

      audio.onerror = () => {
        setSpeaking(false);
        isSpeakingRef.current = false;
        clearInterval(progRef.current);
        // Fallback to browser TTS
        speakStory(text);
      };

      audio.play().catch(() => {
        setSpeaking(false);
        isSpeakingRef.current = false;
        speakStory(text);
      });
    } catch(e) {
      speakStory(text);
    }
  }, [geocodePosition, generateStory, speakStory]);

  // ─── Speak story ─────────────────────────────────────────────────────────
  const speakStory = useCallback((text) => {
    window.speechSynthesis?.cancel();
    clearInterval(progRef.current);
    setSpeaking(true);
    isSpeakingRef.current = true;
    setSpProgress(0);

    const utter = new SpeechSynthesisUtterance(text);
    const v = voicesRef.current[voiceIdxRef.current];
    if (v) utter.voice = v;
    utter.lang = "de-DE";
    utter.rate = 0.88;

    const estDur = text.length / 11.5;
    const t0 = Date.now();
    progRef.current = setInterval(() => {
      setSpProgress(Math.min((Date.now()-t0)/1000/estDur*100, 100));
    }, 300);

    utter.onend = () => {
      setSpeaking(false);
      isSpeakingRef.current = false;
      clearInterval(progRef.current);
      setSpProgress(100);

      // After story ends — wait a moment then generate next if still driving
      if (simDistRef.current > 0 && simDistRef.current < totalDistRef.current && !arrivedRef.current) {
        setTimeout(async () => {
          if (isSpeakingRef.current || isGeneratingRef.current) return;
          // Geocode current position and generate next story
          const wps = routeWPsRef.current;
          if (!wps.length) return;
          const idx = Math.min(Math.floor(simDistRef.current / totalDistRef.current * wps.length), wps.length-1);
          const pos = wps[idx];
          const name = await geocodePosition(pos.lat, pos.lon);
          generateStory(name);
        }, 1500);
      }
    };
    utter.onerror = () => {
      setSpeaking(false);
      isSpeakingRef.current = false;
      clearInterval(progRef.current);
    };

    window.speechSynthesis?.speak(utter);
  }, [geocodePosition, generateStory]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    isSpeakingRef.current = false;
    clearInterval(progRef.current);
    isGeneratingRef.current = false;
  }, []);

  // ─── Search places ────────────────────────────────────────────────────────
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

  // ─── Fetch route ──────────────────────────────────────────────────────────
  const fetchRoute = useCallback(async (start, end) => {
    setRouteLoading(true);
    setRouteError("");
    setArrived(false);
    arrivedRef.current = false;
    stopSpeech();
    setSimDist(0);
    simDistRef.current = 0;
    setCurrentDist(0);
    setStoryCount(0);
    storyCountRef.current = 0;
    setLog([]);
    setActiveStory(null);
    setStoryText("");
    isGeneratingRef.current = false;

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
      const r = await fetch(url);
      const data = await r.json();
      if (!data.routes?.length) throw new Error("Keine Route gefunden");

      const coords = data.routes[0].geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
      setRouteWPs(coords);
      routeWPsRef.current = coords;

      const dist = totalRouteDist(coords);
      setTotalDist(dist);
      totalDistRef.current = dist;

      // Sample place names along route for intro
      const places = [];
      const step = dist / 4;
      for (let i = 1; i <= 3; i++) {
        const targetDist = step * i;
        let acc = 0;
        for (let j = 0; j < coords.length-1; j++) {
          const seg = haversine(coords[j].lat, coords[j].lon, coords[j+1].lat, coords[j+1].lon);
          if (acc + seg >= targetDist) {
            try {
              const gr = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${coords[j].lat}&lon=${coords[j].lon}&format=json&accept-language=de`,
                { headers: { "User-Agent": "Weggefluesterer/1.0" } }
              );
              const gd = await gr.json();
              const addr = gd.address;
              const name = addr.city || addr.town || addr.village || addr.hamlet || "";
              if (name && !places.includes(name)) places.push(name);
            } catch {}
            break;
          }
          acc += seg;
        }
      }

      addLog(`✅ Route: ${(dist/1000).toFixed(1)} km`, "start");
      setRouteLoading(false);
      return places;
    } catch (e) {
      setRouteError("Route nicht gefunden: " + e.message);
      setRouteLoading(false);
      return [];
    }
  }, [stopSpeech, addLog]);

  // ─── Start simulation ─────────────────────────────────────────────────────
  const startSim = useCallback(async () => {
    if (!startPlace || !endPlace) return;
    stopSpeech();
    setSimDist(0);
    simDistRef.current = 0;
    setCurrentDist(0);
    setArrived(false);
    arrivedRef.current = false;
    setStoryCount(0);
    storyCountRef.current = 0;
    setLog([]);
    setActiveStory(null);
    setStoryText("");
    isGeneratingRef.current = false;
    storyMemory.current = [];

    const places = await fetchRoute(startPlace, endPlace);
    setSimRunning(true);
    addLog("🚗 Fahrt gestartet", "start");

    // Generate intro immediately
    setTimeout(() => {
      generateStory(startPlace.name, true, {
        start: startPlace.name,
        end: endPlace.name,
        places: places.length > 0 ? places : [startPlace.name, endPlace.name],
      });
    }, 500);
  }, [startPlace, endPlace, fetchRoute, stopSpeech, addLog, generateStory]);

  // ─── Simulation tick ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!simRunning || !routeWPs.length) return;

    simRef.current = setInterval(async () => {
      simDistRef.current = Math.min(simDistRef.current + simSpeed * 0.4, totalDist);
      const d = simDistRef.current;
      setSimDist(d);
      setCurrentDist(d);
      setSpeedKmh(Math.round(simSpeed * 3.6));
      speedRef.current = Math.round(simSpeed * 3.6);

      // Reverse geocode periodically
      if (d - lastGeoRef.current > 500) {
        lastGeoRef.current = d;
        const idx = Math.min(Math.floor(d / totalDist * routeWPs.length), routeWPs.length-1);
        const pos = routeWPs[idx];
        geocodePosition(pos.lat, pos.lon);
      }

      // Check arrival
      if (d >= totalDist && !arrivedRef.current) {
        arrivedRef.current = true;
        setArrived(true);
        clearInterval(simRef.current);
        setSimRunning(false);
        addLog("🏁 Ziel erreicht!", "arrival");
        if (!isSpeakingRef.current && !isGeneratingRef.current) {
          generateStory(endPlace?.name || "Ziel", false);
        }
      }
    }, 400);

    return () => clearInterval(simRef.current);
  }, [simRunning, simSpeed, totalDist, routeWPs, geocodePosition, generateStory, endPlace, addLog]);

  // ─── Real GPS ─────────────────────────────────────────────────────────────
  const startRealGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError("GPS nicht verfügbar"); return; }
    addLog("📡 GPS aktiv", "start");
    gpsRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setGpsPos({ lat, lon });
        setGpsError("");

        // Geocode and generate story if not speaking
        if (!isSpeakingRef.current && !isGeneratingRef.current) {
          const name = await geocodePosition(lat, lon);
          if (name !== currentLocRef.current) generateStory(name);
        }
      },
      (err) => setGpsError("GPS Fehler: " + err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  }, [addLog, geocodePosition, generateStory]);

  const stopRealGPS = useCallback(() => {
    if (gpsRef.current) navigator.geolocation.clearWatch(gpsRef.current);
  }, []);

  // ─── Map ──────────────────────────────────────────────────────────────────
  const W = 340, H = 140, P = 12;
  const mapData = routeWPs.length > 0 ? (() => {
    const lats = routeWPs.map(w => w.lat), lons = routeWPs.map(w => w.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const px = lon => P + (lon-minLon)/Math.max(maxLon-minLon,0.001)*(W-P*2);
    const py = lat => H-P - (lat-minLat)/Math.max(maxLat-minLat,0.001)*(H-P*2);
    const idx = Math.min(Math.floor(currentDist/Math.max(totalDist,1)*routeWPs.length), routeWPs.length-1);
    return { px, py, carX: px(routeWPs[idx].lon), carY: py(routeWPs[idx].lat) };
  })() : null;

  const pct = totalDist > 0 ? Math.min(currentDist/totalDist*100,100) : 0;

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
        <div style={{ textAlign:"center", padding:"24px 0 12px" }}>
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
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {["sim","real"].map(m => (
            <button key={m} onClick={() => { setGpsMode(m); if(m==="real") startRealGPS(); else stopRealGPS(); }}
              style={{ flex:1, padding:"9px", borderRadius:10, border:`1px solid ${gpsMode===m?"#c8860a":"rgba(200,134,10,.2)"}`, background:gpsMode===m?"rgba(200,134,10,.12)":"transparent", color:gpsMode===m?"#c8860a":"#6a5830", fontFamily:"sans-serif", fontSize:".8rem", cursor:"pointer", transition:"all .2s" }}>
              {m==="sim" ? "🚗 Simulation" : "📡 Echtes GPS"}
            </button>
          ))}
        </div>

        {gpsError && <div style={{ marginBottom:10, padding:"8px 12px", background:"rgba(180,50,30,.1)", border:"1px solid rgba(180,50,30,.25)", borderRadius:8, fontSize:".78rem", color:"#c88070" }}>⚠️ {gpsError}</div>}

        {/* Route input */}
        <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(200,134,10,.2)", borderRadius:16, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:".66rem", color:"#5a4820", textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Route</div>

          {/* Start */}
          <div style={{ position:"relative", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#5ab05a", flexShrink:0 }}/>
              <span style={{ fontSize:".72rem", color:"#6a5830" }}>Start</span>
            </div>
            <input value={startInput} onChange={e=>onStartInput(e.target.value)}
              placeholder="z.B. Walbeck, Geldern…"
              style={{ width:"100%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(200,134,10,.25)", borderRadius:9, padding:"9px 12px", color:"#f0ede5", fontFamily:"sans-serif", fontSize:".85rem", outline:"none" }}/>
            {startSugg.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#1a1208", border:"1px solid rgba(200,134,10,.2)", borderRadius:9, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,.6)" }}>
                {startSugg.map((s,i) => { const p=s.display_name.split(", "); return (
                  <div key={i} onClick={()=>{ setStartPlace({name:p[0],lat:parseFloat(s.lat),lon:parseFloat(s.lon)}); setStartInput(p[0]); setStartSugg([]); }}
                    style={{ padding:"9px 12px", cursor:"pointer", borderBottom:"1px solid rgba(200,134,10,.08)" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(200,134,10,.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{ fontSize:".85rem" }}>{p[0]}</div>
                    <div style={{ fontSize:".7rem", color:"#5a4820", marginTop:2 }}>{p.slice(1,3).join(", ")}</div>
                  </div>
                ); })}
              </div>
            )}
          </div>

          {/* End */}
          <div style={{ position:"relative", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#c84030", flexShrink:0 }}/>
              <span style={{ fontSize:".72rem", color:"#6a5830" }}>Ziel</span>
            </div>
            <input value={endInput} onChange={e=>onEndInput(e.target.value)}
              placeholder="z.B. Kevelaer, Geldern…"
              style={{ width:"100%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(200,134,10,.25)", borderRadius:9, padding:"9px 12px", color:"#f0ede5", fontFamily:"sans-serif", fontSize:".85rem", outline:"none" }}/>
            {endSugg.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#1a1208", border:"1px solid rgba(200,134,10,.2)", borderRadius:9, overflow:"hidden", zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,.6)" }}>
                {endSugg.map((s,i) => { const p=s.display_name.split(", "); return (
                  <div key={i} onClick={()=>{ setEndPlace({name:p[0],lat:parseFloat(s.lat),lon:parseFloat(s.lon)}); setEndInput(p[0]); setEndSugg([]); }}
                    style={{ padding:"9px 12px", cursor:"pointer", borderBottom:"1px solid rgba(200,134,10,.08)" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(200,134,10,.1)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{ fontSize:".85rem" }}>{p[0]}</div>
                    <div style={{ fontSize:".7rem", color:"#5a4820", marginTop:2 }}>{p.slice(1,3).join(", ")}</div>
                  </div>
                ); })}
              </div>
            )}
          </div>

          {/* Category */}
          <div style={{ fontSize:".66rem", color:"#5a4820", textTransform:"uppercase", letterSpacing:".08em", marginBottom:7 }}>Thema</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={()=>setCategory(c)} style={{ padding:"5px 11px", borderRadius:16, border:`1px solid ${category===c?"#c8860a":"#3a2f1a"}`, background:category===c?"rgba(200,134,10,.12)":"transparent", color:category===c?"#c8860a":"#6a5830", fontFamily:"sans-serif", fontSize:".73rem", cursor:"pointer" }}>
                {c}
              </button>
            ))}
          </div>

          {routeError && <div style={{ fontSize:".75rem", color:"#c88070", marginBottom:8 }}>⚠️ {routeError}</div>}
        </div>

        {/* Map */}
        {routeWPs.length > 0 && mapData && (
          <div style={{ background:"rgba(0,0,0,.45)", border:"1px solid rgba(200,134,10,.12)", borderRadius:12, overflow:"hidden", marginBottom:11, position:"relative" }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
              {routeWPs.slice(0,-1).map((wp,i) => (
                <line key={i} x1={mapData.px(wp.lon)} y1={mapData.py(wp.lat)} x2={mapData.px(routeWPs[i+1].lon)} y2={mapData.py(routeWPs[i+1].lat)} stroke="rgba(200,134,10,.2)" strokeWidth="2" strokeLinecap="round"/>
              ))}
              <circle cx={mapData.px(routeWPs[0].lon)} cy={mapData.py(routeWPs[0].lat)} r={5} fill="#5ab05a" stroke="#7ad07a" strokeWidth="1.5"/>
              <circle cx={mapData.px(routeWPs[routeWPs.length-1].lon)} cy={mapData.py(routeWPs[routeWPs.length-1].lat)} r={5} fill="#c84030" stroke="#e86050" strokeWidth="1.5"/>
              {currentDist > 0 && (
                <g style={{ animation:(simRunning||gpsMode==="real")?"carAnim .5s ease-in-out infinite":"none" }}>
                  <circle cx={mapData.carX} cy={mapData.carY} r={8} fill="rgba(200,134,10,.2)" stroke="#c8860a" strokeWidth="1.5"/>
                  <text x={mapData.carX} y={mapData.carY+5.5} textAnchor="middle" fontSize="10" style={{userSelect:"none"}}>
                    {speedKmh < 8 ? "🚶" : speedKmh < 25 ? "🚴" : "🚗"}
                  </text>
                </g>
              )}
            </svg>
            {currentLocationName && (
              <div style={{ position:"absolute", bottom:6, left:8, fontSize:".65rem", color:"#6a5830" }}>
                📍 {currentLocationName}
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {totalDist > 0 && (
          <div style={{ marginBottom:11 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:".7rem", color:"#5a4820" }}>{startPlace?.name}</span>
              <span style={{ fontSize:".72rem", color:"#c8860a", fontWeight:600 }}>{pct.toFixed(1)}%</span>
              <span style={{ fontSize:".7rem", color:"#5a4820" }}>{endPlace?.name}</span>
            </div>
            <div style={{ height:4, background:"rgba(200,134,10,.1)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:pct+"%", background:"linear-gradient(90deg,#c8860a,#e8a820)", borderRadius:2, transition:"width .4s linear" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{(currentDist/1000).toFixed(2)} km</span>
              <span style={{ fontSize:".67rem", color:"#c8860a" }}>{speedKmh} km/h · {storyCount} Stories</span>
              <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{((totalDist-currentDist)/1000).toFixed(2)} km</span>
            </div>
          </div>
        )}

        {/* Speed + Voice */}
        {routeWPs.length > 0 && gpsMode === "sim" && (
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
            {!simRunning && !arrived ? (
              <button onClick={startSim} disabled={!startPlace||!endPlace||routeLoading}
                style={{ flex:1, padding:15, background:startPlace&&endPlace?"linear-gradient(135deg,#c8860a,#9a6408)":"rgba(200,134,10,.2)", border:"none", borderRadius:13, color:startPlace&&endPlace?"#120e06":"#5a4820", fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:700, cursor:startPlace&&endPlace?"pointer":"default", boxShadow:startPlace&&endPlace?"0 4px 22px rgba(200,134,10,.3)":"none" }}>
                {routeLoading ? "Route wird berechnet…" : !startPlace||!endPlace ? "← Start & Ziel eingeben" : "🚗 Fahrt starten"}
              </button>
            ) : (
              <>
                <button onClick={()=>setSimRunning(r=>!r)}
                  style={{ flex:1, padding:13, background:simRunning?"rgba(200,134,10,.12)":"linear-gradient(135deg,#c8860a,#9a6408)", border:`1px solid ${simRunning?"rgba(200,134,10,.3)":"transparent"}`, borderRadius:12, color:simRunning?"#c8860a":"#120e06", fontFamily:"sans-serif", fontSize:".88rem", fontWeight:600, cursor:"pointer" }}>
                  {simRunning?"⏸ Pause":"▶ Weiter"}
                </button>
                <button onClick={startSim}
                  style={{ padding:"13px 16px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:12, color:"#5a4820", fontFamily:"sans-serif", fontSize:".88rem", cursor:"pointer" }}>
                  ↺ Neu
                </button>
              </>
            )}
          </div>
        )}

        {gpsMode === "real" && (
          <div style={{ padding:"12px 16px", background:"rgba(200,134,10,.06)", border:"1px solid rgba(200,134,10,.2)", borderRadius:12, marginBottom:14, fontSize:".82rem", color:"#8a7840" }}>
            📡 GPS aktiv — fahre einfach los. Stories starten automatisch und passen sich deiner Geschwindigkeit an.
            {gpsPos && <div style={{ marginTop:4, fontSize:".72rem", color:"#5a4820" }}>📍 {gpsPos.lat.toFixed(4)}°N, {gpsPos.lon.toFixed(4)}°E</div>}
          </div>
        )}

        {/* Story panel */}
        {(activeStory || storyLoading) && (
          <div style={{ background:"rgba(200,134,10,.07)", border:"1px solid rgba(200,134,10,.28)", borderRadius:18, overflow:"hidden", marginBottom:13, animation:"slideIn .35s ease" }}>
            <div style={{ padding:"15px 17px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:".66rem", color:"#6a5228", textTransform:"uppercase", letterSpacing:".12em", marginBottom:3 }}>
                  {activeStory?.isIntro ? "🎙️ Einleitung" : `📍 Story ${storyCount}`}
                </div>
                <div style={{ fontStyle:"italic", fontSize:"1.1rem", color:"#c8860a", lineHeight:1.25 }}>{activeStory?.name}</div>
                {!activeStory?.isIntro && speedKmh > 0 && (
                  <div style={{ fontSize:".68rem", color:"#5a4820", marginTop:4 }}>
                    {getStoryLength(speedKmh).label} · {category}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:2.5, paddingTop:5 }}>
                {[8,13,18,22,17,12,9,16,20,13].map((h,i)=>(
                  <div key={i} style={{ width:2.5, borderRadius:2, background:"#c8860a", height:speaking?undefined:h+"px", opacity:speaking?.85:.2, animation:speaking?`wb ${.28+(i%4)*.13}s ${i*.05}s ease-in-out infinite alternate`:"none", minHeight:speaking?"3px":undefined, maxHeight:speaking?"22px":undefined }}/>
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
                <button onClick={()=>speaking?stopSpeech():speakStory(storyText)}
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

        {/* Empty state */}
        {!activeStory && !storyLoading && routeWPs.length === 0 && (
          <div style={{ textAlign:"center", padding:"28px 20px", color:"#4a3a1a", fontSize:".87rem", lineHeight:1.7 }}>
            <div style={{ fontSize:"2.4rem", marginBottom:11 }}>🗺️</div>
            Start und Ziel eingeben<br/>Thema wählen → Fahrt starten<br/>
            <span style={{ fontSize:".75rem", color:"#3a2a10" }}>Die App erzählt durchgehend — angepasst an deinen Ort und deine Geschwindigkeit</span>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background:"rgba(0,0,0,.35)", border:"1px solid rgba(255,255,255,.04)", borderRadius:10, padding:"9px 12px", maxHeight:100, overflowY:"auto" }}>
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
