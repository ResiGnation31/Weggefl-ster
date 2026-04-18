export const config = { runtime: 'edge' };

// Best German voice on ElevenLabs
const GERMAN_VOICE_ID = 'JiW03c2Gt43XNUQAumRP'; // "Adam" - works well for German

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { placeName, category, speedKmh, transport, voiceEngine, surroundings, lat, lon, previousStories, customPrompt } = await req.json();
    const useElevenLabs = !voiceEngine || voiceEngine === "elevenlabs";

    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    const elevenKey = process.env.ELEVENLABS_API_KEY;

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const modeMap = {
      car:  { label: 'Auto fährst',         length: '150 Wörter', style: 'kurz und prägnant' },
      bus:  { label: 'Bus oder Bahn fährst', length: '200 Wörter', style: 'entspannt und informativ' },
      bike: { label: 'Fahrrad fährst',       length: '250 Wörter', style: 'lebendig und detailliert' },
      walk: { label: 'zu Fuß gehst',         length: '350 Wörter', style: 'tief und atmosphärisch' },
    };
    const m = modeMap[transport] || modeMap.car;
    const length = m.length;
    const mode = m.label;
    const storyStyle = m.style;

    // Wikipedia-Kontext holen - koordinatenbasiert
    let wikiContext = "";
    try {
      // Straßennamen herausfiltern - nur Ort für Wikipedia
      const parts = placeName.split(",").map(s => s.trim());
      // Wenn erstes Element eine Straße ist (enthält "weg", "str", "gasse", "platz", "allee" etc.)
      const streetWords = ["weg", "straße", "str.", "gasse", "platz", "allee", "ring", "pfad", "damm", "chaussee", "ufer"];
      const isStreet = streetWords.some(w => parts[0].toLowerCase().includes(w));
      const searchTerm = isStreet && parts[1] ? parts[1] : parts[0];
      const cityHint = isStreet && parts[2] ? parts[2] : (isStreet ? "" : parts[1] || "");
      
      // Hilfsfunktion: Wikipedia-Artikel holen
      const fetchWiki = async (lang, title) => {
        const r = await fetch(
          `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&format=json&origin=*`,
          { headers: { "User-Agent": "Weggefluesterer/1.0" } }
        );
        if (!r.ok) return "";
        const d = await r.json();
        const page = Object.values(d.query?.pages || {})[0];
        if (!page || page.missing || !page.extract) return "";
        if (page.extract.includes("steht fuer:") || page.extract.includes("ist der Name") || page.extract.includes("bezeichnet:")) return "";
        return page.extract;
      };
      
      let wikiText = "";
      const maxLen = transport === "walk" ? 5000 : transport === "bike" ? 4000 : transport === "bus" ? 3000 : 2000;
      
      // Kombinierte Wikipedia-Suche
      const wikiTexts = [];
      const usedTitles = new Set();

      const addWiki = async (title) => {
        if (usedTitles.has(title)) return;
        usedTitles.add(title);
        const t = await fetchWiki("de", title);
        if (t) wikiTexts.push("=== " + title + " ===\n" + t.slice(0, Math.floor(maxLen/3)));
      };

      // Suche 1: Textsuche nach Ortsname
      if (searchTerm) {
        const q = cityHint ? searchTerm + " " + cityHint : searchTerm;
        const sr = await fetch(
          "https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(q) + "&srlimit=4&format=json&origin=*",
          { headers: { "User-Agent": "Weggefluesterer/1.0" } }
        );
        if (sr.ok) {
          const sd = await sr.json();
          for (const r of (sd.query?.search || []).slice(0, 3)) {
            await addWiki(r.title);
          }
        }
      }

      // Suche 2: Koordinaten-basiert
      if (lat && lon) {
        const geoRes = await fetch(
          "https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=" + lat + "|" + lon + "&gsradius=3000&gslimit=5&format=json&origin=*",
          { headers: { "User-Agent": "Weggefluesterer/1.0" } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          for (const r of (geoData.query?.geosearch || []).slice(0, 3)) {
            await addWiki(r.title);
          }
        }
      }

      // Brave Search für lokale Quellen
      if (braveKey && searchTerm) {
        try {
          const searchQuery = encodeURIComponent(searchTerm + " Geschichte Sehenswürdigkeiten Niederrhein");
          const braveRes = await fetch(
            "https://api.search.brave.com/res/v1/web/search?q=" + searchQuery + "&count=3&search_lang=de&country=de&text_decorations=false",
            { headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": braveKey } }
          );
          if (braveRes.ok) {
            const braveData = await braveRes.json();
            const results = braveData.web?.results || [];
            for (const r of results.slice(0, 3)) {
              if (r.description && r.description.length > 50) {
                wikiTexts.push("=== " + r.title + " ===\n" + r.description);
              }
            }
          }
        } catch(e) {}
      }

      // Brave Search für lokale Quellen
      if (braveKey && searchTerm) {
        try {
          const searchQuery = encodeURIComponent(searchTerm + " Geschichte Sehenswürdigkeiten Niederrhein");
          const braveRes = await fetch(
            "https://api.search.brave.com/res/v1/web/search?q=" + searchQuery + "&count=3&search_lang=de&country=de&text_decorations=false",
            { headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": braveKey } }
          );
          if (braveRes.ok) {
            const braveData = await braveRes.json();
            const results = braveData.web?.results || [];
            for (const r of results.slice(0, 3)) {
              if (r.description && r.description.length > 50) {
                wikiTexts.push("=== " + r.title + " ===\n" + r.description);
              }
            }
          }
        } catch(e) {}
      }

      if (wikiTexts.length > 0) {
        wikiText = wikiTexts.join("\n\n").slice(0, maxLen);
      }
      
      // 2. Fallback: Name-basierte Suche
      if (!wikiText) {
        if (cityHint) wikiText = await fetchWiki("de", searchTerm + " (" + cityHint + ")");
        if (!wikiText) wikiText = await fetchWiki("de", searchTerm);
        if (!wikiText) {
          const searchQ = cityHint ? searchTerm + " " + cityHint : searchTerm;
          const sr = await fetch(
            `https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQ)}&srlimit=1&format=json&origin=*`,
            { headers: { "User-Agent": "Weggefluesterer/1.0" } }
          );
          if (sr.ok) {
            const sd = await sr.json();
            const firstResult = sd.query?.search?.[0]?.title;
            if (firstResult) wikiText = await fetchWiki("de", firstResult);
          }
        }
        if (!wikiText) wikiText = await fetchWiki("en", searchTerm);
      }
      
      if (wikiText) {
        // Je nach Transportmittel mehr oder weniger Text
        const maxLen = transport === "walk" ? 5000 : transport === "bike" ? 4000 : transport === "bus" ? 3000 : 2000;
        wikiContext = "\n\nWikipedia-Informationen ueber " + searchTerm + ":\n" + wikiText.slice(0, maxLen);
      }
    } catch(e) {}

    // Raumtyp aus Geschwindigkeit ableiten
    const kmh = speedKmh || 0;
    let raumtyp = "ort";
    if (kmh > 80) raumtyp = "autobahn";
    else if (kmh > 50) raumtyp = "landstrasse";
    else if (kmh > 15) raumtyp = "ortsdurchfahrt";
    else if (transport === "walk") raumtyp = "spaziergang";
    else if (transport === "bike" && kmh < 8) raumtyp = "joggen";
    else if (kmh < 15 && kmh > 0) raumtyp = "ortseinfahrt";

    const templates = {
      autobahn: {
        laenge: "ca. 100-130 Wörter",
        stil: "ruhig, weit, erklärend",
        fokus: "REGION: große Zusammenhänge, Wirtschaft, Landschaft, historische Achsen. NICHT einzelne Straßen.",
        einstieg: "Sie bewegen sich gerade durch... / Die Region hier ist geprägt von...",
      },
      landstrasse: {
        laenge: "ca. 80-110 Wörter",
        stil: "anschaulich, bodenständig, atmosphärisch",
        fokus: "Landschaft, Landwirtschaft, Dörfer, regionale Identität, Naturräume",
        einstieg: "Typisch für diese Gegend ist... / Die Landschaft hier zeigt...",
      },
      ortseinfahrt: {
        laenge: "ca. 50-80 Wörter",
        stil: "kompakt, orientierend",
        fokus: "Willkommen + Name + Größe + wofür bekannt + Ausblick",
        einstieg: "Willkommen in... / Sie erreichen jetzt...",
      },
      ortsdurchfahrt: {
        laenge: "ca. 60-90 Wörter",
        stil: "konkret, ortsnah",
        fokus: "Was sichtbar ist: Ortskern, Kirchen, Rathaus, Geschichte, Alltagskultur",
        einstieg: "Sie fahren jetzt durch... / Der Bereich hier...",
      },
      spaziergang: {
        laenge: "ca. 40-100 Wörter",
        stil: "beobachtend, ruhig, dialogisch",
        fokus: "Details: Gebäude, Plätze, Inschriften, kleine Geschichten",
        einstieg: "Achten Sie auf... / Wenn Sie genau schauen...",
      },
      joggen: {
        laenge: "ca. 20-45 Wörter",
        stil: "klar, rhythmisch, kurz",
        fokus: "Kurze Impulse: Natur, Weggeschichte, kleine Fakten",
        einstieg: "Kurzer Fakt für unterwegs:",
      },
      ort: {
        laenge: "ca. 60-90 Wörter",
        stil: "informativ, zugänglich",
        fokus: "Geschichte, Sehenswürdigkeiten, Einwohnerzahl, Wirtschaft, Besonderheiten",
        einstieg: "Der Ort ist bekannt für... / Besonders charakteristisch ist...",
      },
    };

    const t = templates[raumtyp] || templates.ort;

    const themaFokus = {
      "Geschichte": "historische Entwicklung, erste Erwähnung, prägende Ereignisse, wichtige Personen",
      "Natur": "Landschaft, Naturräume, Flora, Fauna, Schutzgebiete",
      "Persönlichkeiten": "bekannte Personen die hier geboren wurden oder wirkten",
      "Mythen": "Sagen, Legenden, lokale Überlieferungen, Bräuche",
      "Kulinarik": "regionale Produkte, Spezialitäten, Landwirtschaft, typische Gerichte",
      "Architektur": "Gebäude, Baustile, Kirchen, Rathäuser, charakteristische Häuser",
      "Reiseführer": "Gesamtbild: Identität, Geschichte, Sehenswürdigkeiten, Alltagskultur — je nach Raumtyp angepasst",
    };

    const prevContext = previousStories ? "BEREITS ERZÄHLT (nicht wiederholen, aber natürlich anknüpfen):\n" + previousStories + "\n\n" : "";

    const raumAnweisung = {
      autobahn: "SITUATION AUTOBAHN: Erzähle über die REGION in großen Zusammenhängen — Wirtschaft, Landschaft, Geschichte der Gegend. NICHT über einzelne Straßen. Beginne mit: 'Sie bewegen sich durch...' oder 'Die Region hier...'",
      landstrasse: "SITUATION LANDSTRASSE: Beschreibe Landschaft und regionale Identität — Landwirtschaft, Dörfer, Natur, typische Strukturen. Beginne mit: 'Typisch für diese Gegend...' oder 'Die Landschaft hier...'",
      ortseinfahrt: "SITUATION ORTSEINFAHRT: Kurzes Ortsprofil in dieser Reihenfolge: 1. Willkommen + Ortsname, 2. Größe und Typ, 3. Wofür bekannt, 4. kurzer Ausblick. Beginne mit: 'Willkommen in...' oder 'Sie erreichen jetzt...'",
      ortsdurchfahrt: "SITUATION ORTSDURCHFAHRT: Was ist JETZT sichtbar und relevant? Ortskern, Sehenswürdigkeiten, Geschichte, Alltagskultur. Vom Allgemeinen zum Detail. Beginne mit: 'Sie fahren jetzt durch...' oder 'Der Bereich hier...'",
      spaziergang: "SITUATION SPAZIERGANG: Detaillierte Beobachtungen — Gebäude, Plätze, kleine Geschichten, Alltagsgeschichte. Persönlich und dialogisch. Beginne mit: 'Achten Sie auf...' oder 'Wenn Sie schauen...'",
      joggen: "SITUATION JOGGEN: NUR 1-2 kurze Sätze! Leicht verständlich, kein langer Vortrag. Beginne mit: 'Kurzer Fakt:'",
      ort: "SITUATION ORT: Informativ über Ort und Besonderheiten — Geschichte, Sehenswürdigkeiten, Einwohnerzahl, Wirtschaft. Beginne mit: 'Der Ort ist bekannt für...' oder 'Hier in...'"
    }[raumtyp] || "";

    const prompt = customPrompt || `Du bist ein Reisebegleiter. Der Nutzer ${mode} gerade durch "${placeName}".

${prevContext}VERFÜGBARE INFORMATIONEN (NUR DIESE VERWENDEN, NIEMALS ERFINDEN):
${wikiContext || "Keine spezifischen Daten verfügbar — beschreibe die Landschaft oder Region allgemein."}

UMGEBUNG: ${surroundings || "nicht bekannt"}
THEMA: ${category} — ${themaFokus[category] || "allgemeine Informationen"}

${raumAnweisung}

LÄNGE: ${t.laenge}
STIL: ${t.stil}

PFLICHTREGELN:
- Nur Fakten aus den Informationen oben verwenden
- Niemals Gebäude, Ereignisse oder Details erfinden
- Fließender Text auf Deutsch, KEIN #, KEINE Listen, KEINE Überschriften
- Beginne DIREKT mit dem ersten Satz`;

    // Generate text with Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();

    if (!claudeRes.ok) {
      return new Response(JSON.stringify({ error: claudeData.error?.message || 'Claude error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const rawText = claudeData.content[0].text;
    const text = rawText.replace(/^#{1,6}\s*.+$/gm, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/^\s*\n/gm, "").trim();

    // If ElevenLabs key available and selected, generate audio
    if (elevenKey && useElevenLabs) {
      try {
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${GERMAN_VOICE_ID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        });

        if (elevenRes.ok) {
          const audioBuffer = await elevenRes.arrayBuffer();
          const bytes = new Uint8Array(audioBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const base64Audio = btoa(binary);
          return new Response(JSON.stringify({ text, audio: base64Audio, audioType: 'mp3' }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } catch (e) {
        // Fall through to text-only response
        console.error('ElevenLabs error:', e);
      }
    }

    // Return text only (browser TTS fallback)
    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
