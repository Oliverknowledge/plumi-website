import type { DoorKind } from "./types";

/**
 * WHERE YOU ARE: the town, or inside a building. A small pure state machine (the dev page drives it with React's useReducer; tests drive it directly).
 *
 *   town --door(library)--> fadeOut(0.35 s) --fade-done--> interior(library) fadeIn --fade-done--> idle
 *   interior --exit--> fadeOut --fade-done--> town (at the door you came in by) fadeIn --fade-done--> idle
 *
 * Only the library and the cafe have an interior drawn; every other door answers with a calm line and no transition (`closedLine`). While a fade
 * runs, doors and exits are ignored (a double tap cannot stack two transitions). `placeKey` is the string that `lobby_set_position` can carry when
 * the town is multiplayer: "town", or "in:library" / "in:cafe" (the same ids the library's room list uses).
 */
export type InteriorId = "library" | "cafe";
export type Place = { kind: "town" } | { kind: "interior"; id: InteriorId };
export type Phase = "idle" | "fadeOut" | "fadeIn";

export interface PlaceState {
  place: Place;
  phase: Phase;
  /** Where the fade is taking you (null when idle). */
  target: Place | null;
  /** The town door you went in by: you come out in front of it. */
  door: string | null;
}
export type PlaceEvent = { t: "door"; id: string; kind: DoorKind } | { t: "exit" } | { t: "fade-done" };
/** What the page must do after an event. */
export type PlaceEffect = { t: "toast"; text: string } | { t: "mount"; id: InteriorId } | { t: "unmount"; id: InteriorId; door: string | null } | { t: "restore"; door: string | null } | null;

export const FADE_MS = 350;                         // the library's entry fade
export const CLOSED = "Closed for now";
export const TOWN: Place = { kind: "town" };
export const initialPlace: PlaceState = { place: TOWN, phase: "idle", target: null, door: null };

/** The interior a door leads to, if one is drawn. */
export function interiorFor(kind: DoorKind): InteriorId | null { return kind === "library" ? "library" : kind === "cafe" ? "cafe" : null; }
export const placeKey = (p: Place): string => (p.kind === "town" ? "town" : `in:${p.id}`);
export function parsePlaceKey(k: string): Place | null {
  if (k === "town") return TOWN;
  if (k === "in:library" || k === "in:cafe") return { kind: "interior", id: k.slice(3) as InteriorId };
  return null;
}
export const samePlace = (a: Place, b: Place) => placeKey(a) === placeKey(b);

export function stepPlace(s: PlaceState, e: PlaceEvent): { state: PlaceState; effect: PlaceEffect } {
  if (e.t === "door") {
    if (s.phase !== "idle" || s.place.kind !== "town") return { state: s, effect: null };
    const id = interiorFor(e.kind);
    if (!id) return { state: s, effect: { t: "toast", text: CLOSED } };
    return { state: { place: s.place, phase: "fadeOut", target: { kind: "interior", id }, door: e.id }, effect: null };
  }
  if (e.t === "exit") {
    if (s.phase !== "idle" || s.place.kind !== "interior") return { state: s, effect: null };
    return { state: { ...s, phase: "fadeOut", target: TOWN }, effect: null };
  }
  // fade-done
  if (s.phase === "fadeOut" && s.target) {
    const was = s.place, to = s.target;
    const effect: PlaceEffect = to.kind === "interior" ? { t: "mount", id: to.id } : was.kind === "interior" ? { t: "unmount", id: was.id, door: s.door } : null;
    return { state: { place: to, phase: "fadeIn", target: null, door: s.door }, effect: to.kind === "town" ? { t: "restore", door: s.door } : effect };
  }
  if (s.phase === "fadeIn") return { state: { ...s, phase: "idle", door: s.place.kind === "town" ? null : s.door }, effect: null };
  return { state: s, effect: null };
}
