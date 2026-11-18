import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
// Bundlers rewrite asset paths, which breaks Leaflet's default icon lookup
// (it guesses image URLs from the CSS location). Import them explicitly instead.
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { LatLng } from "./coords";

export type MoveSource = "drag" | "click";

export interface MapViewOptions {
  readonly container: HTMLElement;
  readonly initial: LatLng;
  readonly zoom?: number;
  /** Fired when the user repositions the marker directly on the map. */
  readonly onUserMove?: (position: LatLng, source: MoveSource) => void;
}

const toLatLng = (p: L.LatLng): LatLng => ({ lat: p.lat, lng: p.lng });

export class MapView {
  readonly #map: L.Map;
  readonly #marker: L.Marker;

  constructor({ container, initial, zoom = 10, onUserMove }: MapViewOptions) {
    this.#map = L.map(container, { center: [initial.lat, initial.lng], zoom });

    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '<a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(this.#map);
    L.control.scale({ imperial: true, metric: true }).addTo(this.#map);

    const icon = L.icon({
      iconUrl: markerIcon,
      iconRetinaUrl: markerIcon2x,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    this.#marker = L.marker([initial.lat, initial.lng], { draggable: true, icon, autoPan: true }).addTo(this.#map);

    this.#marker.on("dragend", () => onUserMove?.(toLatLng(this.#marker.getLatLng()), "drag"));
    this.#map.on("click", (e: L.LeafletMouseEvent) => {
      this.#marker.setLatLng(e.latlng);
      onUserMove?.(toLatLng(e.latlng), "click");
    });
  }

  get position(): LatLng {
    return toLatLng(this.#marker.getLatLng());
  }

  moveTo(position: LatLng, zoom?: number): void {
    const target: L.LatLngTuple = [position.lat, position.lng];
    this.#marker.setLatLng(target);
    this.#map.setView(target, zoom ?? this.#map.getZoom());
  }
}
