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
    const { placeName, category, speedKmh, transport, voiceEngine, surroundings, customPrompt } = await req.json();
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

    // Wikipedia-Kontext holen - vollstaendig
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
        // Begriffsklärung erkennen
        if (page.extract.includes("steht für:") || page.extract.includes("ist der Name") || page.extract.includes("bezeichnet:")) return "";
        return page.extract;
      };
      
      let wikiText = "";
      
      // 1. Spezifischer Artikel mit Stadt: "Walbeck (Geldern)"
      if (cityHint) {
        wikiText = await fetchWiki("de", searchTerm + " (" + cityHint + ")");
      }
      
      // 2. Nur Ortsname
      if (!wikiText) wikiText = await fetchWiki("de", searchTerm);
      
      // 3. Suche verwenden wenn direkt nicht gefunden
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
      
      // 4. Englischer Fallback
      if (!wikiText) wikiText = await fetchWiki("en", searchTerm);
      
      if (wikiText) {
        // Je nach Transportmittel mehr oder weniger Text
        const maxLen = transport === "walk" ? 5000 : transport === "bike" ? 4000 : transport === "bus" ? 3000 : 2000;
        wikiContext = "\n\nWikipedia-Informationen ueber " + searchTerm + ":\n" + wikiText.slice(0, maxLen);
      }
    } catch(e) {}

    const prompt = customPrompt || `Du bist ein faszinierender Reisebegleiter. Der Nutzer ${mode} gerade durch "${placeName}".
${wikiContext}

AKTUELLER KONTEXT: ${surroundings ? "Umgebung: " + surroundings : ""}

AUFGABE: Basierend auf den Wikipedia-Informationen und dem aktuellen Kontext, erzähle was der Fahrer/Fußgänger gerade sieht und was historisch oder kulturell relevant ist.

Thema: ${category}
Länge: ca. ${length}, Stil: ${storyStyle}

REGELN:
- Verwende NUR Fakten aus den Wikipedia-Informationen oben
- Beschreibe was man von der Straße/dem Weg aus SEHEN kann
- Erwähne konkrete Sehenswürdigkeiten, Gebäude, Landschaften die wirklich dort sind
- Wenn Wikipedia Sehenswürdigkeiten erwähnt, beschreibe diese lebendig
- Sprich den Hörer direkt an: "Schau mal links...", "Siehst du...?", "Gleich wirst du..."
- Beginne SOFORT mit einer konkreten Beobachtung oder Jahreszahl
- Nur fließender Text auf Deutsch, KEINE Überschriften, KEIN #`;

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

    const text = claudeData.content[0].text;

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
