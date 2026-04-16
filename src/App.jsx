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


/* ─── AUTO BACKGROUND ─────────────────────────────────────────── */
function AutoBackground({ progress }) {
  return (
    <svg viewBox="0 0 400 700" style={{
      position:"fixed",inset:0,width:"100%",height:"100%",
      opacity:0.24*progress,transition:"opacity 0.8s ease",pointerEvents:"none",zIndex:0,
    }}>
      <defs><style>{`
        @keyframes roadScroll { 0%{transform:translateY(0)} 100%{transform:translateY(80px)} }
        @keyframes carFloat { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
        .road-anim { animation:roadScroll 14s linear infinite }
        .car-float { animation:carFloat 8s ease-in-out infinite }
      `}</style></defs>
      <g className="road-anim">
        <path d="M 160 750 C 160 650,80 580,100 480 C 120 380,280 340,260 240 C 240 140,140 100,160 0"
          fill="none" stroke="#8B6914" strokeWidth="60" strokeLinecap="round" opacity="0.12"/>
        {[680,580,480,380,280,180,80].map((y,i)=>(
          <ellipse key={i} cx={155-i*5} cy={y} rx="4" ry="14" fill="#C9A84C" opacity="0.06"/>
        ))}
        {[[60,500],[40,380],[70,260],[80,160],[290,520],[310,400],[280,300],[300,180]].map(([x,y],i)=>(
          <g key={i}>
            <circle cx={x} cy={y-20} r="18" fill="#6B7C3A" opacity="0.24"/>
            <rect x={x-3} y={y} width="6" height="20" fill="#8B6914" opacity="0.24"/>
          </g>
        ))}
      </g>
      <g className="car-float" style={{transformOrigin:"200px 320px"}}>
        <rect x="130" y="310" width="140" height="50" rx="8" fill="#C9A84C" opacity="0.18"/>
        <rect x="150" y="290" width="100" height="30" rx="6" fill="#C9A84C" opacity="0.24"/>
        <circle cx="160" cy="362" r="14" fill="#8B6914" opacity="0.18"/>
        <circle cx="240" cy="362" r="14" fill="#8B6914" opacity="0.18"/>
      </g>
    </svg>
  );
}

/* ─── BUS BACKGROUND ───────────────────────────────────────────── */
function BusBackground({ progress }) {
  const bset = [
    [0,240,55,180],[58,210,45,210],[106,250,38,170],
    [147,220,60,200],[210,235,40,185],[253,200,50,220],
    [306,245,45,175],[354,215,46,205],
  ];
  return (
    <svg viewBox="0 0 400 700" style={{
      position:"fixed",inset:0,width:"100%",height:"100%",
      opacity:0.24*progress,transition:"opacity 0.8s ease",pointerEvents:"none",zIndex:0,
    }}>
      <defs><style>{`
        @keyframes busDrive { 0%{transform:translateX(440px)} 100%{transform:translateX(-360px)} }
        @keyframes bldgMove { 0%{transform:translateX(0)} 100%{transform:translateX(-400px)} }
        @keyframes bldgMove2 { 0%{transform:translateX(400px)} 100%{transform:translateX(0)} }
        .bus1 { animation:busDrive 32s linear infinite }
        .bus2 { animation:busDrive 40s linear infinite 16s }
        .bldg1 { animation:bldgMove 40s linear infinite }
        .bldg2 { animation:bldgMove2 40s linear infinite }
      `}</style></defs>
      {["bldg1","bldg2"].map((cls,si)=>(
        <g key={si} className={cls}>
          {bset.map(([x,y,w,h],i)=>(
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#8B6914" opacity="0.12"/>
              {Array.from({length:Math.floor(h/30)}).map((_,wr)=>
                Array.from({length:Math.floor(w/16)}).map((_,wc)=>(
                  <rect key={wr+"-"+wc} x={x+5+wc*16} y={y+8+wr*30} width="8" height="14" rx="1" fill="#C9A84C" opacity="0.08"/>
                ))
              )}
            </g>
          ))}
        </g>
      ))}
      <rect x="0" y="415" width="400" height="170" fill="#8B6914" opacity="0.05"/>
      <line x1="0" y1="415" x2="400" y2="415" stroke="#C9A84C" strokeWidth="3" opacity="0.11"/>
      <g className="bus1">
        <rect x="0" y="428" width="230" height="118" rx="11" fill="#C9A84C" opacity="0.42"/>
        <rect x="4" y="418" width="222" height="18" rx="5" fill="#C9A84C" opacity="0.11"/>
        {[14,52,90,132,168].map((x,i)=>(
          <rect key={i} x={x} y="434" width="30" height="36" rx="4" fill="#EDE6D6" opacity="0.32"/>
        ))}
        <circle cx="48" cy="548" r="22" fill="#3A2508" opacity="0.18"/>
        <circle cx="178" cy="548" r="22" fill="#3A2508" opacity="0.18"/>
      </g>
      <g className="bus2">
        <rect x="0" y="442" width="160" height="82" rx="8" fill="#C9A84C" opacity="0.22"/>
        {[12,42,72,108].map((x,i)=>(
          <rect key={i} x={x} y="447" width="22" height="26" rx="3" fill="#EDE6D6" opacity="0.16"/>
        ))}
        <circle cx="32" cy="526" r="15" fill="#3A2508" opacity="0.18"/>
        <circle cx="126" cy="526" r="15" fill="#3A2508" opacity="0.18"/>
      </g>
    </svg>
  );
}

