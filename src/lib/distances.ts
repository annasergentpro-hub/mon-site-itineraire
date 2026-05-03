export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
  raw?: string;
}

export interface RankedStop extends GeoPoint {
  order: number;
  distanceFromPrev: number;
  durationFromPrev: number;
  fromLabel: string;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const REVERSE = "https://nominatim.openstreetmap.org/reverse";
const OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving";

// --- Helpers réseau : timeout + retries (corrige "Load failed" sur Safari/iOS/Chrome mobile) ---
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  { retries = 3, timeoutMs = 15000 }: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal ?? ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (res.ok) return res;
      // 5xx / 429 → on retente
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    // backoff exponentiel
    await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Réseau indisponible");
}

// Distance Haversine (fallback quand OSRM tombe)
function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
  type?: string;
}

// --- RECHERCHE ET SUGGESTIONS ---

export async function searchSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${NOMINATIM}?format=json&limit=6&addressdetails=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) return [];
  const data = (await res.json()) as any[];
  return data.map((d) => ({
    label: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    type: d.type,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `${REVERSE}?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } }, { retries: 2, timeoutMs: 12000 });
    const data = await res.json();
    return data.display_name ?? "Position sélectionnée";
  } catch {
    return "Position sélectionnée";
  }
}

// --- GÉOCODAGE ---

export async function geocodeAddress(address: string): Promise<GeoPoint> {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Adresse vide");

  const tryFetch = async (q: string) => {
    const url = `${NOMINATIM}?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Géocodage indisponible (${res.status})`);
    return (await res.json()) as any[];
  };

  let data = await tryFetch(trimmed);
  if (!data.length) {
    const cleaned = trimmed.replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned !== trimmed) data = await tryFetch(cleaned);
  }

  if (!data.length) throw new Error(`Adresse introuvable : "${trimmed}"`);
  
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    label: data[0].display_name,
    raw: trimmed,
  };
}

export async function geocodeMany(
  addresses: string[],
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<GeoPoint[]> {
  const results: GeoPoint[] = [];
  for (let i = 0; i < addresses.length; i++) {
    onProgress?.(i, addresses.length, addresses[i]);
    const point = await geocodeAddress(addresses[i]);
    results.push(point);
    if (i < addresses.length - 1) await new Promise((r) => setTimeout(r, 1100));
  }
  onProgress?.(addresses.length, addresses.length, "");
  return results;
}

// --- CALCUL DE MATRICE ET OPTIMISATION ---

async function getDistanceMatrix(points: GeoPoint[]) {
  const coords = points.map((p) => `${p.lon},${p.lat}`).join(";");
  const url = `${OSRM_TABLE}/${coords}?annotations=distance,duration`;
  try {
    const res = await fetchWithRetry(url, {}, { retries: 2, timeoutMs: 20000 });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const json = (await res.json()) as {
      distances: number[][];
      durations: number[][];
    };
    if (!json.distances || !json.durations) throw new Error("OSRM réponse invalide");
    return json;
  } catch (err) {
    // Fallback : matrice Haversine + estimation 50 km/h si OSRM bloqué (mobile/Safari)
    console.warn("OSRM indisponible, fallback Haversine :", err);
    const n = points.length;
    const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const durations: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = haversineMeters(points[i], points[j]) * 1.3; // facteur route
        distances[i][j] = d;
        durations[i][j] = (d / 1000) * 72; // ~50 km/h → 72 s/km
      }
    }
    return { distances, durations };
  }
}

function calculateLoopDist(path: number[], matrix: number[][]): number {
  let d = matrix[0][path[0]]; 
  for (let i = 0; i < path.length - 1; i++) {
    d += matrix[path[i]][path[i + 1]];
  }
  d += matrix[path[path.length - 1]][0]; 
  return d;
}

/** * OPTIMISATION : On commence la boucle à i = 1 
 * pour ne jamais modifier le premier arrêt choisi par le filtre.
 */
function optimize2OptLocked(path: number[], matrix: number[][]): number[] {
  let best = [...path];
  let improved = true;
  while (improved) {
    improved = false;
    // i commence à 1 pour GARDER LE PREMIER ARRÊT FIXE
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const newPath = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (calculateLoopDist(newPath, matrix) < calculateLoopDist(best, matrix)) {
          best = newPath;
          improved = true;
        }
      }
    }
  }
  return best;
}

export async function buildChainedRoute(
  origin: GeoPoint,
  stops: GeoPoint[],
  order: "asc" | "desc",
  onProgress?: (done: number, total: number) => void,
): Promise<RankedStop[]> {
  if (!stops.length) return [];

  const allPoints = [origin, ...stops];
  onProgress?.(10, 100);
  const matrix = await getDistanceMatrix(allPoints);
  onProgress?.(40, 100);

  const stopIndices = stops.map((_, i) => i + 1);

  // 1. DÉTERMINATION DU PREMIER POINT STRICT (Le plus proche ou le plus loin)
  let firstIdx = -1;
  let extremeDist = order === "asc" ? Infinity : -1;

  for (const idx of stopIndices) {
    const d = matrix.distances[0][idx];
    if (order === "asc") {
      if (d < extremeDist) { extremeDist = d; firstIdx = idx; }
    } else {
      if (d > extremeDist) { extremeDist = d; firstIdx = idx; }
    }
  }

  // 2. CONSTRUCTION DU TRAJET (Glouton à partir du premier point imposé)
  let currentPath = [firstIdx];
  let unvisited = new Set(stopIndices.filter(i => i !== firstIdx));
  
  let currentPos = firstIdx;
  while (unvisited.size > 0) {
    let next = -1;
    let dMin = Infinity;
    unvisited.forEach(idx => {
      if (matrix.distances[currentPos][idx] < dMin) {
        dMin = matrix.distances[currentPos][idx];
        next = idx;
      }
    });
    currentPath.push(next);
    unvisited.delete(next);
    currentPos = next;
  }

  // 3. OPTIMISATION SANS CHANGER LE DÉPART
  const finalSequence = optimize2OptLocked(currentPath, matrix.distances);

  // 4. CONSTRUCTION DU RÉSULTAT
  const ranked: RankedStop[] = [];
  let previousIdx = 0;

  for (let i = 0; i < finalSequence.length; i++) {
    const currentIdx = finalSequence[i];
    ranked.push({
      ...allPoints[currentIdx],
      order: i + 1,
      distanceFromPrev: matrix.distances[previousIdx][currentIdx],
      durationFromPrev: matrix.durations[previousIdx][currentIdx],
      fromLabel: allPoints[previousIdx].label,
    });
    previousIdx = currentIdx;
  }

  // RETOUR ORIGINE
  ranked.push({
    ...origin,
    label: `Retour : ${origin.label}`,
    order: ranked.length + 1,
    distanceFromPrev: matrix.distances[previousIdx][0],
    durationFromPrev: matrix.durations[previousIdx][0],
    fromLabel: allPoints[previousIdx].label,
  });

  onProgress?.(100, 100);
  return ranked;
}

/**
 * Recalcule distances/durées pour une séquence d'arrêts donnée par l'utilisateur
 * (ex : après un drag & drop sur la carte). On garde l'ordre exact fourni.
 */
export async function recomputeForOrder(
  origin: GeoPoint,
  orderedStops: GeoPoint[],
): Promise<RankedStop[]> {
  if (!orderedStops.length) return [];
  const allPoints = [origin, ...orderedStops];
  const matrix = await getDistanceMatrix(allPoints);

  const ranked: RankedStop[] = [];
  let previousIdx = 0;
  for (let i = 0; i < orderedStops.length; i++) {
    const currentIdx = i + 1;
    ranked.push({
      ...allPoints[currentIdx],
      order: i + 1,
      distanceFromPrev: matrix.distances[previousIdx][currentIdx],
      durationFromPrev: matrix.durations[previousIdx][currentIdx],
      fromLabel: allPoints[previousIdx].label,
    });
    previousIdx = currentIdx;
  }
  ranked.push({
    ...origin,
    label: `Retour : ${origin.label}`,
    order: ranked.length + 1,
    distanceFromPrev: matrix.distances[previousIdx][0],
    durationFromPrev: matrix.durations[previousIdx][0],
    fromLabel: allPoints[previousIdx].label,
  });
  return ranked;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, "0")}`;
}
