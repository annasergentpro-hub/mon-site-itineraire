// ============================================================
// distances.ts — Version sécurisée et corrigée
// Corrections : User-Agent Nominatim, types TypeScript stricts,
// validation des entrées, gestion d'erreurs cohérente.
// ============================================================

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

export interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
  type?: string;
}

// --- Interfaces pour les réponses API ---
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
}

interface NominatimReverseResult {
  display_name?: string;
}

interface OsrmTableResult {
  distances: number[][];
  durations: number[][];
}

// --- Constantes ---
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const REVERSE   = "https://nominatim.openstreetmap.org/reverse";
const OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving";

// 🔒 SÉCURITÉ : Limite le nombre max d'adresses (anti-spam APIs publiques)
export const MAX_ADDRESSES = 50;
// 🔒 SÉCURITÉ : Longueur max d'une adresse (anti injection / requêtes anormales)
export const MAX_ADDRESS_LENGTH = 300;

// 🔒 FIX : User-Agent requis par les CGU de Nominatim (sans ça, l'IP peut être bannie)
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "LocatBuddyFinder/1.0 (contact@routecompass.app)",
};

// 🔒 FIX : Validation et sanitisation des adresses avant tout appel réseau
function sanitizeAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Adresse vide");
  if (trimmed.length > MAX_ADDRESS_LENGTH) {
    throw new Error(`Adresse trop longue (max ${MAX_ADDRESS_LENGTH} caractères)`);
  }
  // Retire les caractères de contrôle potentiellement dangereux
  return trimmed.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

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
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Réseau indisponible");
}

// Distance Haversine (fallback quand OSRM tombe)
function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
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

// --- RECHERCHE ET SUGGESTIONS ---

export async function searchSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // 🔒 FIX : Utilise fetchWithRetry au lieu de fetch brut pour cohérence
  // 🔒 FIX : User-Agent Nominatim ajouté
  const url = `${NOMINATIM}?format=json&limit=6&addressdetails=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetchWithRetry(
      url,
      { headers: NOMINATIM_HEADERS, signal },
      { retries: 1, timeoutMs: 8000 },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    return data.map((d) => ({
      label: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      type: d.type,
    }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    // 🔒 FIX : User-Agent Nominatim ajouté
    const url = `${REVERSE}?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetchWithRetry(
      url,
      { headers: NOMINATIM_HEADERS },
      { retries: 2, timeoutMs: 12000 },
    );
    const data = (await res.json()) as NominatimReverseResult;
    return data.display_name ?? "Position sélectionnée";
  } catch {
    return "Position sélectionnée";
  }
}

// --- GÉOCODAGE ---

export async function geocodeAddress(address: string): Promise<GeoPoint> {
  // 🔒 FIX : Validation + sanitisation avant envoi réseau
  const sanitized = sanitizeAddress(address);

  const tryFetch = async (q: string): Promise<NominatimResult[]> => {
    // 🔒 FIX : User-Agent Nominatim ajouté
    const url = `${NOMINATIM}?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
    const res = await fetchWithRetry(url, { headers: NOMINATIM_HEADERS }, { retries: 2 });
    if (!res.ok) throw new Error(`Géocodage indisponible (${res.status})`);
    return (await res.json()) as NominatimResult[];
  };

  let data = await tryFetch(sanitized);
  if (!data.length) {
    const cleaned = sanitized.replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned !== sanitized) data = await tryFetch(cleaned);
  }

  if (!data.length) throw new Error(`Adresse introuvable : "${sanitized}"`);

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    label: data[0].display_name,
    raw: sanitized,
  };
}

export async function geocodeMany(
  addresses: string[],
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<GeoPoint[]> {
  // 🔒 FIX : Respect de la limite max
  const limited = addresses.slice(0, MAX_ADDRESSES);
  const results: GeoPoint[] = [];
  for (let i = 0; i < limited.length; i++) {
    onProgress?.(i, limited.length, limited[i]);
    const point = await geocodeAddress(limited[i]);
    results.push(point);
    // Respect du rate-limit Nominatim : 1 req/seconde max
    if (i < limited.length - 1) await new Promise((r) => setTimeout(r, 1100));
  }
  onProgress?.(limited.length, limited.length, "");
  return results;
}

// --- CALCUL DE MATRICE ET OPTIMISATION ---

async function getDistanceMatrix(
  points: GeoPoint[],
): Promise<OsrmTableResult> {
  const coords = points.map((p) => `${p.lon},${p.lat}`).join(";");
  const url = `${OSRM_TABLE}/${coords}?annotations=distance,duration`;
  try {
    const res = await fetchWithRetry(url, {}, { retries: 2, timeoutMs: 20000 });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const json = (await res.json()) as OsrmTableResult;
    if (!json.distances || !json.durations) throw new Error("OSRM réponse invalide");
    return json;
  } catch (err) {
    // Fallback : matrice Haversine + estimation 50 km/h si OSRM bloqué
    console.warn("OSRM indisponible, fallback Haversine :", err);
    const n = points.length;
    const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const durations: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = haversineMeters(points[i], points[j]) * 1.3;
        distances[i][j] = d;
        durations[i][j] = (d / 1000) * 72;
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

function optimize2OptLocked(path: number[], matrix: number[][]): number[] {
  let best = [...path];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const newPath = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
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

  let currentPath = [firstIdx];
  const unvisited = new Set(stopIndices.filter((i) => i !== firstIdx));

  let currentPos = firstIdx;
  while (unvisited.size > 0) {
    let next = -1;
    let dMin = Infinity;
    unvisited.forEach((idx) => {
      if (matrix.distances[currentPos][idx] < dMin) {
        dMin = matrix.distances[currentPos][idx];
        next = idx;
      }
    });
    currentPath.push(next);
    unvisited.delete(next);
    currentPos = next;
  }

  const finalSequence = optimize2OptLocked(currentPath, matrix.distances);

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
