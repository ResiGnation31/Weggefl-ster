export const config = { runtime: 'edge' };

const GERMAN_VOICE_ID = 'JiW03c2Gt43XNUQAumRP';
const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { placeName, category, speedKmh, transport, voiceEngine, surroundings, lat, lon, previousStories, customPrompt } = await req.json();
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    const useElevenLabs = !voiceEngine || voiceEngine === "elevenlabs";

    if (!anthropicKey) return new Response(JSON.stringify({ error: 'No API key' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });

    // 1. RAUMTYP (zuerst!)
    const kmh = speedKmh || 0;
    let raumtyp = "ort";
    if (kmh > 80) raumtyp = "autobahn";
    else if (kmh > 50) raumtyp = "landstrasse";
    else if (kmh > 15) raumtyp = "ortsdurchfahrt";
    else if (transport === "walk") raumtyp = "spaziergang";
    else if (transport === "bike" && kmh < 8) raumtyp = "joggen";
    else if (kmh < 15 && kmh > 0) raumtyp = "ortseinfahrt";

    // 2. Ortsname bereinigen
    const parts = placeName.split(",").map(s => s.trim());
    const streetWords = ["weg", "strasse", "str.", "gasse", "platz", "allee", "ring", "pfad", "damm"];
    const isStreet = streetWords.some(w => parts[0].toLowerCase().includes(w));
    const searchTerm = isStreet && parts[1] ? parts[1] : parts[0];
    const cityHint = isStreet && parts[2] ? parts[2] : (!isStreet && parts[1] ? parts[1] : "");

    // 3. Textlaenge
    const maxLen = transport === "walk" ? 5000 : transport === "bike" ? 4000 : 2000;

    // 4. Wikipedia
    const fetchWiki = async (title) => {
      try {
        const r = await fetch("https://de.wikipedia.org/w/api.php?action=query&titles=" + encodeURIComponent(title) + "&prop=extracts&explaintext=true&format=json&origin=*", { headers: { "User-Agent": "Weggefluesterer/1.0" } });
        if (!r.ok) return "";
        const d = await r.json();
        const page = Object.values(d.query?.pages || {})[0];
        if (!page || page.missing || !page.extract) return "";
        if (["steht fuer:", "ist der Name", "bezeichnet:"].some(b => page.extract.includes(b))) return "";
        return page.extract;
      } catch { return ""; }
    };

    const wikiSearch = async (query, limit = 3) => {
      try {
        const r = await fetch("https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(query) + "&srlimit=" + limit + "&format=json&origin=*", { headers: { "User-Agent": "Weggefluesterer/1.0" } });
        if (!r.ok) return [];
        const d = await r.json();
        return (d.query?.search || []).map(s => s.title);
      } catch { return []; }
    };

    // 5. Infos sammeln
    const infoTexts = [];
    const usedTitles = new Set();
    const addWiki = async (title) => {
      if (!title || usedTitles.has(title)) return;
      usedTitles.add(title);
      const t = await fetchWiki(title);
      if (t) infoTexts.push("=== " + title + " ===\n" + t.slice(0, Math.floor(maxLen / 4)));
    };

    if (raumtyp === "autobahn" || raumtyp === "landstrasse") {
      const titles = await wikiSearch((cityHint || searchTerm) + " Landschaft Geschichte Natur", 4);
      for (const t of titles.slice(0, 3)) await addWiki(t);
    } else {
      if (cityHint) await addWiki(searchTerm + " (" + cityHint + ")");
      const titles = await wikiSearch(cityHint ? searchTerm + " " + cityHint : searchTerm, 4);
      for (const t of titles.slice(0, 3)) await addWiki(t);
    }

    if (lat && lon) {
      try {
        const radius = (raumtyp === "autobahn" || raumtyp === "landstrasse") ? 5000 : 2000;
        const r = await fetch("https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=" + lat + "|" + lon + "&gsradius=" + radius + "&gslimit=5&format=json&origin=*", { headers: { "User-Agent": "Weggefluesterer/1.0" } });
        if (r.ok) {
          const d = await r.json();
          for (const item of (d.query?.geosearch || []).slice(0, 3)) await addWiki(item.title);
        }
      } catch {}
    }

    if (braveKey) {
      try {
        const q = (raumtyp === "landstrasse" || raumtyp === "autobahn")
          ? (cityHint || searchTerm) + " Landschaft Geschichte Sehenswuerdigkeiten"
          : searchTerm + " " + (cityHint || "") + " Geschichte Sehenswuerdigkeiten";
        const r = await fetch("https://api.search.brave.com/res/v1/web/search?q=" + encodeURIComponent(q.trim()) + "&count=4&search_lang=de&country=de&text_decorations=false", { headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": braveKey } });
        if (r.ok) {
          const d = await r.json();
          for (const result of (d.web?.results || []).slice(0, 3)) {
            if (result.description && result.description.length > 80) infoTexts.push("=== " + result.title + " ===\n" + result.description);
          }
        }
      } catch {}
    }

    const wikiContext = infoTexts.join("\n\n").slice(0, maxLen);

    // 6. Templates
    const templates = {
      autobahn:       { laenge: "100-130 Woerter", anweisung: "Erzaehle ueber die REGION — grosse Zusammenhaenge, Wirtschaft, Landschaft, Geschichte. NICHT ueber einzelne Strassen oder Haeuser." },
      landstrasse:    { laenge: "80-110 Woerter",  anweisung: "Beschreibe die Landschaft und was man sieht — Felder, Waelder, Doerfer, regionale Besonderheiten, historische Ereignisse entlang der Strecke." },
      ortseinfahrt:   { laenge: "50-80 Woerter",   anweisung: "Kurzes Ortsprofil: 1. Willkommen + Name, 2. Groesse/Typ, 3. Wofuer bekannt, 4. Ausblick." },
      ortsdurchfahrt: { laenge: "60-90 Woerter",   anweisung: "Was ist JETZT sichtbar? Ortskern, Kirche, Geschichte, Alltagskultur. Vom Allgemeinen zum Detail." },
      spaziergang:    { laenge: "40-100 Woerter",  anweisung: "Details und Beobachtungen — Gebaeude, Plaetze, kleine Geschichten. Persoenlich ansprechen." },
      joggen:         { laenge: "20-40 Woerter",   anweisung: "NUR 1-2 Saetze! Kurzer Fakt oder Naturbeobachtung." },
      ort:            { laenge: "60-90 Woerter",   anweisung: "Geschichte, Sehenswuerdigkeiten, Einwohnerzahl, Besonderheiten des Ortes." },
    };
    const t = templates[raumtyp] || templates.ort;

    const themaFokus = {
      "Geschichte": "historische Entwicklung, Ereignisse, wichtige Personen",
      "Natur": "Landschaft, Flora, Fauna, Naturraeume",
      "Persoenlichkeiten": "bekannte Personen die hier wirkten",
      "Mythen": "Sagen, Legenden, lokale Ueberlieferungen",
      "Kulinarik": "regionale Produkte, Spezialitaeten, Landwirtschaft",
      "Architektur": "Gebaeude, Baustile, Kirchen, historische Bauwerke",
      "Reisefuehrer": "Gesamtbild: Geschichte, Sehenswuerdigkeiten, Alltagskultur",
    };

    const modeLabel = { car: "Auto faehrst", bus: "Bus faehrst", bike: "Fahrrad faehrst", walk: "zu Fuss gehst" }[transport] || "faehrst";
    const prevContext = previousStories ? "BEREITS ERZAEHLT (nicht wiederholen):\n" + previousStories + "\n\n" : "";

    const prompt = customPrompt || "Du bist ein sachlicher Reisebegleiter. Der Nutzer " + modeLabel + " gerade durch \"" + placeName + "\"." +
      "\n\n" + prevContext +
      "VERFUEGBARE INFORMATIONEN — NUR DIESE VERWENDEN, NIEMALS ERFINDEN:\n" + (wikiContext || "Keine spezifischen Daten — beschreibe die Landschaft allgemein.") +
      "\n\nUMGEBUNG: " + (surroundings || "nicht bekannt") +
      "\nTHEMA: " + category + " — " + (themaFokus[category] || "allgemeine Informationen") +
      "\n\nAUFGABE (" + raumtyp.toUpperCase() + "): " + t.anweisung +
      "\nLAENGE: " + t.laenge +
      "\n\nREGELN: Nur Fakten aus den Informationen oben. Niemals erfinden. Fliessendes Deutsch. KEIN #. Direkt beginnen.";

    // 7. Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) return new Response(JSON.stringify({ error: claudeData.error?.message || "Claude error" }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });

    const rawText = claudeData.content[0].text;
    const text = rawText.replace(/^#{1,6}\s*.+$/gm, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/^\s*\n/gm, "").trim();

    // 8. ElevenLabs
    if (elevenKey && useElevenLabs) {
      try {
        const elevenRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + GERMAN_VOICE_ID, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": elevenKey },
          body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
        });
        if (elevenRes.ok) {
          const audioBuffer = await elevenRes.arrayBuffer();
          const bytes = new Uint8Array(audioBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return new Response(JSON.stringify({ text, audio: btoa(binary), audioType: "mp3" }), { headers: { "Content-Type": "application/json", ...CORS } });
        }
      } catch (e) { console.error("ElevenLabs error:", e); }
    }

    return new Response(JSON.stringify({ text }), { headers: { "Content-Type": "application/json", ...CORS } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }
}