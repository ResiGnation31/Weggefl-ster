export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }});
  }
  try {
    const { text } = await req.json();
    // Aufteilen in Sätze max 190 Zeichen
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > 190) {
        if (current) chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current) chunks.push(current.trim());

    // Alle Chunks als Audio holen und zusammenführen
    const buffers = [];
    for (const chunk of chunks) {
      const url = "https://translate.google.com/translate_tts?ie=UTF-8&q=" + encodeURIComponent(chunk) + "&tl=de&client=tw-ob";
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
      if (r.ok) {
        buffers.push(await r.arrayBuffer());
      }
    }

    // Zusammenführen
    const total = buffers.reduce((a, b) => a + b.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const buf of buffers) {
      merged.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    return new Response(merged, { headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' }});
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
  }
}
