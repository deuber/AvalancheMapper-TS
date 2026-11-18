// Minimal typings for piexifjs (test-only dependency, ships no types).
declare module "piexifjs" {
  type IfdName = "0th" | "Exif" | "GPS" | "Interop" | "1st";
  type ExifDict = Partial<Record<IfdName, Record<number, unknown>>>;
  const piexif: {
    dump(exif: ExifDict): string;
    insert(exifBytes: string, jpegBinary: string): string;
    load(jpegBinary: string): ExifDict;
    ImageIFD: Readonly<Record<"Make" | "Model", number>>;
    ExifIFD: Readonly<Record<"DateTimeOriginal", number>>;
    GPSIFD: Readonly<
      Record<"GPSLatitudeRef" | "GPSLatitude" | "GPSLongitudeRef" | "GPSLongitude" | "GPSAltitudeRef" | "GPSAltitude", number>
    >;
  };
  export default piexif;
}
