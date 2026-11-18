import "./style.css";
import { formatDecimal, formatDMS, parseCoordinates, type LatLng } from "./coords";
import { byId, renderStatus } from "./dom";
import { readPhotoMetadata, type PhotoMetadata } from "./exif";
import { MapView, type MoveSource } from "./map";

/** Tahoe City — a reasonable backcountry-adjacent default. */
const DEFAULT_POSITION: LatLng = { lat: 39.1707, lng: -120.1405 };

/** Where the current marker position came from. Drives the readout label. */
type PositionSource = "default" | "photo" | "manual" | MoveSource;

const SOURCE_LABEL: Record<PositionSource, string> = {
  default: "default view — upload a photo or place the pin",
  photo: "from photo GPS metadata",
  manual: "entered manually",
  drag: "marker dragged",
  click: "placed by clicking the map",
};

const ui = {
  dropzone: byId("dropzone", HTMLLabelElement),
  fileInput: byId("image-upload", HTMLInputElement),
  uploadResult: byId("uploadResult", HTMLDivElement),
  thumbnail: byId("thumbnail", HTMLImageElement),
  status: byId("statusPill", HTMLDivElement),
  details: byId("photoDetails", HTMLDListElement),
  map: byId("map", HTMLDivElement),
  sourceLabel: byId("sourceLabel", HTMLSpanElement),
  decimalOut: byId("decimalOut", HTMLElement),
  dmsOut: byId("dmsOut", HTMLElement),
  form: byId("manualForm", HTMLFormElement),
  coordInput: byId("coordinates", HTMLInputElement),
  coordError: byId("coordError", HTMLParagraphElement),
} as const;

function showPosition(position: LatLng, source: PositionSource): void {
  ui.decimalOut.textContent = formatDecimal(position);
  ui.dmsOut.textContent = formatDMS(position);
  ui.sourceLabel.textContent = SOURCE_LABEL[source];
}

const map = new MapView({
  container: ui.map,
  initial: DEFAULT_POSITION,
  onUserMove: (position, source) => showPosition(position, source),
});
showPosition(DEFAULT_POSITION, "default");

// ---- copy buttons ----
for (const btn of document.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
  btn.addEventListener("click", async () => {
    const which = btn.dataset["copy"];
    const text = which === "dms" ? formatDMS(map.position) : formatDecimal(map.position);
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Copy failed";
    }
    setTimeout(() => (btn.textContent = original), 1400);
  });
}

// ---- manual entry ----
ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const result = parseCoordinates(ui.coordInput.value);
  if (!result.ok) {
    ui.coordError.textContent = result.error;
    ui.coordError.hidden = false;
    ui.coordInput.setAttribute("aria-invalid", "true");
    return;
  }
  ui.coordError.hidden = true;
  ui.coordInput.removeAttribute("aria-invalid");
  map.moveTo(result.value, 14);
  showPosition(result.value, "manual");
});

// ---- photo upload ----
let thumbUrl: string | undefined;

function renderDetails(meta: Exclude<PhotoMetadata, { kind: "error" }>): void {
  const rows: Array<[string, string]> = [];
  if (meta.takenAt) rows.push(["Taken", meta.takenAt.toLocaleString()]);
  if (meta.altitudeM !== undefined) {
    const ft = Math.round(meta.altitudeM * 3.28084).toLocaleString();
    rows.push(["Elevation", `${ft} ft (${Math.round(meta.altitudeM).toLocaleString()} m)`]);
  }
  if (meta.camera) rows.push(["Camera", meta.camera]);
  ui.details.replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }),
  );
  ui.details.hidden = rows.length === 0;
}

async function handleFile(file: File): Promise<void> {
  ui.uploadResult.hidden = false;
  // A blob URL references the File already in memory — no base64 re-encoding.
  // Revoke the previous one so repeated uploads don't leak.
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  thumbUrl = URL.createObjectURL(file);
  ui.thumbnail.hidden = false;
  ui.thumbnail.src = thumbUrl;
  ui.details.hidden = true;
  renderStatus(ui.status, "busy", `Reading ${file.name}…`);

  const meta = await readPhotoMetadata(file);

  // Exhaustive switch: adding a new PhotoMetadata variant is a compile error here until handled.
  switch (meta.kind) {
    case "gps":
      map.moveTo(meta.position, 15);
      showPosition(meta.position, "photo");
      renderStatus(ui.status, "ok", "Location extracted from photo");
      renderDetails(meta);
      break;
    case "no-gps":
      renderStatus(ui.status, "warn", "No GPS data in this photo — click the map, drag the pin, or enter coordinates");
      renderDetails(meta);
      break;
    case "error":
      renderStatus(ui.status, "error", `Couldn't read this file's metadata (${meta.message})`);
      break;
    default: {
      const unreachable: never = meta;
      throw new Error(`Unhandled metadata: ${JSON.stringify(unreachable)}`);
    }
  }
}

// HEIC and some formats can be parsed for EXIF but not displayed by every browser.
ui.thumbnail.addEventListener("error", () => (ui.thumbnail.hidden = true));

ui.fileInput.addEventListener("change", () => {
  const file = ui.fileInput.files?.[0];
  if (file) void handleFile(file);
  ui.fileInput.value = ""; // allow re-selecting the same file
});

for (const type of ["dragenter", "dragover"] as const) {
  ui.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    ui.dropzone.classList.add("drag");
  });
}
for (const type of ["dragleave", "drop"] as const) {
  ui.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    ui.dropzone.classList.remove("drag");
  });
}
ui.dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files[0];
  if (file) void handleFile(file);
});
