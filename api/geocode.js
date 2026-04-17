export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de&zoom=16`,
      { headers: { 'User-Agent': 'Weggefluesterer/1.0 (private-app)' } }
    );
    const data = await r.json();
    const a = data.address;
    
    // Straße ohne Hausnummer
    const street = a.road || null;
    // Ort (Dorf/Stadt)
    const place = a.village || a.hamlet || a.suburb || a.town || a.city || a.county || null;
    // Region
    const region = a.county || a.state_district || null;
    // Landnutzung aus display_name
    const displayName = data.display_name || "";
    
    // Kombination: Straße + Ort
    let name = "";
    if (street && place) {
      name = street + ", " + place;
    } else if (place) {
      name = place;
    } else if (street) {
      name = street;
    } else {
      name = "Unbekannter Ort";
    }
    
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ 
      name,
      street: street || "",
      place: place || "",
      region: region || "",
      displayName
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
