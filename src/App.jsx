import { useState, useEffect, useRef, useCallback } from "react";

// ─── Route: Grenzweg 9, Walbeck → Südwall 21, Geldern (~5.2 km) ──────────────
const ROUTE = [
  { id:  0, lat: 51.5498, lon: 6.3055, name: "Grenzweg 9, Walbeck",           dist:    0 },
  { id:  1, lat: 51.5481, lon: 6.3068, name: "Walbecker Straße Nord",         dist:  220 },
  { id:  2, lat: 51.5462, lon: 6.3089, name: "Steprather Mühle",              dist:  460 },
  { id:  3, lat: 51.5444, lon: 6.3102, name: "Dorfkern Walbeck",              dist:  680 },
  { id:  4, lat: 51.5428, lon: 6.3115, name: "St.-Nikolaus-Kirche Walbeck",   dist:  880 },
  { id:  5, lat: 51.5410, lon: 6.3128, name: "Schloss Walbeck",               dist: 1090 },
  { id:  6, lat: 51.5388, lon: 6.3142, name: "Fossa Eugeniana",               dist: 1380 },
  { id:  7, lat: 51.5362, lon: 6.3158, name: "Spargelfelder Walbeck",         dist: 1680 },
  { id:  8, lat: 51.5335, lon: 6.3172, name: "Walbecker Str. / L361",         dist: 1990 },
  { id:  9, lat: 51.5305, lon: 6.3188, name: "Niersauen",                     dist: 2360 },
  { id: 10, lat: 51.5275, lon: 6.3204, name: "Schloss Haag",                  dist: 2720 },
  { id: 11, lat: 51.5248, lon: 6.3221, name: "Einfahrt Geldern",              dist: 3060 },
  { id: 12, lat: 51.5220, lon: 6.3248, name: "Bahnhof Geldern",               dist: 3420 },
  { id: 13, lat: 51.5195, lon: 6.3278, name: "Nordwall",                      dist: 3750 },
  { id: 14, lat: 51.5175, lon: 6.3308, name: "Marktplatz Geldern",            dist: 4080 },
  { id: 15, lat: 51.5158, lon: 6.3338, name: "St. Maria Magdalena",           dist: 4380 },
  { id: 16, lat: 51.5142, lon: 6.3365, name: "Mühlenturm",                   dist: 4660 },
  { id: 17, lat: 51.5128, lon: 6.3388, name: "Südwall 21, Geldern",           dist: 4920 },
];

const TOTAL = 4920;

