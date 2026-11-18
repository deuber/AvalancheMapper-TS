import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import piexif from "piexifjs";
import { describe, expect, it } from "vitest";
import { interpretExif, readPhotoMetadata } from "../src/exif";

describe("interpretExif", () => {
  it("returns no-gps for non-objects", () => {
    expect(interpretExif(undefined)).toEqual({ kind: "no-gps" });
    expect(interpretExif("nope")).toEqual({ kind: "no-gps" });
  });

  it("extracts position and details", () => {
    const takenAt = new Date("2026-02-01T09:30:00Z");
    expect(
      interpretExif({ latitude: 39.1, longitude: -120.2, GPSAltitude: 2500, DateTimeOriginal: takenAt, Make: "Apple", Model: "iPhone 16" }),
    ).toEqual({ kind: "gps", position: { lat: 39.1, lng: -120.2 }, altitudeM: 2500, takenAt, camera: "Apple iPhone 16" });
  });

  it("treats a 0,0 fix as missing GPS", () => {
    expect(interpretExif({ latitude: 0, longitude: 0 }).kind).toBe("no-gps");
  });

  it("ignores wrongly-typed fields instead of trusting them", () => {
    expect(interpretExif({ latitude: "39.1", longitude: -120, GPSAltitude: "high" })).toEqual({ kind: "no-gps" });
  });

  it("negates altitude below sea level", () => {
    const r = interpretExif({ latitude: 31.5, longitude: 35.5, GPSAltitude: 430, GPSAltitudeRef: 1 });
    expect(r).toMatchObject({ kind: "gps", altitudeM: -430 });
  });
});

/** Write real GPS EXIF tags into a JPEG, then read them back through exifr. */
function jpegWithGps(lat: number, lng: number, altitudeM: number): Uint8Array {
  const src = readFileSync(fileURLToPath(new URL("../public/hero.jpg", import.meta.url))).toString("binary");
  const toRational = (deg: number): [number, number][] => {
    const a = Math.abs(deg);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = Math.round(((a - d) * 60 - m) * 60 * 1000);
    return [[d, 1], [m, 1], [s, 1000]];
  };
  const exif = piexif.dump({
    "0th": { [piexif.ImageIFD.Make]: "TestCam", [piexif.ImageIFD.Model]: "X1" },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: "2026:01:15 10:42:00" },
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: lat < 0 ? "S" : "N",
      [piexif.GPSIFD.GPSLatitude]: toRational(lat),
      [piexif.GPSIFD.GPSLongitudeRef]: lng < 0 ? "W" : "E",
      [piexif.GPSIFD.GPSLongitude]: toRational(lng),
      [piexif.GPSIFD.GPSAltitudeRef]: 0,
      [piexif.GPSIFD.GPSAltitude]: [Math.round(altitudeM * 100), 100],
    },
  });
  return Uint8Array.from(Buffer.from(piexif.insert(exif, src), "binary"));
}

describe("readPhotoMetadata (end-to-end with a real JPEG)", () => {
  it("reads GPS, altitude, time and camera", async () => {
    const meta = await readPhotoMetadata(jpegWithGps(39.14025, -120.235, 2743.2));
    if (meta.kind !== "gps") throw new Error(`expected gps, got ${meta.kind}`);
    expect(meta.position.lat).toBeCloseTo(39.14025, 5);
    expect(meta.position.lng).toBeCloseTo(-120.235, 5);
    expect(meta.altitudeM).toBeCloseTo(2743.2, 1);
    expect(meta.camera).toBe("TestCam X1");
    expect(meta.takenAt?.getFullYear()).toBe(2026);
  });

  it("reports no-gps for a photo without location tags", async () => {
    const plain = Uint8Array.from(readFileSync(fileURLToPath(new URL("../public/hero.jpg", import.meta.url))));
    expect((await readPhotoMetadata(plain)).kind).toBe("no-gps");
  });

  it("reports an error for non-image bytes", async () => {
    const meta = await readPhotoMetadata(new TextEncoder().encode("definitely not a jpeg"));
    expect(meta.kind).toBe("error");
  });
});
