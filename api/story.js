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
    const { placeName, category, speedKmh, transport, voiceEngine, customPrompt } = await req.json();
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

    const prompt = customPrompt || `Du bist ein faszinierender Reisebegleiter. Der Nutzer ${mode} gerade durch "${placeName}".

Erzähle eine authentische Geschichte (ca. ${length}, ${storyStyle}) zum Thema "${category}".

WICHTIG - Nur echte Fakten über diese Region:
- Erzähle über die echte Geschichte, Natur oder Kultur dieser Gegend
- Nutze den Ortsnamen als Kontext, aber erfinde KEINE spezifischen Gebäude oder Ereignisse die du nicht kennst
- Wenn du nichts Spezifisches über den Ort weißt, erzähle über die Region (z.B. Niederrhein, NRW)
- Beziehe dich auf echte historische Ereignisse, Landschaft, Traditionen der Region

Format:
- Beginne SOFORT mit einer konkreten Szene, Jahreszahl oder sinnlichen Beschreibung
- Sprich den Hörer direkt an: "Schau mal...", "Wusstest du...", "Stell dir vor..."
- Nur fließender Text auf Deutsch
- KEINE Markdown, KEINE Überschriften, KEIN #, KEINE Listen`;

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
