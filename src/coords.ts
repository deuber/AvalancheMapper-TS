/**
 * Coordinate parsing and formatting. Pure functions, no DOM — fully unit-tested.
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export type Hemisphere = "N" | "S" | "E" | "W";

/**
 * Parse outcomes are a discriminated union rather than thrown exceptions, so
 * callers are forced by the compiler to handle the failure branch.
 */
export type ParseResult =
  | { readonly ok: true; readonly value: LatLng; readonly format: "decimal" | "dms" }
  | { readonly ok: false; readonly error: string };

/** Convert degrees/minutes/seconds (+ optional hemisphere) to signed decimal degrees. */
export function dmsToDecimal(
  degrees: number,
  minutes = 0,
  seconds = 0,
  hemisphere?: Hemisphere,
): number {
  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  const negative = hemisphere === "S" || hemisphere === "W" || (hemisphere === undefined && degrees < 0);
  return negative ? -magnitude : magnitude;
}

export function isValidLatLng({ lat, lng }: LatLng): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function rangeError(value: LatLng): ParseResult | null {
  if (Math.abs(value.lat) > 90) return { ok: false, error: `Latitude ${value.lat} is outside ±90°` };
  if (Math.abs(value.lng) > 180) return { ok: false, error: `Longitude ${value.lng} is outside ±180°` };
  return null;
}

// One DMS component: 39°08'24.9"N, 39° 8.415' N, 39d08m24.9sN, also the ′ ″ glyphs
// that some apps produce. Minutes and seconds are optional (supports DDM too).
const DMS_PART =
  String.raw`([-+]?\d+(?:\.\d+)?)\s*[°d]\s*(?:(\d+(?:\.\d+)?)\s*['′m]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:["″s]|'')\s*)?([NSEW])?`;
const DMS_REGEX = new RegExp(`^\\s*${DMS_PART}[\\s,;]*${DMS_PART}\\s*$`, "i");
const DECIMAL_REGEX = /^\s*([-+]?\d+(?:\.\d+)?)\s*[,;\s]\s*([-+]?\d+(?:\.\d+)?)\s*$/;

function toHemisphere(raw: string | undefined): Hemisphere | undefined {
  const upper = raw?.toUpperCase();
  return upper === "N" || upper === "S" || upper === "E" || upper === "W" ? upper : undefined;
}

export function parseCoordinates(input: string): ParseResult {
  const text = input.trim();
  if (text === "") return { ok: false, error: "Enter a coordinate pair" };

  const dms = DMS_REGEX.exec(text);
  if (dms) {
    const [, d1, m1, s1, h1, d2, m2, s2, h2] = dms;
    const hemiA = toHemisphere(h1);
    const hemiB = toHemisphere(h2);
    if (hemiA === "E" || hemiA === "W") {
      return { ok: false, error: "Put latitude (N/S) first, then longitude (E/W)" };
    }
    if (hemiB === "N" || hemiB === "S") {
      return { ok: false, error: "Second value must be longitude (E/W)" };
    }
    const value: LatLng = {
      lat: dmsToDecimal(Number(d1), Number(m1 ?? 0), Number(s1 ?? 0), hemiA),
      lng: dmsToDecimal(Number(d2), Number(m2 ?? 0), Number(s2 ?? 0), hemiB),
    };
    for (const [label, mins, secs] of [["first", m1, s1], ["second", m2, s2]] as const) {
      if (Number(mins ?? 0) >= 60 || Number(secs ?? 0) >= 60) {
        return { ok: false, error: `Minutes and seconds must be under 60 (${label} value)` };
      }
    }
    return rangeError(value) ?? { ok: true, value, format: "dms" };
  }

  const dec = DECIMAL_REGEX.exec(text);
  if (dec) {
    const value: LatLng = { lat: Number(dec[1]), lng: Number(dec[2]) };
    return rangeError(value) ?? { ok: true, value, format: "decimal" };
  }

  return {
    ok: false,
    error: `Couldn't read that. Try 39.166175, -120.155778 or 39°08'24.9"N 120°14'06.0"W`,
  };
}

export function formatDecimal({ lat, lng }: LatLng, digits = 6): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

function formatDmsPart(value: number, positive: Hemisphere, negative: Hemisphere): string {
  const hemi = value < 0 ? negative : positive;
  // Work in tenths of an arc-second so rounding can't produce 60.0" or 60'.
  const totalTenths = Math.round(Math.abs(value) * 36000);
  const deg = Math.floor(totalTenths / 36000);
  const min = Math.floor((totalTenths % 36000) / 600);
  const sec = (totalTenths % 600) / 10;
  return `${deg}°${String(min).padStart(2, "0")}'${sec.toFixed(1).padStart(4, "0")}"${hemi}`;
}

export function formatDMS({ lat, lng }: LatLng): string {
  return `${formatDmsPart(lat, "N", "S")} ${formatDmsPart(lng, "E", "W")}`;
}
