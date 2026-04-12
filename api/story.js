export const config = { runtime: 'edge' };

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
    const { placeName, category, speedKmh } = await req.json();

    const isWalking = speedKmh < 10;
    const isCycling = speedKmh >= 10 && speedKmh < 25;
    const length = isWalking ? '300 Wörter' : isCycling ? '220 Wörter' : '180 Wörter';
    const mode = isWalking ? 'zu Fuß gehst' : isCycling ? 'Fahrrad fährst' : 'Auto fährst';

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const prompt = `Du bist ein faszinierender Reisebegleiter. Der Nutzer ${mode} gerade durch "${placeName}".

Erzähle eine spannende, authentische Geschichte (ca. ${length}) über diesen Ort zum Thema "${category}".

Regeln:
- Beginne SOFORT mit der Geschichte — keine Begrüßung, kein "Gerne"
- Sprich den Hörer direkt an: "Du fährst gerade...", "Rechts siehst du...", "Gleich passierst du..."
- Erzähle auf Deutsch, lebendige Erzählstimme
- Konkrete Details: Namen, Jahreszahlen, echte Fakten
- Ende mit einer überraschenden oder nachdenklichen Wendung
- Nur fließender Text, keine Aufzählungen`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'API error', status: response.status }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ text: data.content[0].text }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
