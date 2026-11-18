/**
 * Photo metadata extraction. exifr returns loosely-typed `any`; this module is
 * the trust boundary where that gets narrowed into a precise, typed result.
 */
import exifr from "exifr";
import { isValidLatLng, type LatLng } from "./coords";

export interface PhotoDetails {
  /** When the shutter fired, if the camera recorded it. */
  readonly takenAt?: Date;
  /** Metres above sea level, from GPSAltitude/GPSAltitudeRef. */
  readonly altitudeM?: number;
  readonly camera?: string;
}

export type PhotoMetadata =
  | ({ readonly kind: "gps"; readonly position: LatLng } & PhotoDetails)
  | ({ readonly kind: "no-gps" } & PhotoDetails)
  | { readonly kind: "error"; readonly message: string };

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const asNumber = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
const asDate = (v: unknown): Date | undefined =>
  v instanceof Date && !Number.isNaN(v.getTime()) ? v : undefined;

/** Pure: turn exifr's raw output into our typed shape. Exported for testing. */
export function interpretExif(raw: unknown): PhotoMetadata {
  if (!isRecord(raw)) return { kind: "no-gps" };

  const altitude = asNumber(raw["GPSAltitude"]);
  // GPSAltitudeRef 1 = below sea level. exifr may surface it as a number or a 1-byte array.
  const altRef = raw["GPSAltitudeRef"];
  const belowSea = altRef === 1 || (altRef instanceof Uint8Array && altRef[0] === 1);
  const make = asString(raw["Make"]);
  const model = asString(raw["Model"]);
  const camera = model && make && !model.startsWith(make) ? `${make} ${model}` : (model ?? make);
  const takenAt = asDate(raw["DateTimeOriginal"]) ?? asDate(raw["CreateDate"]);

  // Build the optional fields without ever assigning `undefined` explicitly
  // (required under `exactOptionalPropertyTypes`).
  const details: { -readonly [K in keyof PhotoDetails]?: Exclude<PhotoDetails[K], undefined> } = {};
  if (takenAt) details.takenAt = takenAt;
  if (altitude !== undefined) details.altitudeM = belowSea ? -altitude : altitude;
  if (camera) details.camera = camera;

  const lat = asNumber(raw["latitude"]);
  const lng = asNumber(raw["longitude"]);
  if (lat === undefined || lng === undefined) return { kind: "no-gps", ...details };

  const position: LatLng = { lat, lng };
  // A 0,0 fix ("Null Island") is what some phones write when they had no lock.
  if (!isValidLatLng(position) || (lat === 0 && lng === 0)) return { kind: "no-gps", ...details };

  return { kind: "gps", position, ...details };
}

export async function readPhotoMetadata(file: Blob | ArrayBuffer | Uint8Array): Promise<PhotoMetadata> {
  try {
    const raw: unknown = await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      ifd1: false,
      xmp: false,
      icc: false,
      iptc: false,
      jfif: false,
      ihdr: false,
      reviveValues: true,
    });
    return interpretExif(raw);
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