/* ─── FAHRRAD BACKGROUND ───────────────────────────────────────── */
function BikeBackground({ progress }) {
  return (
    <svg viewBox="0 0 400 700" style={{
      position:"fixed",inset:0,width:"100%",height:"100%",
      opacity:0.35*progress,transition:"opacity 0.8s ease",pointerEvents:"none",zIndex:0,
    }}>
      <defs><style>{`
        @keyframes bkRide1 { 0%{transform:translate(-150px,530px)} 100%{transform:translate(520px,530px)} }
        @keyframes bkRide2 { 0%{transform:translate(-150px,545px)} 100%{transform:translate(520px,545px)} }
        @keyframes bird1   { 0%{transform:translate(-80px,160px)}  100%{transform:translate(480px,140px)} }
        @keyframes bird2   { 0%{transform:translate(-80px,240px)}  100%{transform:translate(480px,260px)} }
        @keyframes cld1    { 0%{transform:translateX(0)}   100%{transform:translateX(-420px)} }
        @keyframes cld2    { 0%{transform:translateX(420px)} 100%{transform:translateX(0)} }
        @keyframes legP    { 0%,100%{transform:rotate(-30deg)} 50%{transform:rotate(30deg)} }
        .bk1 { animation:bkRide1 22s linear infinite }
        .bk2 { animation:bkRide2 28s linear infinite 11s }
        .bd1 { animation:bird1 14s ease-in-out infinite 1s }
        .bd2 { animation:bird2 14s ease-in-out infinite 1s }
        .cl1 { animation:cld1 20s linear infinite }
        .cl2 { animation:cld2 20s linear infinite }
      `}</style></defs>

      {/* Sky */}
      <rect x="0" y="0" width="400" height="420" fill="#87CEEB" opacity="0.22"/>

      {/* Clouds */}
      {["cl1","cl2"].map((cls,si)=>(
        <g key={si} className={cls}>
          {[[30,100],[140,80],[260,95],[370,75],[490,90],[560,110]].map(([x,y],i)=>(
            <g key={i}>
              <ellipse cx={x} cy={y} rx="36" ry="16" fill="#fff" opacity="0.45"/>
              <ellipse cx={x+22} cy={y-9} rx="22" ry="14" fill="#fff" opacity="0.38"/>
              <ellipse cx={x-16} cy={y-5} rx="18" ry="12" fill="#fff" opacity="0.35"/>
            </g>
          ))}
        </g>
      ))}

      {/* Ocean */}
      <rect x="0" y="360" width="400" height="70" fill="#4A90D9" opacity="0.3"/>
      <line x1="0" y1="360" x2="400" y2="360" stroke="#6AAFEE" strokeWidth="2" opacity="0.4"/>
      {[0,1,2].map(i=>(
        <line key={i} x1="0" y1={375+i*12} x2="400" y2={375+i*12} stroke="#fff" strokeWidth="1" opacity="0.1"/>
      ))}

      {/* Grass */}
      <rect x="0" y="420" width="400" height="55" fill="#5A9E2F" opacity="0.45"/>
      <line x1="0" y1="420" x2="400" y2="420" stroke="#4A8E1F" strokeWidth="1.5" opacity="0.4"/>
      {Array.from({length:50}).map((_,i)=>(
        <g key={i}>
          <rect x={i*9} y="418" width="2.5" height="6" fill="#4A8E1F" opacity="0.5"/>
          <rect x={i*9+4} y="416" width="2.5" height="8" fill="#5AAE2F" opacity="0.5"/>
        </g>
      ))}

      {/* Road */}
      <rect x="0" y="475" width="400" height="65" fill="#8B7355" opacity="0.22"/>
      <line x1="0" y1="475" x2="400" y2="475" stroke="#C9A84C" strokeWidth="2" opacity="0.25"/>
      {Array.from({length:12}).map((_,i)=>(
        <rect key={i} x={i*36-4} y="504" width="22" height="5" rx="2" fill="#C9A84C" opacity="0.3"/>
      ))}
      <rect x="0" y="540" width="400" height="160" fill="#5A9E2F" opacity="0.2"/>

      {/* Bird 1 (red) */}
      <g className="bd1">
        <ellipse cx="0" cy="0" rx="38" ry="14" fill="#C03020" opacity="0.7"/>
        <ellipse cx="12" cy="3" rx="18" ry="9" fill="#F5F0E8" opacity="0.75"/>
        <ellipse cx="40" cy="-4" rx="13" ry="11" fill="#C03020" opacity="0.75"/>
        <circle cx="47" cy="-7" r="4" fill="#fff" opacity="0.9"/>
        <path d="M -4 -6 L -36 -32 L 4 -9 Z" fill="#C03020" opacity="0.65"/>
        <path d="M -4 7 L -38 32 L 4 9 Z" fill="#A02010" opacity="0.55"/>
      </g>

      {/* Bird 2 (blue) */}
      <g className="bd2">
        <ellipse cx="0" cy="0" rx="42" ry="16" fill="#2858C0" opacity="0.7"/>
        <ellipse cx="14" cy="4" rx="22" ry="10" fill="#F5F0E8" opacity="0.75"/>
        <ellipse cx="46" cy="-6" rx="15" ry="12" fill="#2858C0" opacity="0.75"/>
        <circle cx="55" cy="-9" r="4.5" fill="#fff" opacity="0.9"/>
        <path d="M -5 -7 L -44 -40 L 5 -11 Z" fill="#2858C0" opacity="0.65"/>
        <path d="M -5 9 L -46 40 L 5 11 Z" fill="#1A3E90" opacity="0.55"/>
      </g>

      {/* Bike 1 */}
      <g className="bk1">
        <circle cx="0" cy="0" r="20" fill="none" stroke="#3A2508" strokeWidth="3" opacity="0.65"/>
        <circle cx="62" cy="0" r="20" fill="none" stroke="#3A2508" strokeWidth="3" opacity="0.65"/>
        {[0,45,90,135].map((a,i)=>{const r=a*Math.PI/180;return(
          <line key={i} x1={-15*Math.cos(r)} y1={-15*Math.sin(r)} x2={15*Math.cos(r)} y2={15*Math.sin(r)} stroke="#8B6914" strokeWidth="1.8" opacity="0.55"/>
        );})}
        {[0,45,90,135].map((a,i)=>{const r=a*Math.PI/180;return(
          <line key={i} x1={62-15*Math.cos(r)} y1={-15*Math.sin(r)} x2={62+15*Math.cos(r)} y2={15*Math.sin(r)} stroke="#8B6914" strokeWidth="1.8" opacity="0.55"/>
        );})}
        <line x1="0" y1="0" x2="24" y2="-24" stroke="#C9841C" strokeWidth="3.5" strokeLinecap="round" opacity="0.75"/>
        <line x1="24" y1="-24" x2="18" y2="-48" stroke="#C9841C" strokeWidth="3.5" strokeLinecap="round" opacity="0.75"/>
        <line x1="18" y1="-48" x2="48" y2="-42" stroke="#C9841C" strokeWidth="3.5" strokeLinecap="round" opacity="0.72"/>
        <line x1="18" y1="-48" x2="62" y2="-24" stroke="#C9841C" strokeWidth="3.5" strokeLinecap="round" opacity="0.72"/>
        <line x1="48" y1="-42" x2="62" y2="0" stroke="#C9841C" strokeWidth="3" strokeLinecap="round" opacity="0.72"/>
        <line x1="18" y1="-48" x2="0" y2="0" stroke="#C9841C" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
        <line x1="48" y1="-42" x2="50" y2="-57" stroke="#8B6914" strokeWidth="3" strokeLinecap="round" opacity="0.75"/>
        <line x1="43" y1="-58" x2="58" y2="-54" stroke="#8B6914" strokeWidth="3.5" strokeLinecap="round" opacity="0.75"/>
        <line x1="18" y1="-48" x2="16" y2="-63" stroke="#8B6914" strokeWidth="3" strokeLinecap="round" opacity="0.72"/>
        <line x1="8" y1="-63" x2="26" y2="-63" stroke="#8B6914" strokeWidth="4" strokeLinecap="round" opacity="0.78"/>
        <line x1="16" y1="-63" x2="44" y2="-74" stroke="#C9A84C" strokeWidth="6" strokeLinecap="round" opacity="0.65"/>
        <circle cx="46" cy="-84" r="11" fill="#EDE6D6" opacity="0.72"/>
        <path d="M 35 -85 Q 46 -97 57 -85" fill="#C9841C" opacity="0.82"/>
        <rect x="35" y="-86" width="22" height="5" rx="2" fill="#C9841C" opacity="0.82"/>
        <line x1="44" y1="-74" x2="56" y2="-59" stroke="#EDE6D6" strokeWidth="4.5" strokeLinecap="round" opacity="0.6"/>
        <line x1="24" y1="-24" x2="14" y2="-5" stroke="#8B6914" strokeWidth="4.5" strokeLinecap="round" opacity="0.65"
          style={{transformOrigin:"24px -24px", animation:"legP 0.6s ease-in-out infinite"}}/>
        <line x1="24" y1="-24" x2="34" y2="-4" stroke="#6B5B45" strokeWidth="4.5" strokeLinecap="round" opacity="0.55"
          style={{transformOrigin:"24px -24px", animation:"legP 0.6s ease-in-out infinite 0.3s"}}/>
      </g>

      {/* Bike 2 smaller */}
      <g className="bk2">
        <circle cx="0" cy="0" r="16" fill="none" stroke="#3A2508" strokeWidth="2.5" opacity="0.5"/>
        <circle cx="50" cy="0" r="16" fill="none" stroke="#3A2508" strokeWidth="2.5" opacity="0.5"/>
        <line x1="0" y1="0" x2="18" y2="-18" stroke="#A07828" strokeWidth="3" strokeLinecap="round" opacity="0.55"/>
        <line x1="18" y1="-18" x2="14" y2="-36" stroke="#A07828" strokeWidth="3" strokeLinecap="round" opacity="0.55"/>
        <line x1="14" y1="-36" x2="38" y2="-32" stroke="#A07828" strokeWidth="3" strokeLinecap="round" opacity="0.52"/>
        <line x1="14" y1="-36" x2="50" y2="-18" stroke="#A07828" strokeWidth="3" strokeLinecap="round" opacity="0.52"/>
        <line x1="14" y1="-36" x2="0" y2="0" stroke="#A07828" strokeWidth="2" strokeLinecap="round" opacity="0.45"/>
        <line x1="14" y1="-36" x2="12" y2="-50" stroke="#8B6914" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
        <line x1="5" y1="-50" x2="20" y2="-50" stroke="#8B6914" strokeWidth="3.5" strokeLinecap="round" opacity="0.65"/>
        <line x1="12" y1="-50" x2="34" y2="-58" stroke="#C9A84C" strokeWidth="5" strokeLinecap="round" opacity="0.55"/>
        <circle cx="36" cy="-67" r="9" fill="#EDE6D6" opacity="0.6"/>
        <path d="M 27 -68 Q 36 -78 45 -68" fill="#8B6914" opacity="0.7"/>
        <line x1="18" y1="-18" x2="10" y2="-3" stroke="#8B6914" strokeWidth="3.5" strokeLinecap="round" opacity="0.5"
          style={{transformOrigin:"18px -18px", animation:"legP 0.6s ease-in-out infinite 0.15s"}}/>
        <line x1="18" y1="-18" x2="26" y2="-2" stroke="#6B5B45" strokeWidth="3.5" strokeLinecap="round" opacity="0.45"
          style={{transformOrigin:"18px -18px", animation:"legP 0.6s ease-in-out infinite 0.45s"}}/>
      </g>
    </svg>
  );
}

