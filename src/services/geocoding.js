/**
 * src/services/geocoding.js
 *
 * Location Search & Geocoding Service for One Journey Transit.
 * Provides instant offline matching against transit stops & curated landmarks,
 * combined with live OpenStreetMap/Photon geocoding for any street, POI, or colony.
 */

// Bounding box for Ahmedabad & Gandhinagar Metropolitan Area
export const REGION_BBOX = {
  minLon: 72.35,
  minLat: 22.85,
  maxLon: 72.85,
  maxLat: 23.35,
};

// Curated popular offline landmarks across Ahmedabad & Gandhinagar
export const CURATED_LANDMARKS = [
  { name: 'GIFT City', fullName: 'GIFT City, Gandhinagar, Gujarat', lat: 23.1630, lon: 72.6844, category: 'landmark' },
  { name: 'Gandhinagar Sector 21', fullName: 'Sector 21, Gandhinagar, Gujarat', lat: 23.2247, lon: 72.6478, category: 'area' },
  { name: 'CG Road', fullName: 'Chimanlal Girdharlal Rd, Navrangpura, Ahmedabad', lat: 23.0300, lon: 72.5580, category: 'area' },
  { name: 'Kalupur Railway Station', fullName: 'Ahmedabad Junction (Kalupur), Railway Station Rd', lat: 23.02796, lon: 72.59982, category: 'transit_hub' },
  { name: 'Ahmedabad Airport (SVPI)', fullName: 'Sardar Vallabhbhai Patel International Airport, Hansol', lat: 23.0729, lon: 72.6347, category: 'transit_hub' },
  { name: 'Infocity Gandhinagar', fullName: 'Infocity, Near Indroda Circle, Gandhinagar', lat: 23.1902, lon: 72.6350, category: 'landmark' },
  { name: 'Vastrapur Lake', fullName: 'Vastrapur Lake, Vastrapur, Ahmedabad', lat: 23.0375, lon: 72.5278, category: 'landmark' },
  { name: 'Prahlad Nagar', fullName: 'Prahlad Nagar, Anandnagar Road, Ahmedabad', lat: 23.0118, lon: 72.5085, category: 'area' },
  { name: 'Iskcon Cross Road', fullName: 'Iskcon Circle, SG Highway, Ahmedabad', lat: 23.0286, lon: 72.5067, category: 'area' },
  { name: 'Science City', fullName: 'Gujarat Science City, Science City Rd, Ahmedabad', lat: 23.0788, lon: 72.5025, category: 'landmark' },
  { name: 'Kankaria Lake', fullName: 'Kankaria Lake, Maninagar, Ahmedabad', lat: 23.0063, lon: 72.5997, category: 'landmark' },
  { name: 'Sabarmati Ashram', fullName: 'Gandhi Ashram, Sabarmati, Ahmedabad', lat: 23.0605, lon: 72.5802, category: 'landmark' },
  { name: 'Sabarmati Riverfront', fullName: 'Sabarmati Riverfront Promenade, Ahmedabad', lat: 23.0302, lon: 72.5732, category: 'landmark' },
  { name: 'Law Garden', fullName: 'Law Garden, Netaji Rd, Ellisbridge, Ahmedabad', lat: 23.0242, lon: 72.5594, category: 'landmark' },
  { name: 'Shivranjani Cross Roads', fullName: 'Shivranjani Cross Roads, Satellite, Ahmedabad', lat: 23.0248, lon: 72.5312, category: 'area' },
  { name: 'Nehrunagar', fullName: 'Nehrunagar Circle, Ambawadi, Ahmedabad', lat: 23.0199, lon: 72.5413, category: 'area' },
  { name: 'Bopal', fullName: 'Bopal, Ahmedabad, Gujarat', lat: 23.0338, lon: 72.4645, category: 'area' },
  { name: 'South Bopal (SoBo)', fullName: 'South Bopal, Ahmedabad, Gujarat', lat: 23.0185, lon: 72.4705, category: 'area' },
  { name: 'Thaltej', fullName: 'Thaltej, SG Highway, Ahmedabad', lat: 23.0505, lon: 72.5165, category: 'area' },
  { name: 'Naranpura', fullName: 'Naranpura, Ahmedabad, Gujarat', lat: 23.0531, lon: 72.5540, category: 'area' },
  { name: 'Maninagar', fullName: 'Maninagar, Ahmedabad, Gujarat', lat: 22.9984, lon: 72.6025, category: 'area' },
  { name: 'Chandkheda', fullName: 'Chandkheda, Ahmedabad, Gujarat', lat: 23.1090, lon: 72.5855, category: 'area' },
  { name: 'Motera (Narendra Modi Stadium)', fullName: 'Narendra Modi Stadium, Motera, Ahmedabad', lat: 23.0925, lon: 72.5975, category: 'landmark' },
  { name: 'PDPU / PDEU', fullName: 'Pandit Deendayal Energy University, Raisan, Gandhinagar', lat: 23.1554, lon: 72.6669, category: 'landmark' },
  { name: 'GNLU', fullName: 'Gujarat National Law University, Attalika Avenue, Gandhinagar', lat: 23.1878, lon: 72.6276, category: 'landmark' },
  { name: 'DA-IICT', fullName: 'Dhirubhai Ambani Institute of ICT, Indroda, Gandhinagar', lat: 23.1884, lon: 72.6288, category: 'landmark' },
  { name: 'IIT Gandhinagar', fullName: 'Indian Institute of Technology Gandhinagar, Palaj', lat: 23.2114, lon: 72.6841, category: 'landmark' },
  { name: 'Akshardham Temple', fullName: 'Swaminarayan Akshardham, Sector 20, Gandhinagar', lat: 23.2295, lon: 72.6738, category: 'landmark' },
  { name: 'Mahatma Mandir', fullName: 'Mahatma Mandir Convention Centre, Sector 13, Gandhinagar', lat: 23.2162, lon: 72.6322, category: 'landmark' },
  { name: 'Ahmedabad One Mall (Alpha One)', fullName: 'Ahmedabad One Mall, Vastrapur, Ahmedabad', lat: 23.0398, lon: 72.5315, category: 'landmark' },
  { name: 'Palladium Mall Ahmedabad', fullName: 'Palladium Mall, Thaltej, SG Highway, Ahmedabad', lat: 23.0585, lon: 72.5205, category: 'landmark' },
  { name: 'IIM Ahmedabad', fullName: 'Indian Institute of Management Ahmedabad, Vastrapur', lat: 23.0315, lon: 72.5350, category: 'landmark' },
  { name: 'Gujarat University', fullName: 'Gujarat University, Navrangpura, Ahmedabad', lat: 23.03459, lon: 72.54904, category: 'landmark' },
  { name: 'Gota', fullName: 'Gota, SG Highway, Ahmedabad', lat: 23.0970, lon: 72.5360, category: 'area' },
  { name: 'Nikol', fullName: 'Nikol, Ahmedabad, Gujarat', lat: 23.0480, lon: 72.6660, category: 'area' },
  { name: 'Naroda', fullName: 'Naroda, Ahmedabad, Gujarat', lat: 23.0750, lon: 72.6590, category: 'area' },
  { name: 'Odhav', fullName: 'Odhav Industrial Estate, Ahmedabad', lat: 23.0240, lon: 72.6580, category: 'area' },
  { name: 'Vatva', fullName: 'Vatva, Ahmedabad, Gujarat', lat: 22.9600, lon: 72.6280, category: 'area' },
  { name: 'Paldi', fullName: 'Paldi, Ahmedabad, Gujarat', lat: 23.0130, lon: 72.5640, category: 'area' },
  { name: 'Ashram Road', fullName: 'Ashram Road, Usmanpura / Ellisbridge, Ahmedabad', lat: 23.0360, lon: 72.5710, category: 'area' },
  { name: 'Sindhu Bhavan Road (SBR)', fullName: 'Sindhu Bhavan Marg, Bodakdev, Ahmedabad', lat: 23.0430, lon: 72.5080, category: 'area' },
  { name: 'Gandhinagar Sector 1', fullName: 'Sector 1, Gandhinagar, Gujarat', lat: 23.2420, lon: 72.6490, category: 'area' },
  { name: 'Gandhinagar Sector 7', fullName: 'Sector 7, Gandhinagar, Gujarat', lat: 23.2350, lon: 72.6420, category: 'area' },
  { name: 'Gandhinagar Sector 11', fullName: 'Sector 11, Gandhinagar, Gujarat', lat: 23.2260, lon: 72.6400, category: 'area' },
  { name: 'Gandhinagar Sector 16', fullName: 'Sector 16, Gandhinagar, Gujarat', lat: 23.2200, lon: 72.6500, category: 'area' },
  { name: 'Gandhinagar Sector 28', fullName: 'Sector 28, Gandhinagar, Gujarat', lat: 23.2550, lon: 72.6650, category: 'area' },
];

