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
      const parts = placeName.split(",").map(s => s.trim());
      const searchTerm = parts[0];
      const cityHint = parts[1] || "";
      
      // Hilfsfunktion: Wikipedia-Artikel holen
      const fetchWiki = async (lang, title) => {
        const r = await fetch(
          `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=false&explaintext=true&format=json&origin=*`,
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
      
      // 1. Direkter Artikel für den Ort (höchste Priorität)
      if (searchTerm) {
        // Versuche spezifischen Artikel: "Walbeck (Geldern)"
        if (cityHint) {
          const specific = await fetchWiki("de", searchTerm + " (" + cityHint + ")");
          if (specific) wikiText = "=== " + searchTerm + " ===\n" + specific.slice(0, maxLen);
        }
        // Direkter Artikel ohne Klammer
        if (!wikiText) {
          const direct = await fetchWiki("de", searchTerm);
          if (direct) wikiText = "=== " + searchTerm + " ===\n" + direct.slice(0, maxLen);
        }
      }

      // 2. Koordinaten-basierte Suche für nahegelegene POIs
      if (lat && lon) {
        const geoRes = await fetch(
          `https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=5000&gslimit=8&format=json&origin=*`,
          { headers: { "User-Agent": "Weggefluesterer/1.0" } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const results = geoData.query?.geosearch || [];
          const texts = [];
          for (const result of results.slice(0, 4)) {
            if (wikiText && wikiText.includes(result.title)) continue;
            const t = await fetchWiki("de", result.title);
            if (t) texts.push("=== " + result.title + " ===\n" + t.slice(0, Math.floor(maxLen/4)));
          }
          if (texts.length > 0) {
            wikiText = (wikiText ? wikiText + "\n\n" : "") + texts.join("\n\n");
          }
        }
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

    const prompt = customPrompt || `Du bist ein kluger, sachlicher Reisebegleiter für die gesamte Fahrt. Der Nutzer ${mode} gerade durch "${placeName}".

${prevContext}WIKIPEDIA-INFORMATIONEN ZUM AKTUELLEN BEREICH:
${wikiContext || "Keine Wikipedia-Daten — erzähle über die Region allgemein."}

AKTUELLE UMGEBUNG: ${surroundings || "nicht bekannt"}

RAUMTYP: ${raumtyp.toUpperCase()}
THEMA: ${category} — Fokus: ${themaFokus[category] || "allgemeine Informationen"}
LÄNGE: ${t.laenge}
STIL: ${t.stil}
INHALT: ${t.fokus}
EINSTIEG: ${t.einstieg}

REGELN:
- Nur Fakten aus Wikipedia oben verwenden
- Wenn keine Straßeninfos: über Ort oder Region erzählen
- Wenn gar nichts: Raum beschreiben was Bebauung/Landschaft zeigt
- NIEMALS erfinden
- Natürlicher Übergang zur vorherigen Story wenn möglich
- Fließender Text auf Deutsch, KEINE Überschriften, KEIN #, KEINE Markdown
- Beginne DIREKT mit dem ersten Satz — kein Titel, keine Einleitung, kein Label`;

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
        max_tokens: 600,
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
