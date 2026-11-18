import { describe, expect, it } from "vitest";
import { dmsToDecimal, formatDecimal, formatDMS, parseCoordinates, type ParseResult } from "../src/coords";

function expectOk(r: ParseResult) {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r;
}

describe("dmsToDecimal", () => {
  it("converts and applies hemisphere sign", () => {
    expect(dmsToDecimal(39, 8, 24.9, "N")).toBeCloseTo(39.140250, 6);
    expect(dmsToDecimal(120, 14, 6, "W")).toBeCloseTo(-120.235, 6);
  });
  it("keeps a negative degree sign when no hemisphere is given", () => {
    expect(dmsToDecimal(-120, 14, 6)).toBeCloseTo(-120.235, 6);
  });
});

describe("parseCoordinates — decimal", () => {
  it.each([
    ["39.166175, -120.155778", 39.166175, -120.155778],
    ["39.166175,-120.155778", 39.166175, -120.155778],
    ["  39.166175   -120.155778 ", 39.166175, -120.155778],
    ["+40.5; 111", 40.5, 111],
  ])("parses %j", (input, lat, lng) => {
    const r = expectOk(parseCoordinates(input));
    expect(r.format).toBe("decimal");
    expect(r.value.lat).toBeCloseTo(lat, 6);
    expect(r.value.lng).toBeCloseTo(lng, 6);
  });

  it("rejects out-of-range values", () => {
    expect(parseCoordinates("91, 10")).toMatchObject({ ok: false });
    expect(parseCoordinates("45, 181")).toMatchObject({ ok: false });
  });
});

describe("parseCoordinates — DMS", () => {
  it("parses the canonical Google Maps form", () => {
    const r = expectOk(parseCoordinates(`39°08'24.9"N 120°14'06.0"W`));
    expect(r.format).toBe("dms");
    expect(r.value.lat).toBeCloseTo(39.14025, 5);
    expect(r.value.lng).toBeCloseTo(-120.235, 5);
  });

  // v1 bug: the regex was case-insensitive but the sign check compared against
  // uppercase "S"/"W" only, so lowercase hemispheres silently landed in the wrong place.
  it("honours lowercase hemispheres (v1 regression)", () => {
    const r = expectOk(parseCoordinates(`39°08'24.9"s 120°14'06.0"w`));
    expect(r.value.lat).toBeLessThan(0);
    expect(r.value.lng).toBeLessThan(0);
  });

  it.each([
    `39° 08' 24.9" N, 120° 14' 06.0" W`,
    `39°08′24.9″N 120°14′06.0″W`,
    `39d08m24.9sN 120d14m06.0sW`,
  ])("accepts spacing / glyph variant %j", (input) => {
    const r = expectOk(parseCoordinates(input));
    expect(r.value.lat).toBeCloseTo(39.14025, 5);
    expect(r.value.lng).toBeCloseTo(-120.235, 5);
  });

  it("accepts degrees + decimal minutes", () => {
    const r = expectOk(parseCoordinates(`39°8.415'N 120°14.1'W`));
    expect(r.value.lat).toBeCloseTo(39.14025, 5);
    expect(r.value.lng).toBeCloseTo(-120.235, 5);
  });

  it("rejects swapped order and impossible minutes", () => {
    expect(parseCoordinates(`120°14'06"W 39°08'24.9"N`)).toMatchObject({ ok: false });
    expect(parseCoordinates(`39°61'00"N 120°14'06"W`)).toMatchObject({ ok: false });
  });
});

describe("parseCoordinates — garbage", () => {
  it.each(["", "   ", "hello", "39.1", "39.1, -120.2, 5"])("rejects %j", (input) => {
    expect(parseCoordinates(input).ok).toBe(false);
  });
});

describe("formatting", () => {
  const p = { lat: 39.14025, lng: -120.235 };
  it("formats decimal", () => expect(formatDecimal(p)).toBe("39.140250, -120.235000"));
  it("formats DMS", () => expect(formatDMS(p)).toBe(`39°08'24.9"N 120°14'06.0"W`));
  it("never rounds up to 60 seconds", () => {
    expect(formatDMS({ lat: 10.999999, lng: 0 })).toBe(`11°00'00.0"N 0°00'00.0"E`);
  });
  it("round-trips through the parser", () => {
    const r = expectOk(parseCoordinates(formatDMS(p)));
    expect(r.value.lat).toBeCloseTo(p.lat, 4);
    expect(r.value.lng).toBeCloseTo(p.lng, 4);
  });
});
