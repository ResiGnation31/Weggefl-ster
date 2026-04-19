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

    const street = a.road || null;
    const houseNum = a.house_number || "";
    const district = a.city_district || a.suburb || a.village || a.hamlet || null;
    const city = a.town || a.city || null;
    const region = a.county || a.state_district || null;
    const displayName = data.display_name || "";

    // "Geldern-Walbeck" oder nur "Geldern"
    const ortName = city && district && city !== district ? city + "-" + district : city || district || a.county || "";

    let name = "";
    if (street && houseNum && ortName) {
      name = street + " " + houseNum + ", " + ortName;
    } else if (street && ortName) {
      name = street + ", " + ortName;
    } else if (ortName) {
      name = ortName;
    } else if (street) {
      name = street;
    } else {
      name = "Unbekannter Ort";
    }

    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({
      name,
      street: street || "",
      place: ortName || "",
      district: district || "",
      city: city || "",
      region: region || "",
      displayName
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