/** Fast approximation distance in km */
export function calcDistanceKm(ptA, ptB) {
  if (!ptA || !ptB || ptA.lat == null || ptB.lat == null || ptA.lon == null || ptB.lon == null) return null;
  const x = (ptA.lat - ptB.lat) * 111.0;
  const y = (ptA.lon - ptB.lon) * 102.0;
  return Math.sqrt(x * x + y * y);
}

function norm(s = '') {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// In-memory cache for external geocoding requests
const geocodeCache = new Map();

/**
 * Search locations across:
 * 1. Transit Nodes (Metro stations & Bus stops from offline dataset)
 * 2. Curated Landmarks & Areas (offline high-priority POIs)
 * 3. Live OpenStreetMap/Photon Geocoder (online streets, addresses, colonies, shops)
 */
export async function searchLocations({
  query = '',
  nodes = [],
  gps = null,
  limit = 8,
  signal = null,
}) {
  const q = norm(query);
  if (!q || q.length < 1) return [];

  const results = [];
  const seenKeys = new Set();

  function addResult(item) {
    const key = `${item.name.toLowerCase()}|${Number(item.lat).toFixed(4)}|${Number(item.lon).toFixed(4)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const dist = gps ? calcDistanceKm(gps, item) : null;
    results.push({
      ...item,
      distanceKm: dist,
      distanceText: dist != null ? (dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`) : null,
    });
  }

  // 1. Check for exact/prefix matches in Metro stations first (highest transit intent)
  const metroNodes = nodes.filter((n) => n.kind === 'metro');
  for (const n of metroNodes) {
    const nn = norm(n.name);
    if (nn.startsWith(q) || nn.includes(q) || q.includes(nn)) {
      addResult({
        id: n.id,
        name: n.name,
        fullName: `${n.name} (Metro Station)`,
        lat: n.lat,
        lon: n.lon,
        type: 'metro',
        isStation: true,
        node: n,
      });
    }
  }

  // 2. Check Curated Landmarks & Popular Neighborhoods
  for (const l of CURATED_LANDMARKS) {
    const ln = norm(l.name);
    const fn = norm(l.fullName);
    if (ln.startsWith(q) || ln.includes(q) || fn.includes(q)) {
      addResult({
        id: `landmark_${l.name.replace(/\s+/g, '_')}`,
        name: l.name,
        fullName: l.fullName,
        lat: l.lat,
        lon: l.lon,
        type: l.category || 'landmark',
        isStation: false,
      });
    }
  }

  // 3. Check Bus Stops
  const busNodes = nodes.filter((n) => n.kind === 'bus');
  for (const n of busNodes) {
    const nn = norm(n.name);
    if (nn.startsWith(q) || nn.includes(q)) {
      addResult({
        id: n.id,
        name: n.name,
        fullName: `${n.name} (Bus Stop)`,
        lat: n.lat,
        lon: n.lon,
        type: 'bus',
        isStation: true,
        node: n,
      });
      if (results.length >= limit * 2) break;
    }
  }

  // 4. If query length >= 2, fetch live geocoding from OpenStreetMap / Photon for arbitrary addresses
  if (q.length >= 2) {
    const cached = geocodeCache.get(q);
    if (cached) {
      for (const item of cached) addResult(item);
    } else {
      try {
        const liveItems = await fetchLiveGeocode(query, signal);
        geocodeCache.set(q, liveItems);
        for (const item of liveItems) addResult(item);
      } catch {
        // Silently continue with local results if network fails
      }
    }
  }

  // Rank results: exact name matches first, then metro stations, then landmarks, then proximity
  return results
    .sort((a, b) => {
      const aNorm = norm(a.name);
      const bNorm = norm(b.name);
      const aExact = aNorm === q ? 1 : 0;
      const bExact = bNorm === q ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const aStarts = aNorm.startsWith(q) ? 1 : 0;
      const bStarts = bNorm.startsWith(q) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      // Prioritize stations and landmarks over remote addresses
      const typeRank = { metro: 4, landmark: 3, transit_hub: 3, area: 2, bus: 2, address: 1, place: 1 };
      const aRank = typeRank[a.type] || 1;
      const bRank = typeRank[b.type] || 1;
      if (aRank !== bRank) return bRank - aRank;

      if (gps && a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    })
    .slice(0, limit);
}

