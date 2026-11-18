/**
 * Typed element lookup. `document.getElementById` returns `HTMLElement | null`;
 * this checks the element exists *and* is the expected kind at runtime, so the
 * rest of the code gets a correctly-typed element with no `as` casts.
 */
export function byId<T extends HTMLElement>(id: string, kind: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) {
    throw new Error(`#${id} missing or not a ${kind.name} (got ${el?.constructor.name ?? "null"})`);
  }
  return el;
}

export type StatusKind = "ok" | "warn" | "error" | "busy";

/** Renders a status pill using DOM nodes (not innerHTML) so file names etc. can't inject markup. */
export function renderStatus(target: HTMLElement, kind: StatusKind, text: string): void {
  const pill = document.createElement("span");
  pill.className = `status-pill ${kind}`;
  const dot = document.createElement("span");
  dot.className = "dot";
  pill.append(dot, text);
  target.replaceChildren(pill);
}
