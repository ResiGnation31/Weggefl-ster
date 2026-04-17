export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }});
  }
  try {
    const { text } = await req.json();
    const url = "https://translate.google.com/translate_tts?ie=UTF-8&q=" + encodeURIComponent(text.slice(0,200)) + "&tl=de&client=tw-ob";
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    if (!r.ok) throw new Error("TTS failed");
    const audio = await r.arrayBuffer();
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' }});
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
  }
}
