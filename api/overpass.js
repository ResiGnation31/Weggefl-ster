export const config = { runtime: 'edge' };

const cache = new Map();

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }});
  }
  try {
    const { query } = await req.json();
    const cacheKey = query.slice(0, 100);
    if (cache.has(cacheKey)) {
      return new Response(JSON.stringify(cache.get(cacheKey)), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!r.ok) throw new Error('Overpass error: ' + r.status);
      const data = await r.json();
      cache.set(cacheKey, data);
      if (cache.size > 50) cache.delete(cache.keys().next().value);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch(e) {
      clearTimeout(timeout);
      throw e;
    }
  } catch(e) {
    return new Response(JSON.stringify({ elements: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