/**
 * Fetch geocoded results using Photon (OpenStreetMap search-as-you-type)
 * with automatic fallback to Nominatim.
 */
async function fetchLiveGeocode(query, signal) {
  const centerLat = 23.0225;
  const centerLon = 72.5714;
  const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
    query
  )}&lat=${centerLat}&lon=${centerLon}&limit=6`;

  try {
    const res = await fetch(photonUrl, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Photon response not ok');
    const data = await res.json();
    const items = [];

    for (const f of data.features || []) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const lon = coords[0];
      const lat = coords[1];

      // Filter to Gujarat / Ahmedabad / Gandhinagar bounding box
      if (
        lon < REGION_BBOX.minLon ||
        lon > REGION_BBOX.maxLon ||
        lat < REGION_BBOX.minLat ||
        lat > REGION_BBOX.maxLat
      ) {
        continue;
      }

      const p = f.properties || {};
      const name = p.name || p.street || p.district || p.city || query;
      const parts = [p.street, p.district, p.city, p.state].filter(Boolean);
      const fullName = parts.length ? `${name}, ${parts.join(', ')}` : name;

      items.push({
        id: `geo_${f.properties?.osm_id || Math.random()}`,
        name: name,
        fullName: fullName,
        lat: lat,
        lon: lon,
        type: 'address',
        isStation: false,
      });
    }

    if (items.length > 0) return items;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
  }

  // Fallback to Nominatim
  try {
    const viewbox = `${REGION_BBOX.minLon},${REGION_BBOX.maxLat},${REGION_BBOX.maxLon},${REGION_BBOX.minLat}`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query + ', Ahmedabad Gujarat'
    )}&format=json&limit=5&viewbox=${viewbox}&bounded=0`;

    const res = await fetch(nominatimUrl, {
      signal,
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'OneJourneyTransitApp/1.0',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item) => ({
      id: `nom_${item.place_id}`,
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type === 'station' || item.type === 'stop' ? 'bus' : 'address',
      isStation: item.type === 'station' || item.type === 'stop',
    }));
  } catch {
    return [];
  }
}