/* ─── ZU FUSS BACKGROUND ───────────────────────────────────────── */
function WalkBackground({ progress }) {
  const steps = [];
  for (let i = 0; i < 16; i++) {
    const y = 650 - i * 38;
    const L = i % 2 === 0;
    steps.push([L ? 148 : 172, y, L ? -12 : 12]);
  }
  return (
    <svg viewBox="0 0 400 700" style={{
      position:"fixed",inset:0,width:"100%",height:"100%",
      opacity:0.32*progress,transition:"opacity 0.8s ease",pointerEvents:"none",zIndex:0,
    }}>
      <defs><style>{`
        @keyframes inkStep { 0%{opacity:0;transform:scale(0.2)} 8%{opacity:0.75;transform:scale(1.05)} 15%{opacity:0.65;transform:scale(1)} 80%{opacity:0.65} 100%{opacity:0.08} }
      `}</style></defs>
      <rect x="128" y="0" width="144" height="700" fill="#C9A84C" opacity="0.03" rx="6"/>
      {steps.map(([x,y,rot],i)=>(
        <g key={i} style={{
          transformOrigin:x+"px "+y+"px",
          animation:"inkStep 20s ease-in-out infinite",
          animationDelay:(i*1.25)+"s",
        }}>
          <ellipse cx={x} cy={y} rx="6" ry="10" fill="#8B6914"
            transform={"rotate("+rot+","+x+","+y+")"} opacity="1"/>
          {[-3.5,-1,1.5,4].map((tx,ti)=>(
            <ellipse key={ti} cx={x+tx} cy={y+(rot<0?-12:12)} rx="2" ry="1.6" fill="#8B6914" opacity="0.8"/>
          ))}
        </g>
      ))}
      {[[38,290],[355,270],[25,155],[372,148],[90,420],[310,400]].map(([x,y],i)=>(
        <g key={i} opacity={0.18+(i%3)*0.04}>
          <ellipse cx={x} cy={y-26} rx="24" ry="30" fill="#6B7C3A"/>
          <rect x={x-4} y={y+2} width="8" height="22" fill="#8B6914"/>
        </g>
      ))}
    </svg>
  );
}

