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
    const { placeName, category, speedKmh, transport, customPrompt } = await req.json();

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

    const prompt = customPrompt || `Du bist ein faszinierender Reisebegleiter. Der Nutzer ${mode} gerade durch "${placeName}".

Erzähle eine spannende, authentische Geschichte (ca. ${length}, ${storyStyle}) über diesen Ort zum Thema "${category}".

Regeln:
- Beginne SOFORT mit der Geschichte — keine Begrüßung, kein "Gerne"
- Sprich den Hörer direkt an
- Erzähle auf Deutsch, lebendige Erzählstimme
- Konkrete Details: Namen, Jahreszahlen, echte Fakten
- Ende mit einer überraschenden Wendung
- Nur fließender Text, keine Aufzählungen`;

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
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
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