// ─── Stories ──────────────────────────────────────────────────────────────────
// trigger: "start" | "ahead" | "passing" | "arrival"
// aheadM: how many meters before the waypoint to trigger
const STORIES = {
  0: {
    trigger: "start", waypointId: 0, aheadM: 0,
    label: "Abfahrt Walbeck",
    badge: "📍 Start",
    preview: "5 km, 800 Jahre Geschichte, ein Drache wartet am Ziel…",
    text: `Du stehst im Grenzweg in Walbeck — einem Feldweg, der seinen Namen ernst nimmt. Walbeck liegt buchstäblich am Rand: nah an der niederländischen Grenze, am Rand des Kreises Kleve, am Rand der Geschichte.\n\nDas Dorf wurde 1250 erstmals urkundlich erwähnt — aber bewohnt war diese feuchte Niederrheinlandschaft schon viel länger. Der Name selbst verrät es: "Wal" bedeutet Sumpf, "beck" bedeutet Bach. Sumpfbach. Kein einladender Name für ein Dorf. Und doch blieben die Menschen.\n\nIn den nächsten fünf Kilometern wirst du durch ein Stück Niederrhein fahren, das aussieht wie Idylle — aber unter der Oberfläche Jahrhunderte von Krieg, Spargelanbau, spanischen Kanalplänen und einem Drachen trägt. Lehn dich zurück. Wir fangen an.`,
  },
  2: {
    trigger: "ahead", waypointId: 2, aheadM: 250,
    label: "Steprather Mühle",
    badge: "⚙️ Vorausschau · 250m",
    preview: "Gleich links: Älteste funktionierende Windmühle Deutschlands",
    text: `Gleich links siehst du sie — die Steprather Mühle. Auf dem höchsten Punkt Walbecks, genau 40 Meter über dem Meeresspiegel — was am Niederrhein tatsächlich eine Höhe ist.\n\nDiese Mühle ist kein Museum. Sie ist die älteste vollständig funktionierende Windmühle Deutschlands. Gebaut um 1500, hat sie Reformation, Dreißigjährigen Krieg, Napoleons Truppen und zwei Weltkriege überlebt. An einem ihrer Balken steht eingraviert: "In Wind und Wetter ist Gott Dein Retter."\n\n1647 kam sie zum benachbarten Schloss Steprath. Über 400 Jahre mahlte sie Getreide. Erst 1952 standen die Flügel still — aus wirtschaftlichen Gründen, nicht weil die Technik versagte. Seit 1995 dreht sie sich wieder. Wenn der Wind stimmt, riecht man das frisch gemahlene Mehl bis auf die Straße.`,
  },
  4: {
    trigger: "passing", waypointId: 4, aheadM: 0,
    label: "St.-Nikolaus-Kirche",
    badge: "⛪ Jetzt rechts",
    preview: "Der Turm von 1432 — und eine Kapelle aus dem 16. Jahrhundert",
    text: `Rechts siehst du den Turm der St.-Nikolaus-Kirche. Die Inschrift am Turm nennt das Jahr 1432 — aber die Kirche selbst ist noch älter. In ihrer heutigen Größe besteht sie seit 1329.\n\nDirekt daneben steht die winzige Lucia-Kapelle, ein Backsteinbau aus dem frühen 16. Jahrhundert — so klein, dass man sie fast übersieht. Und dahinter: das alte Pastorat, 1625 als Pilgerhaus errichtet. Pilger, die auf dem Weg nach Kevelaer waren — dem großen Marienwallfahrtsort, nur wenige Kilometer entfernt — machten hier Rast.\n\nWalbeck war eine Durchgangsstation für Tausende Gläubige, die aus dem ganzen Rheinland kamen. Das Dorf lebte davon: Herbergen, Brot, Wasser. Eine mittelalterliche Servicewirtschaft an der Pilgerstraße.`,
  },
  5: {
    trigger: "ahead", waypointId: 5, aheadM: 180,
    label: "Schloss Walbeck",
    badge: "🏰 Vorausschau · 180m",
    preview: "Ein Backsteinbau mit 2 Meter dicken Mauern — seit 1403",
    text: `In etwa 200 Metern passierst du Schloss Walbeck — vom Weg aus gut zu sehen, Privatbesitz, also nur von außen.\n\nDer Backsteinbau stammt aus dem 14. Jahrhundert. Die Mauern sind bis zu zwei Meter dick. Das ist keine Übertreibung — das war schlicht notwendig in einer Gegend, die jahrhundertelang umkämpft war. 1514 brannte Walbeck nieder, als Herzog Carl von Geldern und Kaiser Maximilian sich die Region streitig machten. Das Schloss überstand es.\n\nÜber dem Tor zur Vorburg hängt ein Wappenstein von 1698 — aus der Zeit, als Walbeck längst preußisch geworden war. Ein Stein, der eine ganze Machtgeschichte erzählt: wer hier regierte, wer verlor, wer überlebte.\n\nHeute ist das Schloss in Privathand, gut restauriert, weithin sichtbar. Die dicksten Mauern am Niederrhein. Und niemand fragt warum.`,
  },
  6: {
    trigger: "passing", waypointId: 6, aheadM: 0,
    label: "Fossa Eugeniana",
    badge: "🌊 Bodendenkmal",
    preview: "Ein spanischer Kanal, der nie fertig wurde",
    text: `Was du hier siehst, ist nichts — und genau das ist das Besondere. Die leichte Senke rechts, kaum erkennbar im Gelände, ist alles was übrig blieb von einem der größten Bauprojekte des 17. Jahrhunderts.\n\n1626 begannen die Spanier mit der Fossa Eugeniana — einem schiffbaren Kanal, der Maas und Rhein verbinden sollte. Benannt nach der spanischen Infantin Isabella Clara Eugenia, lief er von Venlo, vorbei an Walbeck, über Geldern bis nach Rheinberg. Der Plan war genial: damit hätte Spanien den holländischen Schiffen den Rhein komplett umgehen können.\n\nDrei Jahre wurde gegraben. Dann, 1629, stoppten die Arbeiten — Geld weg, Krieg eskaliert, politische Lage verändert. Der Kanal blieb unvollendet. Was geblieben ist, steht heute unter Naturschutz und gilt als Bodendenkmal. Manchmal scheitert Größenwahn einfach an der Realität.`,
  },
  7: {
    trigger: "passing", waypointId: 7, aheadM: 0,
    label: "Spargelfelder Walbeck",
    badge: "🌱 Niederrhein-Idylle",
    preview: "Die weißen Stangen, die Walbeck berühmt machten",
    text: `Links und rechts der Straße — das sind Spargelfelder. Im Mai und Juni ragen hier die charakteristischen Erdwälle aus dem Boden, und Walbeck riecht nach frisch gestochenem Spargel.\n\nWalbeck ist das Spargeldorf des Niederrheins. Vor über 60 Jahren begann der Anbau — der lockere, sandige Heideboden erwies sich als ideal. Heute kommen Menschen aus dem ganzen Ruhrgebiet hierher, nur für den Spargel. Die Gastronomie richtet ihre gesamte Karte danach aus.\n\nWas weniger bekannt ist: Walbeck beheimatet die einzige Spargelbaugenossenschaft Deutschlands — wahrscheinlich sogar Europas. Ihr Wahrzeichen steht seit 1929. Bauern, die konkurrieren müssen, kooperieren trotzdem. Eine Niederrheinische Lebensweisheit, die älter ist als jeder Betriebswirtschaftskurs.`,
  },
  10: {
    trigger: "ahead", waypointId: 10, aheadM: 300,
    label: "Schloss Haag",
    badge: "🏯 Vorausschau · 300m",
    preview: "Friedrich der Große, Napoleon und der Zar — alle waren hier",
    text: `In etwa 300 Metern liegt links Schloss Haag — eines der bedeutendsten Wasserschlösser am Niederrhein. Erstmals urkundlich erwähnt 1331, noch immer in der 12. Generation im Besitz der gräflichen Familie von und zu Hoensbroech.\n\nDie Gästeliste dieses Hauses ist beeindruckend: Friedrich der Große schlief hier. Napoleon übernachtete hier. Zar Nikolaus I. von Russland war zu Besuch. Kaiser Wilhelm I. kannte den Weg.\n\nIm Zweiten Weltkrieg wurde das Hauptgebäude zerstört — nur die historische Vorburg überstand die Bombardierungen. Was heute noch steht, ist also nicht das Schloss, das Napoleon kannte. Aber es ist das Schloss, das den Krieg überlebt hat. Heute liegt drumherum ein Golfplatz. Geschichte und Freizeitwirtschaft, Seite an Seite, friedlich.`,
  },
  13: {
    trigger: "passing", waypointId: 13, aheadM: 0,
    label: "Nordwall Geldern",
    badge: "🏰 Festungsstadt",
    preview: "Das Skelett einer verschwundenen Festung",
    text: `Du bist jetzt in Geldern — und der Nordwall, an dem du entlangfährst, war einst eine Stadtmauer. Nicht im übertragenen Sinne. Hier verlief tatsächlich die Befestigung einer der am härtesten umkämpften Festungsstädte Europas.\n\nGeldern wechselte den Besitzer wie andere Städte die Bürgermeister: Burgund, Österreich, Spanien, Niederlande, wieder Spanien, Frankreich, Preußen. Jede Macht baute die Festung weiter, verstärkte die Wälle, grub tiefere Gräben.\n\nFriedrich der Große, der gerade Schloss Haag besucht hatte, kam 1740 auch nach Geldern — und ordnete 1764 den vollständigen Abriss der Befestigungsanlagen an. Geblieben sind nur die Straßennamen: Nordwall, Südwall, Ostwall, Westwall. Du fährst gerade durch das Skelett einer verschwundenen Festung.`,
  },
  14: {
    trigger: "ahead", waypointId: 14, aheadM: 120,
    label: "Marktplatz — Drachenbrunnen",
    badge: "🐉 Vorausschau · 120m",
    preview: "878 n. Chr.: Ein Drache gibt einer Stadt ihren Namen",
    text: `Gleich erreichst du den Gelderner Marktplatz — und in der Mitte steht ein Brunnen, der die absurdeste Stadtgründungslegende des Niederrheins in Bronze gegossen hat.\n\n878 nach Christus kämpften zwei Adlige namens Wichard und Lupold gegen einen feuerspeienden Drachen. Sie fanden ihn unter einem Mispelbaum — und einer der Ritter tötete ihn mit einem Speerwurf. Der sterbende Drache röchelte: "Gelre! Gelre!" — und gab der Stadt damit ihren Namen.\n\nOb das stimmt? Natürlich nicht. Aber der Brunnen steht dort, die Stadt führt den Drachen im Wappen, und kein Gelderner zweifelt an der Geschichte. Du bist jetzt über 50 Kilometer von Walbeck hierher gefahren — durch Spargelfelder, an Schlössern und Kanalgräben vorbei — um bei einem Drachen anzukommen. Irgendwie macht das Sinn.`,
  },
  17: {
    trigger: "arrival", waypointId: 17, aheadM: 0,
    label: "Angekommen — Südwall 21",
    badge: "🏁 Ziel erreicht",
    preview: "Fast 5 km, 800 Jahre Geschichte",
    text: `Südwall 21. Du bist angekommen.\n\nIn knapp fünf Kilometern bist du von einem Feldweg am Rand des Niederrheins durch 800 Jahre Geschichte gefahren. Walbeck, das Sumpfdorf, das Pilgern Rast gab. Die älteste Windmühle Deutschlands, die noch immer mahlt. Der spanische Kanal, der nie fertig wurde. Die Spargelfelder, für die Menschen aus dem Ruhrgebiet anreisen. Ein Schloss, das Napoleon, den Zaren und Friedrich den Großen beherbergte. Eine Festungsstadt, von der nur Straßennamen übrig sind. Und ein Drachen, der sterbend eine Stadt taufte.\n\nDas ist der Niederrhein: unspektakulär auf den ersten Blick. Vollgepackt mit Geschichte, wenn man weiß, wohin man schauen soll.\n\nGute Fahrt. Und beim nächsten Mal: Augen auf.`,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function getPosAtDist(d) {
  const clamped = Math.min(Math.max(d, 0), TOTAL);
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const a = ROUTE[i], b = ROUTE[i + 1];
    if (clamped <= b.dist) {
      const t = (clamped - a.dist) / (b.dist - a.dist);
      return { lat: lerp(a.lat, b.lat, t), lon: lerp(a.lon, b.lon, t) };
    }
  }
  const last = ROUTE[ROUTE.length - 1];
  return { lat: last.lat, lon: last.lon };
}

function nearestWpName(d) {
  return ROUTE.reduce((best, wp) =>
    Math.abs(wp.dist - d) < Math.abs(best.dist - d) ? wp : best
  ).name;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [running, setRunning]           = useState(false);
  const [dist, setDist]                 = useState(0);
  const [speed, setSpeed]               = useState(10);    // m/s
  const [triggered, setTriggered]       = useState(new Set());
  const [activeStory, setActiveStory]   = useState(null);
  const [queue, setQueue]               = useState([]);
  const [speaking, setSpeaking]         = useState(false);
  const [spProgress, setSpProgress]     = useState(0);
  const [spElapsed, setSpElapsed]       = useState(0);
  const [voices, setVoices]             = useState([]);
  const [voiceIdx, setVoiceIdx]         = useState(0);
  const [log, setLog]                   = useState([]);
  const [done, setDone]                 = useState(false);

  const distRef      = useRef(0);
  const triggeredRef = useRef(new Set());
  const simRef       = useRef(null);
  const progRef      = useRef(null);
  const storyRef     = useRef(null);
  const queueRef     = useRef([]);

  // voices
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
    setLog(prev => [{ msg, type, t }, ...prev].slice(0, 30));
  }, []);

  // speak
  const speak = useCallback((story) => {
    window.speechSynthesis?.cancel();
    clearInterval(progRef.current);
    setActiveStory(story);
    setSpeaking(true);
    setSpProgress(0);
    setSpElapsed(0);

    const utter = new SpeechSynthesisUtterance(story.text);
    const sortedVoices = voices;
    if (sortedVoices[voiceIdx]) utter.voice = sortedVoices[voiceIdx];
    utter.lang = "de-DE";
    utter.rate = 0.87;
    utter.pitch = 1.0;

    const estDur = story.text.length / 11.5;
    const t0 = Date.now();
    progRef.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setSpProgress(Math.min(s / estDur * 100, 100));
      setSpElapsed(s);
    }, 250);

    utter.onend = () => {
      setSpeaking(false);
      clearInterval(progRef.current);
      setSpProgress(100);
      const next = queueRef.current[0];
      if (next) {
        queueRef.current = queueRef.current.slice(1);
        setQueue([...queueRef.current]);
        setTimeout(() => speak(next), 700);
      }
    };
    utter.onerror = () => { setSpeaking(false); clearInterval(progRef.current); };
    window.speechSynthesis?.speak(utter);
  }, [voices, voiceIdx]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    clearInterval(progRef.current);
  }, []);

  const triggerStory = useCallback((key) => {
    if (triggeredRef.current.has(key)) return;
    triggeredRef.current.add(key);
    setTriggered(new Set(triggeredRef.current));
    const story = STORIES[key];
    if (!story) return;
    addLog(`📖 ${story.label}`, "story");
    if (!speaking) {
      speak(story);
    } else {
      queueRef.current = [...queueRef.current, story];
      setQueue([...queueRef.current]);
      addLog(`⏳ Warteschlange: ${story.label}`, "queue");
    }
  }, [speaking, speak, addLog]);

  // simulation
  useEffect(() => {
    if (!running) return;
    simRef.current = setInterval(() => {
      distRef.current = Math.min(distRef.current + speed * 0.4, TOTAL);
      setDist(distRef.current);

      Object.entries(STORIES).forEach(([key, story]) => {
        const wp = ROUTE[story.waypointId];
        const triggerDist = wp.dist - story.aheadM;
        if (!triggeredRef.current.has(parseInt(key)) && distRef.current >= triggerDist) {
          triggerStory(parseInt(key));
        }
      });

      if (distRef.current >= TOTAL) {
        clearInterval(simRef.current);
        setRunning(false);
        setDone(true);
        addLog("🏁 Ziel erreicht — Südwall 21", "arrival");
      }
    }, 400);
    return () => clearInterval(simRef.current);
  }, [running, speed, triggerStory, addLog]);

  const startSim = () => {
    distRef.current = 0;
    triggeredRef.current = new Set();
    queueRef.current = [];
    stopSpeech();
    setDist(0);
    setTriggered(new Set());
    setQueue([]);
    setLog([]);
    setDone(false);
    setActiveStory(null);
    setRunning(true);
    addLog("🚗 Abfahrt Grenzweg 9, Walbeck", "start");
    setTimeout(() => triggerStory(0), 600);
  };

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = Math.min(dist / TOTAL * 100, 100);

  // SVG map
  const lats = ROUTE.map(w => w.lat), lons = ROUTE.map(w => w.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const W = 340, H = 160, P = 14;
  const px = lon => P + (lon - minLon) / (maxLon - minLon) * (W - P * 2);
  const py = lat => H - P - (lat - minLat) / (maxLat - minLat) * (H - P * 2);
  const carPos = getPosAtDist(dist);
  const carX = px(carPos.lon), carY = py(carPos.lat);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg,#09090f 0%,#110e08 55%,#080f08 100%)", fontFamily: "Georgia,serif", color: "#f0ede5", overflowX: "hidden" }}>
      <style>{`
        @keyframes pulse2{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dp{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes wb{from{height:3px}to{height:18px}}
        @keyframes pring{0%{transform:scale(.8);opacity:.8}100%{transform:scale(2.4);opacity:0}}
        @keyframes carAnim{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#2a1f0a;border-radius:2px}
        select option{background:#120e06}
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px 64px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", padding: "26px 0 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 3 }}>
            <span style={{ fontSize: 20 }}>🧭</span>
            <span style={{ fontSize: "1.65rem", fontWeight: 700, letterSpacing: "-.02em" }}>
              Weg<em style={{ color: "#c8860a", fontStyle: "italic" }}>geflüster</em>
            </span>
          </div>
          <div style={{ fontSize: ".67rem", color: "#4a3a1a", letterSpacing: ".18em", textTransform: "uppercase" }}>
            Walbeck → Geldern · Routen-Demo
          </div>
        </div>

        {/* ── Route card ── */}
        <div style={{ background: "rgba(200,134,10,.06)", border: "1px solid rgba(200,134,10,.2)", borderRadius: 14, padding: "13px 15px", marginBottom: 11 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".66rem", color: "#5a4820", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>Route</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5ab05a", flexShrink: 0 }} />
                <span style={{ fontSize: ".8rem", color: "#c8bda0" }}>Grenzweg 9, Geldern-Walbeck</span>
              </div>
              {[1,2,3].map(i => <div key={i} style={{ width: 1, height: 5, background: "rgba(200,134,10,.25)", marginLeft: 3.5, marginBottom: 1 }} />)}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8860a", flexShrink: 0 }} />
                <span style={{ fontSize: ".8rem", color: "#c8bda0" }}>Südwall 21, Geldern</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#c8860a" }}>4,9 km</div>
              <div style={{ fontSize: ".7rem", color: "#5a4820" }}>≈ 10–15 Min.</div>
              <div style={{ fontSize: ".68rem", color: "#4a3810", marginTop: 5 }}>9 Story-Punkte</div>
            </div>
          </div>
        </div>

        {/* ── Mini map ── */}
        <div style={{ background: "rgba(0,0,0,.45)", border: "1px solid rgba(200,134,10,.12)", borderRadius: 12, overflow: "hidden", marginBottom: 11, position: "relative" }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
            {/* faint grid */}
            {[.33,.66].map(t => <line key={t} x1={W*t} y1={0} x2={W*t} y2={H} stroke="rgba(200,134,10,.04)" strokeWidth="1" />)}

            {/* route segments */}
            {ROUTE.slice(0,-1).map((wp, i) => {
              const nx = ROUTE[i+1];
              const done2 = dist >= nx.dist;
              const part  = dist > wp.dist && dist < nx.dist;
              const t = part ? (dist - wp.dist)/(nx.dist - wp.dist) : 0;
              return (
                <g key={i}>
                  <line x1={px(wp.lon)} y1={py(wp.lat)} x2={px(nx.lon)} y2={py(nx.lat)} stroke="rgba(200,134,10,.12)" strokeWidth="2.5" strokeLinecap="round"/>
                  {(done2||part) && <line x1={px(wp.lon)} y1={py(wp.lat)}
                    x2={done2?px(nx.lon):px(wp.lon)+(px(nx.lon)-px(wp.lon))*t}
                    y2={done2?py(nx.lat):py(wp.lat)+(py(nx.lat)-py(wp.lat))*t}
                    stroke="#c8860a" strokeWidth="2.5" strokeLinecap="round"/>}
                </g>
              );
            })}

            {/* story dots */}
            {Object.entries(STORIES).map(([key, s]) => {
              const wp = ROUTE[s.waypointId];
              const done2 = triggered.has(parseInt(key));
              return <circle key={key} cx={px(wp.lon)} cy={py(wp.lat)} r={done2?5:3.5}
                fill={done2?"#c8860a":"rgba(200,134,10,.25)"}
                stroke={done2?"#e8a820":"rgba(200,134,10,.45)"} strokeWidth="1.5"/>;
            })}

            {/* start / end */}
            <circle cx={px(ROUTE[0].lon)} cy={py(ROUTE[0].lat)} r={5} fill="#5ab05a" stroke="#7ad07a" strokeWidth="1.5"/>
            <circle cx={px(ROUTE[ROUTE.length-1].lon)} cy={py(ROUTE[ROUTE.length-1].lat)} r={5} fill="#c84030" stroke="#e86050" strokeWidth="1.5"/>

            {/* car */}
            {dist > 0 && (
              <g style={{ animation: running ? "carAnim .5s ease-in-out infinite" : "none" }}>
                <circle cx={carX} cy={carY} r={8} fill="rgba(200,134,10,.18)" stroke="#c8860a" strokeWidth="1.5"/>
                <text x={carX} y={carY+5.5} textAnchor="middle" fontSize="10" style={{userSelect:"none"}}>🚗</text>
              </g>
            )}
          </svg>
          <div style={{ position:"absolute", bottom:6, right:8, display:"flex", gap:8 }}>
            {[["#c8860a","Story"],["#5ab05a","Start"],["#c84030","Ziel"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:c}}/>
                <span style={{fontSize:".58rem",color:"#4a3810"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Progress ── */}
        <div style={{ marginBottom: 11 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:".7rem", color:"#5a4820" }}>Walbeck</span>
            <span style={{ fontSize:".72rem", color:"#c8860a", fontWeight:600 }}>{pct.toFixed(1)}%</span>
            <span style={{ fontSize:".7rem", color:"#5a4820" }}>Geldern</span>
          </div>
          <div style={{ height:4, background:"rgba(200,134,10,.1)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:pct+"%", background:"linear-gradient(90deg,#c8860a,#e8a820)", borderRadius:2, transition:"width .4s linear" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{(dist/1000).toFixed(2)} km</span>
            <span style={{ fontSize:".67rem", color:"#3a2e10" }}>{((TOTAL-dist)/1000).toFixed(2)} km verbleibend</span>
          </div>
        </div>

        {/* ── Current position ── */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 13px", background:"rgba(255,255,255,.03)", border:"1px solid rgba(200,134,10,.1)", borderRadius:10, marginBottom:11 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background: running?"#5ab05a":"#c8860a", animation: running?"pulse2 1.1s infinite":"none", flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".66rem", color:"#3a2e10", textTransform:"uppercase", letterSpacing:".08em" }}>
              {running?"Aktuell":done?"Angekommen":"Bereit"}
            </div>
            <div style={{ fontSize:".86rem", color:"#c8bda0" }}>{nearestWpName(dist)}</div>
          </div>
          <span style={{ fontSize:".73rem", color:"#5a4820" }}>{(dist/1000).toFixed(1)} km</span>
        </div>

        {/* ── Controls row ── */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:11 }}>
          <span style={{ fontSize:".68rem", color:"#3a2e10", flexShrink:0 }}>🚗</span>
          <input type="range" min={4} max={30} value={speed} onChange={e=>setSpeed(+e.target.value)}
            style={{ flex:1, accentColor:"#c8860a" }}/>
          <span style={{ fontSize:".73rem", color:"#c8860a", width:48, textAlign:"right", flexShrink:0 }}>
            {Math.round(speed*3.6)} km/h
          </span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <span style={{ fontSize:".68rem", color:"#3a2e10", flexShrink:0 }}>🎙️</span>
          <select value={voiceIdx} onChange={e=>setVoiceIdx(+e.target.value)}
            style={{ flex:1, background:"rgba(255,255,255,.04)", border:"1px solid rgba(200,134,10,.18)", borderRadius:8, color:"#f0ede5", fontFamily:"sans-serif", fontSize:".79rem", padding:"6px 9px", outline:"none", cursor:"pointer" }}>
            {voices.map((v,i)=><option key={i} value={i}>{v.lang.startsWith("de")?"🇩🇪 ":"🌐 "}{v.name}</option>)}
            {!voices.length && <option>Standard</option>}
          </select>
        </div>

        {/* ── Big CTA ── */}
        {!running && dist === 0 && !done ? (
          <button onClick={startSim} style={{ width:"100%", padding:16, background:"linear-gradient(135deg,#c8860a,#9a6408)", border:"none", borderRadius:14, color:"#120e06", fontFamily:"Georgia,serif", fontSize:"1rem", fontWeight:700, cursor:"pointer", boxShadow:"0 4px 22px rgba(200,134,10,.3)", marginBottom:14 }}>
            🚗 Fahrt starten — Walbeck → Geldern
          </button>
        ) : (
          <div style={{ display:"flex", gap:9, marginBottom:14 }}>
            <button onClick={()=>setRunning(r=>!r)} style={{ flex:1, padding:13, background: running?"rgba(200,134,10,.12)":"linear-gradient(135deg,#c8860a,#9a6408)", border:`1px solid ${running?"rgba(200,134,10,.3)":"transparent"}`, borderRadius:12, color: running?"#c8860a":"#120e06", fontFamily:"sans-serif", fontSize:".88rem", fontWeight:600, cursor:"pointer" }}>
              {running?"⏸ Pause":"▶ Weiter"}
            </button>
            <button onClick={startSim} style={{ padding:"13px 16px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:12, color:"#5a4820", fontFamily:"sans-serif", fontSize:".88rem", cursor:"pointer" }}>
              ↺ Neu
            </button>
          </div>
        )}

        {/* ── Active story panel ── */}
        {activeStory && (
          <div style={{ background:"rgba(200,134,10,.07)", border:"1px solid rgba(200,134,10,.28)", borderRadius:18, overflow:"hidden", marginBottom:13, animation:"slideIn .35s ease" }}>
            <div style={{ padding:"15px 17px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:".66rem", color:"#6a5228", textTransform:"uppercase", letterSpacing:".12em", marginBottom:3 }}>
                  {activeStory.badge}
                </div>
                <div style={{ fontStyle:"italic", fontSize:"1.12rem", color:"#c8860a", lineHeight:1.25 }}>{activeStory.label}</div>
              </div>
              {/* waveform */}
              <div style={{ display:"flex", alignItems:"center", gap:2.5, paddingTop:5 }}>
                {[8,13,18,22,17,12,9,16,20,13].map((h,i)=>(
                  <div key={i} style={{ width:2.5, borderRadius:2, background:"#c8860a",
                    height: speaking?undefined:h+"px", opacity: speaking?.85:.2,
                    animation: speaking?`wb ${.28+(i%4)*.13}s ${i*.05}s ease-in-out infinite alternate`:"none",
                    minHeight: speaking?"3px":undefined, maxHeight: speaking?"22px":undefined }}/>
                ))}
              </div>
            </div>

            <div style={{ padding:"12px 17px", maxHeight:230, overflowY:"auto" }}>
              <div style={{ fontSize:".9rem", lineHeight:1.9, color:"#b0a890", fontWeight:300, fontFamily:"Georgia,serif" }}>
                {activeStory.text.split("\n\n").map((p,i)=><p key={i} style={{marginBottom:10}}>{p}</p>)}
              </div>
            </div>

            <div style={{ padding:"10px 17px 15px", borderTop:"1px solid rgba(200,134,10,.1)", display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>speaking?stopSpeech():speak(activeStory)}
                style={{ width:38, height:38, borderRadius:"50%", background:"#c8860a", border:"none", cursor:"pointer", fontSize:16, flexShrink:0 }}>
                {speaking?"⏸":"▶"}
              </button>
              <div style={{ flex:1, height:3, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:spProgress+"%", background:"#c8860a", transition:"width .3s linear" }}/>
              </div>
              {speaking && <span style={{ fontSize:".67rem", color:"#c8860a" }}>● LIVE</span>}
              <span style={{ fontSize:".7rem", color:"#4a3810" }}>{fmt(spElapsed)}</span>
            </div>
          </div>
        )}

        {/* ── Queue pill ── */}
        {queue.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 13px", background:"rgba(200,134,10,.05)", border:"1px solid rgba(200,134,10,.1)", borderRadius:10, marginBottom:12 }}>
            {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#c8860a",animation:`dp 1.2s ${i*.2}s infinite`}}/>)}
            <span style={{ fontSize:".77rem", color:"#7a6238" }}>Nächste: <em style={{color:"#c8860a"}}>{queue[0]?.label}</em></span>
          </div>
        )}

        {/* ── Story waypoint list ── */}
        <div style={{ marginBottom:13 }}>
          <div style={{ fontSize:".65rem", color:"#3a2e10", textTransform:"uppercase", letterSpacing:".13em", marginBottom:8 }}>Story-Punkte</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {Object.entries(STORIES).map(([key,s])=>{
              const id = parseInt(key);
              const wp = ROUTE[s.waypointId];
              const done2 = triggered.has(id);
              const rem = Math.max(0, wp.dist - dist);
              const isCur = activeStory?.label === s.label;
              return (
                <div key={key} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 11px", borderRadius:10,
                  background: isCur?"rgba(200,134,10,.1)":"rgba(255,255,255,.02)",
                  border:`1px solid ${isCur?"rgba(200,134,10,.28)":"rgba(255,255,255,.04)"}`,
                  opacity: done2?.55:1, transition:"all .3s" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                    background: done2?"#c8860a":rem<200?"#e8a820":"rgba(200,134,10,.28)",
                    border:`1.5px solid ${done2?"#e8a820":"rgba(200,134,10,.4)"}` }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:".78rem", color: done2?"#5a4820":"#c0b898" }}>{s.label}</div>
                    <div style={{ fontSize:".66rem", color:"#3a2e10", marginTop:1 }}>{s.preview}</div>
                  </div>
                  <div style={{ fontSize:".69rem", color: done2?"#3a2e10":rem<100?"#e8a820":"#4a3810", flexShrink:0 }}>
                    {done2?"✓":rem<50?"jetzt":`${Math.round(rem)}m`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Log ── */}
        {log.length > 0 && (
          <div style={{ background:"rgba(0,0,0,.35)", border:"1px solid rgba(255,255,255,.04)", borderRadius:10, padding:"9px 12px", maxHeight:110, overflowY:"auto" }}>
            <div style={{ fontSize:".63rem", color:"#2a2010", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Log</div>
            {log.map((e,i)=>(
              <div key={i} style={{ fontSize:".71rem", color: e.type==="story"?"#c8860a":e.type==="arrival"?"#5ab05a":"#3a2e10", marginBottom:3, display:"flex", gap:8 }}>
                <span style={{ flexShrink:0, opacity:.5 }}>{e.t}</span><span>{e.msg}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