const CATEGORIES = ["Reiseführer", "Geschichte", "Natur", "Persönlichkeiten", "Mythen", "Kulinarik", "Architektur"];

export default function App() {
  const prefersDark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  const [isDark, setIsDark] = useState(() => { const s = localStorage.getItem("wg_dark"); return s !== null ? s === "true" : prefersDark; });
  const [activeColor, setActiveColor] = useState(() => localStorage.getItem("wg_color") || "gold");
  const [colorOpen, setColorOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("wg_photo") || null);

  const colorMap = {
    gold:   "#C9841C",
    silver: "#888880",
    green:  "#3A8C4A",
    red:    "#C03030",
    orange: "#E06820",
    blue:   "#2858C0",
  };
  const clr = colorMap[activeColor];

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
  const [voiceEngine, setVoiceEngine]   = useState("elevenlabs");
  const [playbackRate, setPlaybackRate] = useState(() => parseFloat(localStorage.getItem("wg_rate") || "1"));
  const [voiceDropOpen, setVoiceDropOpen] = useState(false);
  const [transport, setTransport]     = useState("car");
  const [bgProgress, setBgProgress]   = useState({ car:1, bus:0, bike:0, walk:0 });
  const prevTransport = useRef("car");

  const handleTransport = (id) => {
    if (id === transport) return;
    setBgProgress(prev => ({ ...prev, [prevTransport.current]:0 }));
    setTimeout(() => {
      setBgProgress(prev => ({ ...prev, [id]:1 }));
      setTransport(id);
      transportR.current = id;
      prevTransport.current = id;
    }, 80);
  };

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
  const voiceEngineR = useRef("elevenlabs");
  const transportR  = useRef("car");
  const audioRef    = useRef(null);
  const memoryR     = useRef([]);
  const searchT     = useRef({});
  const voicesR     = useRef([]);
  const voiceIdxR   = useRef(0);
  const geocodeT    = useRef(0);
  const lastStoryDistR = useRef(0);
  const surroundingsR  = useRef("");
  const nextStoryR     = useRef(null);
  const preloadingR    = useRef(false);
  const manualStopR    = useRef(false);

  useEffect(() => { categoryR.current = category; }, [category]);
  useEffect(() => { speedR.current = speedKmh; }, [speedKmh]);
  useEffect(() => { transportR.current = transport; }, [transport]);
  useEffect(() => { voiceEngineR.current = voiceEngine; }, [voiceEngine]);
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

  async function getSurroundings(lat, lon) {
    try {
      const r = 300;
      const q = `[out:json][timeout:5];(
        way["landuse"](around:${r},${lat},${lon});
        way["natural"](around:${r},${lat},${lon});
        node["amenity"](around:${r},${lat},${lon});
        node["tourism"](around:${r},${lat},${lon});
        node["historic"](around:${r},${lat},${lon});
        way["building"="church"](around:${r},${lat},${lon});
      );out body;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method:"POST", body:"data=" + encodeURIComponent(q),
        headers:{"Content-Type":"application/x-www-form-urlencoded"}
      });
      const data = await res.json();
      const tags = data.elements.map(e => {
        const t = e.tags || {};
        return t.name || t.landuse || t.natural || t.amenity || t.tourism || t.historic || t.building;
      }).filter(Boolean);
      const unique = [...new Set(tags)].slice(0, 8);
      return unique.join(", ");
    } catch { return ""; }
  }

  async function geocode(lat, lon) {
    try {
      const r = await fetch("/api/geocode?lat=" + lat + "&lon=" + lon);
      const d = await r.json();
      return d.name || "";
    } catch { return ""; }
  }

  function stopAudio() {
    manualStopR.current = true;
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    clearInterval(progRef.current);
    setSpeaking(false);
    speakingR.current = false;
    setTimeout(() => { manualStopR.current = false; }, 1500);
  }

  function onStoryEnd() {
    setSpeaking(false);
    speakingR.current = false;
    clearInterval(progRef.current);
    setSpProgress(100);
    setTimeout(() => {
      if (!manualStopR.current && !speakingR.current && !generatingR.current && simDistR.current > 0 && simDistR.current < routeDistR.current && !arrivedR.current) {
        triggerNextStory();
      }
    }, 500);
    if (!manualStopR.current && simDistR.current > 0 && simDistR.current < routeDistR.current) {
      setTimeout(() => preloadNextStory(), 1000);
    }
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
    if (voiceEngineR.current === "browser") { fallbackTTS(text); return; }
    if (voiceEngineR.current === "edge") { edgeTTS(text); return; }
    if (audioBase64) {
      try {
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
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
    utter.rate = 0.88 * playbackRate;
    utter.onend = onStoryEnd;
    utter.onerror = onStoryEnd;
    window.speechSynthesis?.speak(utter);
  }

  async function edgeTTS(text) {
    try {
      const r = await fetch("https://api.voicerss.org/?key=free&hl=de-de&src=" + encodeURIComponent(text) + "&f=44khz_16bit_stereo&c=mp3&ssml=0");
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); onStoryEnd(); };
        audio.onerror = () => { URL.revokeObjectURL(url); fallbackTTS(text); };
        audio.play().catch(() => fallbackTTS(text));
        return;
      }
    } catch(e) { console.error("Edge TTS error:", e); }
    fallbackTTS(text);
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
      const surr = surroundingsR.current ? "\nUmgebung sichtbar: " + surroundingsR.current : "";
      prompt = memCtx +
        "Du bist ein faszinierender Reisebegleiter. Der Fahrer faehrt mit " + kmh + " km/h.\n" +
        "Ort (wird gleich passiert): " + locationName + surr + "\n" +
        "Thema: " + cat + "\n" +
        "Laenge: ca. " + words + " Woerter\n\n" +
        transition + "\n\n" +
        "Regeln:\n" +
        "- Baue den Ortsnamen oder die Strasse SUBTIL und natuerlich in die Geschichte ein - nicht als Einstieg\n" +
        "- Starte SOFORT mit einer konkreten Szene, Person, Jahreszahl oder sinnlichen Beschreibung\n" +
        "- Sprich den Hoerer direkt an: 'Schau mal...', 'Stell dir vor...', 'Weisst du...'\n" +
        "- Nutze die Umgebung (Felder, Gebaeude, Natur) um die Geschichte lebendig zu machen\n" +
        "- Echte, spezifische Details: Namen, Jahreszahlen, unbekannte Fakten\n" +
        "- Ende mit einem natuerlichen Uebergang oder einer offenen Frage\n" +
        "- Nur fliesender Text auf Deutsch, keine Aufzaehlungen, keine Ueberschriften";
    }
    setStoryLoading(true);
    setStoryTitle(isIntro ? (introData.start + " -> " + introData.end) : locationName);
    setStoryText("");
    addLog((isIntro ? "Einleitung" : locationName), "story");
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName: locationName, category: cat, speedKmh: kmh, transport: transportR.current, voiceEngine: voiceEngineR.current, customPrompt: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        const cleanText = data.text.replace(/^#+ /gm, "").replace(/\*\*/g, "").replace(/\*/g, "").trim();
        setStoryText(data.text);
        setStoryAudio(data.audio || null);
        setStoryLoading(false);
        if (!isIntro) {
          const summary = data.text.slice(0, 120) + "...";
          memoryR.current = [...memoryR.current.slice(-4), { place: locationName, summary }];
          setStoryCount(c => c + 1);
        }
        generatingR.current = false;
        const speakClean = data.text.replace(/^#+ [^\n]*\n?/gm, "").replace(/\*\*/g, "").replace(/\*/g, "").trim();
        await speakText(speakClean, data.audio || null);
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

  async function preloadNextStory() {
    if (preloadingR.current || nextStoryR.current) return;
    preloadingR.current = true;
    const wps = routeR.current;
    if (!wps.length) { preloadingR.current = false; return; }
    const speedKmhNow = speedR.current;
    const lookAheadMeters = Math.max(300, speedKmhNow * 8); // 8 Sekunden voraus
    const lookahead = Math.min(simDistR.current + lookAheadMeters, routeDistR.current - 50);
    const idx = Math.min(Math.floor(lookahead / routeDistR.current * wps.length), wps.length-1);
    const pos = wps[idx];
    try {
      const name = await geocode(pos.lat, pos.lon);
      const surr = await getSurroundings(pos.lat, pos.lon);
      surroundingsR.current = surr;
      if (name) {
        const kmh = speedR.current;
        const cat = categoryR.current;
        const words = getWordCount(kmh, transportR.current);
        const memory = memoryR.current;
        const count = memoryR.current.length;
        let memCtx = "";
        if (memory.length > 0) {
          const memLines = memory.map(function(m, i) { return (i+1) + ". " + m.place + ": " + m.summary; }).join("\n");
          memCtx = "Bereits erzaehlt:\n" + memLines + "\n\nWICHTIG: Wiederhole KEINE dieser Fakten.\n\n";
        }
        const transition = count === 0
          ? "Beginne sofort mit der Geschichte."
          : "Dies ist Story " + (count+1) + ". Beginne mit einem kurzen Uebergang wie 'Und waehrend du weiterfaehrst...', 'Apropos...'.";
        const surroundsText = surr ? "\nUmgebung: " + surr : "";
        const prompt = memCtx +
          "Du bist ein faszinierender Reisebegleiter. Der Fahrer faehrt mit " + kmh + " km/h und wird GLEICH an folgendem Ort vorbeifahren.\n" +
          "Kommender Ort: " + name + surroundsText + "\n" +
          "Thema: " + cat + "\n" +
          "Laenge: ca. " + words + " Woerter\n\n" +
          transition + "\n\n" +
          "Regeln:\n" +
          "- Baue Ortsnamen SUBTIL ein\n" +
          "- Starte SOFORT mit konkreter Szene oder Jahreszahl\n" +
          "- Nutze die Umgebung lebendig\n" +
          "- Ende mit natuerlichem Uebergang\n" +
          "- Nur fliesender Text auf Deutsch";
        const res = await fetch("/api/story", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ placeName: name, category: cat, speedKmh: kmh, transport: transportR.current, voiceEngine: "none", customPrompt: prompt }),
        });
        const data = await res.json();
        if (data.text) {
          nextStoryR.current = { text: data.text, place: name };
        }
      }
    } catch(e) { console.error("Preload error:", e); }
    preloadingR.current = false;
  }

  async function triggerNextStory() {
    if (speakingR.current || generatingR.current) return;
    if (nextStoryR.current) {
      const { text, place } = nextStoryR.current;
      nextStoryR.current = null;
      generatingR.current = true;
      const summary = text.slice(0, 120) + "...";
      memoryR.current = [...memoryR.current.slice(-4), { place, summary }];
      setStoryCount(c => c + 1);
      setStoryTitle(place);
      setStoryText(text);
      setStoryLoading(false);
      generatingR.current = false;
      await speakText(text, null);
      return;
    }
    const wps = routeR.current;
    if (!wps.length) return;
    const speedNow = speedR.current;
    const lookAhead = Math.max(300, speedNow * 8);
    const futureDist = Math.min(simDistR.current + lookAhead, routeDistR.current - 50);
    const idx = Math.min(Math.floor(futureDist / routeDistR.current * wps.length), wps.length-1);
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
      if (now - geocodeT.current > 6000) {
        geocodeT.current = now;
        const idx = Math.min(Math.floor(simDistR.current / routeDist * route.length), route.length-1);
        const pos = route[idx];
        const name = await geocode(pos.lat, pos.lon);
        if (name) setCurrentLoc(name);
        const surroundings = await getSurroundings(pos.lat, pos.lon);
        surroundingsR.current = surroundings;
      }
      const storyInterval = Math.max(300, 800 / Math.max(1, simSpeed * 3.6 / 50));
      if (!speakingR.current && !generatingR.current && simDistR.current > 50 &&
          simDistR.current - lastStoryDistR.current > storyInterval) {
        lastStoryDistR.current = simDistR.current;
        triggerNextStory();
      }
      // Pre-load wenn sprechend und noch keine nächste Story
      if (speakingR.current && !nextStoryR.current && !preloadingR.current) {
        preloadNextStory();
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
        const surr = await getSurroundings(pos.coords.latitude, pos.coords.longitude);
        surroundingsR.current = surr;
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
    accent:clr, accentDim:clr+"26", accentBorder:clr+"44", accentGlow:clr+"36",
    btnPrimary:clr, btnText:"#ffffff",
    border:"rgba(255,255,255,0.07)", borderFaint:"rgba(255,255,255,0.04)",
    segBg:"rgba(255,255,255,0.07)", storyBg:"rgba(40,36,30,0.9)", storyBorder:"rgba(201,168,76,0.2)",
    errorBg:"rgba(180,40,40,0.15)", errorBorder:"rgba(180,40,40,0.3)", errorText:"#ff8080",
    gpsBg:"rgba(40,36,30,0.9)",
  } : {
    bg:"#F5F0E8", bgCard:"rgba(255,255,255,0.75)", bgInput:"rgba(255,255,255,0.75)", bgSugg:"rgba(250,247,242,0.97)",
    text:"#2C2014", textMuted:"#9A8060", textFaint:"#B0A080", inputColor:"#2C2014",
    accent:clr, accentDim:clr+"20", accentBorder:clr+"44", accentGlow:clr+"33",
    btnPrimary:clr, btnText:"#ffffff",
    border:"rgba(0,0,0,0.08)", borderFaint:"rgba(0,0,0,0.04)",
    segBg:"rgba(0,0,0,0.06)", storyBg:"rgba(255,255,255,0.75)", storyBorder:"rgba(201,132,28,0.2)",
    errorBg:"rgba(255,59,48,0.08)", errorBorder:"rgba(255,59,48,0.2)", errorText:"#C0392B",
    gpsBg:"rgba(255,255,255,0.75)",
  };
  return (
    <div style={{ minHeight:"100vh", position:"relative", background:T.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif", color:T.text, overflowX:"hidden", transition:"background 0.3s, color 0.3s" }}>
      <AutoBackground progress={bgProgress.car}/>
      <BusBackground progress={bgProgress.bus}/>
      <BikeBackground progress={bgProgress.bike}/>
      <WalkBackground progress={bgProgress.walk}/>
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
        <div style={{ padding:"44px 0 8px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h1 style={{ margin:0, lineHeight:1 }}>
              <span style={{ fontSize:"1.9rem", fontWeight:700, color:T.text }}>Weg</span><em style={{ fontSize:"1.9rem", fontWeight:400, color:T.accent }}>geflüster</em>
            </h1>
            <p style={{ margin:"4px 0 0", fontSize:11, color:T.textMuted, letterSpacing:"1px" }}>Dein Reisebegleiter</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, position:"relative" }}>
            <div style={{ position:"relative" }}>
              <button onClick={() => setColorOpen(o => !o)} style={{ width:36, height:36, borderRadius:"50%", border: colorOpen ? "2px solid " + clr : "none", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <circle cx="12" cy="12" r="9.5" stroke={clr} strokeWidth="1.5" opacity="0.6"/>
                  <circle cx="8"  cy="10" r="2" fill="#C03030" opacity="0.85"/>
                  <circle cx="12" cy="7.5" r="2" fill="#E06820" opacity="0.85"/>
                  <circle cx="16" cy="10" r="2" fill="#3A8C4A" opacity="0.85"/>
                  <circle cx="15.2" cy="14.5" r="2" fill="#2858C0" opacity="0.85"/>
                  <circle cx="8.8" cy="14.5" r="2" fill="#C9841C" opacity="0.85"/>
                </svg>
              </button>
              {colorOpen && (
                <div style={{ position:"absolute", top:44, right:0, zIndex:200, background: isDark ? "rgba(30,26,22,0.97)" : "rgba(250,247,242,0.97)", backdropFilter:"blur(24px)", borderRadius:18, padding:"14px", boxShadow:"0 12px 40px rgba(0,0,0,0.22)", minWidth:176 }}>
                  <p style={{ margin:"0 0 10px", fontSize:10, fontWeight:600, color:"#9A8060", letterSpacing:"1px", textTransform:"uppercase" }}>Akzentfarbe</p>
                  {[
                    {key:"gold",   dot:"#C9841C", label:"Gold"},
                    {key:"silver", dot:"#888880", label:"Silber"},
                    {key:"green",  dot:"#3A8C4A", label:"Grün"},
                    {key:"red",    dot:"#C03030", label:"Rot"},
                    {key:"orange", dot:"#E06820", label:"Orange"},
                    {key:"blue",   dot:"#2858C0", label:"Blau"},
                  ].map(({key, dot, label}) => (
                    <button key={key} onClick={() => { setActiveColor(key); setColorOpen(false); localStorage.setItem("wg_color", key); }} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"7px 8px", borderRadius:10, border:"none", cursor:"pointer", background: activeColor===key ? dot+"22" : "transparent", marginBottom:2 }}>
                      <span style={{ width:18, height:18, borderRadius:"50%", background:dot, display:"inline-block", flexShrink:0, boxShadow: activeColor===key ? "0 0 0 2px " + (isDark?"#2A2420":"#fff") + ",0 0 0 3.5px " + dot : "none" }}/>
                      <span style={{ fontSize:13, color: activeColor===key ? (isDark?"#F0EAE0":"#2C2014") : "#9A8060", fontWeight: activeColor===key ? 600 : 400 }}>{label}</span>
                      {activeColor===key && (
                        <svg style={{ marginLeft:"auto" }} viewBox="0 0 16 16" width="14" height="14" fill="none">
                          <path d="M3 8l3.5 3.5L13 4.5" stroke={dot} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          <button onClick={() => { setIsDark(d => { localStorage.setItem("wg_dark", !d); return !d; }); }}
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
            <button onClick={() => setProfileOpen(true)} style={{ width:36, height:36, borderRadius:"50%", border:"none", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", overflow:"hidden" }}>
              {profilePhoto ? (
                <img src={profilePhoto} style={{ width:36, height:36, objectFit:"cover" }}/>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={T.textMuted} strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
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
          <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:"0.8px", textTransform:"uppercase", textAlign:"left" }}>Thema</p>
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
        <div style={{ marginBottom:16, position:"relative" }}>
          <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:"0.8px", textTransform:"uppercase", textAlign:"left" }}>Stimme</p>
          <button onClick={() => setVoiceDropOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:0 }}>
            <span style={{ fontSize:14, color:T.text, fontWeight:400 }}>
              {voiceEngine === "elevenlabs" ? "Helmut Stieglbauer" : voiceEngine === "edge" ? "Online-Stimme" : "Browser-Stimme"}
            </span>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke={T.textMuted} strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 4l4 4 4-4"/>
            </svg>
          </button>
          {voiceDropOpen && (
            <div style={{ position:"absolute", top:32, left:0, zIndex:200, background: isDark ? "rgba(30,26,22,0.97)" : "rgba(250,247,242,0.97)", backdropFilter:"blur(24px)", borderRadius:14, padding:"8px", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", minWidth:240 }}>
              {[
                { key:"elevenlabs", label:"Helmut Stieglbauer", sub:"ElevenLabs — beste Qualität" },
                { key:"edge",       label:"Online-Stimme",      sub:"Kostenlos — gute Qualität" },
                { key:"browser",    label:"Browser-Stimme",     sub:"Lokal — einfache Qualität" },
              ].map(({ key, label, sub }) => (
                <button key={key} onClick={() => { setVoiceEngine(key); setVoiceDropOpen(false); }}
                  style={{ display:"flex", flexDirection:"column", width:"100%", padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", background: voiceEngine===key ? T.accentDim : "transparent", marginBottom:2, textAlign:"left" }}>
                  <span style={{ fontSize:13, color: voiceEngine===key ? T.accent : T.text, fontWeight: voiceEngine===key ? 600 : 400 }}>{label}</span>
                  <span style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Playback Speed */}
        <div style={{ marginBottom:16 }}>
          <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:600, color:T.textMuted, letterSpacing:"0.8px", textTransform:"uppercase", textAlign:"left" }}>Geschwindigkeit</p>
          <div style={{ display:"flex", gap:6 }}>
            {[1, 1.25, 1.5, 1.75, 2].map(r => (
              <button key={r} onClick={() => { setPlaybackRate(r); localStorage.setItem("wg_rate", r); }}
                style={{ flex:1, padding:"6px 0", borderRadius:10, border:"none", cursor:"pointer", fontSize:12, fontWeight: playbackRate===r ? 700 : 400, background: playbackRate===r ? T.accentDim : T.bgCard, color: playbackRate===r ? T.accent : T.textMuted, transition:"all 0.2s" }}>
                {r}x
              </button>
            ))}
          </div>
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
                <div style={{ padding:"0" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.8px", textAlign:"left" }}>Mit Ziel fahren</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, padding:"10px 14px", background:T.bgInput, borderRadius:"12px 12px 4px 4px" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#34C759", flexShrink:0 }}/>
                    <span style={{ fontSize:13, color:T.text }}>{currentLoc || "Warte auf GPS..."}</span>
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
                    style={{ width:"100%", padding:13, background:gpsEndPlace?T.btnPrimary:T.accentDim, border:"none", borderRadius:12, color:gpsEndPlace?T.btnText:T.textMuted, fontSize:15, fontWeight:500, cursor:gpsEndPlace?"pointer":"default", transition:"all 0.2s" }}>
                    {gpsEndPlace ? "Mit Ziel fahren" : "Ziel eingeben"}
                  </button>
                </div>
                <div style={{ fontSize:".72rem", color:T.textMuted, textAlign:"center" }}>— oder —</div>
                <button onClick={() => { setGpsSubMode("free"); startGPS("free", null); }}
                  style={{ width:"100%", padding:15, background:"transparent", border:"1px solid " + T.border, borderRadius:14, color:T.text, fontSize:16, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
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

      {/* Profile Sheet Overlay */}
      {profileOpen && (
        <div onClick={() => setProfileOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:300, backdropFilter:"blur(4px)" }}/>
      )}

      {/* Profile Bottom Sheet */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform: profileOpen ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100%)",
        width:"100%", maxWidth:480, zIndex:301,
        background: isDark ? "#1C1917" : "#F5F0E8",
        borderRadius:"24px 24px 0 0",
        padding:"0 0 40px",
        transition:"transform 0.4s cubic-bezier(0.32,0.72,0,1)",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 8px" }}>
          <div style={{ width:36, height:4, borderRadius:2, background: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }}/>
        </div>

        {/* Profil Header */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"16px 24px 24px" }}>
          <label style={{ cursor:"pointer", position:"relative" }}>
            <div style={{ width:80, height:80, borderRadius:"50%", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", border:"3px solid " + clr }}>
              {profilePhoto ? (
                <img src={profilePhoto} style={{ width:80, height:80, objectFit:"cover" }}/>
              ) : (
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              )}
            </div>
            <div style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%", background:clr, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => {
              const f = e.target.files[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = ev => { setProfilePhoto(ev.target.result); localStorage.setItem("wg_photo", ev.target.result); };
              reader.readAsDataURL(f);
            }}/>
          </label>
          <p style={{ margin:"12px 0 2px", fontSize:16, fontWeight:600, color:T.text }}>Mein Profil</p>
          <p style={{ margin:0, fontSize:12, color:T.textMuted }}>Weggeflüster</p>
        </div>

        {/* Menu Items */}
        <div style={{ padding:"0 16px" }}>
          {[
            { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label:"Konto", sub:"Profil bearbeiten" },
            { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, label:"Abo verwalten", sub:"Free Plan" },
            { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label:"App-Einstellungen", sub:"Design, Sprache" },
            { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>, label:"Hilfe & Support", sub:"FAQ, Kontakt" },
          ].map(({ icon, label, sub }, i) => (
            <button key={i} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"14px 16px", borderRadius:14, border:"none", cursor:"pointer", background:"transparent", marginBottom:4, textAlign:"left" }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width:40, height:40, borderRadius:12, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", display:"flex", alignItems:"center", justifyContent:"center", color:clr, flexShrink:0 }}>
                {icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:500, color:T.text }}>{label}</div>
                <div style={{ fontSize:12, color:T.textMuted, marginTop:1 }}>{sub}</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}

          {/* Ausloggen */}
          <button style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"14px 16px", borderRadius:14, border:"none", cursor:"pointer", background:"transparent", marginTop:8, textAlign:"left" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,59,48,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(255,59,48,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FF3B30" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:500, color:"#FF3B30" }}>Ausloggen</div>
            </div>
          </button>
        </div>
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
            <button key={id} onClick={() => handleTransport(id)}
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