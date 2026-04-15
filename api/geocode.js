export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
      { headers: { 'User-Agent': 'Weggefluesterer/1.0 (private-app)' } }
    );
    const data = await r.json();
    const a = data.address;
    const name = a.city || a.town || a.village || a.hamlet || a.suburb || a.road || a.county || 'Unbekannter Ort';
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ name });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}