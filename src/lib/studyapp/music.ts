"use client";

import { useSyncExternalStore } from "react";

/**
 * Lofi to study to: the record player in the corner of every page of the app (components/studyapp/Vinyl.tsx).
 * Lofi only, from Lofi Girl's own "beats to relax/study to" playlist, played through Spotify's embedded player
 * (licensed for this; no audio is hosted here). Students logged in to Spotify in this browser hear whole songs;
 * everyone else hears Spotify's 30-second previews, and is told so once.
 *
 * One player for the whole visit. It lives in the app's layout, so moving between Desk, Study and Flashcards
 * never stops the music. It never starts by itself: only a tap on the record starts it, and another stops it.
 * ⏮ / ⏭ skip (looping round), songs run on into the next, and the Spotify card can be tucked away so only the
 * record shows. The songs come in a fresh order every visit.
 */
export interface LofiTrack { uri: string; title: string; artist: string }

export const LOFI: LofiTrack[] = [
  { uri: "spotify:track:5ldTs3o6tlgE9ojhuCRr6t", title: "Library Keeper", artist: "L'Indécis, ØDYSSEE" },
  { uri: "spotify:track:7ble7XDyoFpQnnha14WAa3", title: "Misty Meadows", artist: "eleven, Mondo Loops" },
  { uri: "spotify:track:0FDjb05V8hic4pzjuBaKJF", title: "Circadian", artist: "S N U G, Enluv" },
  { uri: "spotify:track:4sf1FeqHwex1KYL5iMWMPM", title: "neko", artist: "azayaka" },
  { uri: "spotify:track:5Yu9v7xxTx8Hg4AZWG71wG", title: "Spindrift", artist: "Ambulo, mell-ø" },
  { uri: "spotify:track:6R443qtbDiF26j6yeNQka3", title: "morning moon", artist: "Kanisan, Wishes and Dreams" },
  { uri: "spotify:track:69gKaqjIlVM49885vXqWLm", title: "Leaves let go", artist: "Casiio, No Spirit" },
  { uri: "spotify:track:7KY5pvVRJ5Ancqike7fDeh", title: "Afloat", artist: "Yasumu" },
  { uri: "spotify:track:4RXA8ziHSVeGMQVHqjO89p", title: "Exhale", artist: "No Spirit" },
  { uri: "spotify:track:3NmWLESV4bmTq6q9CicnbO", title: "Zenith", artist: "Purrple Cat" },
  { uri: "spotify:track:1B7y3XfbOHWPkSaOUnZAG2", title: "Lune", artist: "Hoogway, softy" },
  { uri: "spotify:track:2ziKkGJzqLbML7NV8Seg6L", title: "Fireflies", artist: "amies, cxlt." },
];

/** The record's label changes colour with each song, through the app's own colours. */
const LABELS = ["#2f62c8", "#f2c96b", "#6fae5a", "#e0605a", "#a98be0", "#4fb3ad"];

export interface LofiState {
  track: LofiTrack;
  label: string;
  playing: boolean;      // Spotify says it is playing
  wanted: boolean;       // the student wants it playing
  begun: boolean;        // played once this visit: the buttons beside the record show
  everPlayed: boolean;   // played on an earlier visit: no "tap for lofi" label
  cardHidden: boolean;   // the student tucked the Spotify card away
  cardOpen: boolean;
  line: string | null;   // a note under the player
}

const CARD_KEY = "plumi-study-music-card";
const ON_KEY = "plumi-study-music";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private browsing */ } };

interface Update { isPaused?: boolean; position?: number; duration?: number; playingURI?: string }
interface Controller {
  loadUri(uri: string): void;
  play(): void;
  resume?(): void;
  pause(): void;
  addListener(event: "playback_update", fn: (e: { data?: Update }) => void): void;
}
interface IframeApi {
  createController(el: HTMLElement, options: { uri: string; width: string; height: number }, ready: (c: Controller) => void): void;
}
declare global { interface Window { onSpotifyIframeApiReady?: (api: IframeApi) => void } }

const TAP_PLAY = "Tap ▶ in the player to start the music.";

class LofiPlayer {
  private order = shuffled(LOFI.length);
  private at = 0;                 // where we are in `order`
  private loaded = 0;             // which `at` the Spotify player holds
  private controller: Controller | null = null;
  private plain: HTMLIFrameElement | null = null;   // Spotify's remote control didn't load: its ordinary player instead
  private slot: HTMLElement | null = null;
  private requested = false;
  private wanted = false;
  private playing = false;
  private songStarted = false;    // this song has played, so resume rather than restart
  private begun = false;
  private forced = false;         // the card shows even if tucked away (Spotify needs a tap on its own ▶)
  private cardHidden = read(CARD_KEY) === "hidden";
  private everPlayed = read(ON_KEY) === "on";
  private line: string | null = null;
  private lastStart = 0;
  private toldPreview = false;
  private blocked: ReturnType<typeof setTimeout> | undefined;
  private endWatch: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  state: LofiState = this.make();

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };

  private track() { return LOFI[this.order[this.at]]; }
  private make(): LofiState {
    return {
      track: this.track(), label: LABELS[this.order[this.at] % LABELS.length],
      playing: this.playing, wanted: this.wanted, begun: this.begun, everPlayed: this.everPlayed,
      cardHidden: this.cardHidden, cardOpen: this.forced || (!this.cardHidden && (this.wanted || this.playing)), line: this.line,
    };
  }
  private changed() { this.state = this.make(); this.listeners.forEach((l) => l()); }
  private say(line: string | null) { this.line = line; }

  /** The card's slot for Spotify's player. Called by the record player when it appears; the player is got ready early, so a tap starts the music straight away. */
  attach(host: HTMLElement) {
    if (!this.slot) {
      this.slot = document.createElement("div");
      setTimeout(() => this.load(), 600);
    }
    const el = this.plain ?? this.slot;
    if (el.parentElement !== host) host.appendChild(el);
  }

  private setPlaying(on: boolean) {
    this.playing = on;
    if (on) {
      clearTimeout(this.blocked);
      this.forced = false;
      if (this.line === TAP_PLAY) this.say(null);
    }
    this.changed();
  }

  // When a song reaches its end, Spotify's last report has the position at the full length, sometimes without
  // saying it has paused. Then it's on to the next. (A report just after a skip is about the song before.)
  private finished(d: Update) {
    clearTimeout(this.endWatch);
    if (!(d.duration && d.duration > 0) || Date.now() - this.lastStart < 1500) return false;
    const left = d.duration - (d.position ?? 0);
    if (left > 400) {
      // If the reports stop just short of the end, move on anyway.
      if (!d.isPaused && left < 1500) this.endWatch = setTimeout(() => this.ended(d), left + 1500);
      return false;
    }
    this.ended(d);
    return true;
  }
  private ended(d: Update) {
    if ((d.duration ?? 0) < 31000 && !this.toldPreview) {
      this.toldPreview = true;
      this.say("These are Spotify’s 30-second previews. Log in to Spotify in this browser to hear whole songs.");
    }
    this.skip(1);
  }

  private load() {
    if (this.requested || !this.slot) return;
    this.requested = true;
    window.onSpotifyIframeApiReady = (api) => {
      if (!this.slot) return;
      api.createController(this.slot, { uri: this.track().uri, width: "100%", height: 80 }, (c) => {
        this.controller = c;
        this.loaded = this.at;
        c.addListener("playback_update", (e) => {
          const d = e.data ?? {};
          if (!this.songStarted) return;                                      // the player's opening report
          if (d.playingURI && d.playingURI !== this.track().uri) return;      // a report about the last song
          if (this.finished(d)) return;
          this.setPlaying(!d.isPaused);
        });
        if (this.wanted) this.start();
      });
    };
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    s.onerror = () => this.useFallback();
    document.head.appendChild(s);
    setTimeout(() => { if (!this.controller) this.useFallback(); }, 8000);
  }

  // Some browsers (or blockers) stop Spotify's remote control from loading. Then the card holds Spotify's
  // ordinary player: the student taps its own ▶, and ⏮ / ⏭ still change the song in it.
  private plainSrc() { return `https://open.spotify.com/embed/track/${this.track().uri.split(":").pop()}?utm_source=generator`; }
  private useFallback() {
    if (this.controller || this.plain || !this.slot) return;
    const f = document.createElement("iframe");
    f.src = this.plainSrc();
    f.width = "100%";
    f.height = "80";
    f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    f.title = `Spotify player: ${this.track().title}`;
    this.slot.replaceWith(f);
    this.plain = f;
    this.loaded = this.at;
    // The plain player still reports play, pause and the end of a song.
    window.addEventListener("message", (e) => {
      if (e.source !== f.contentWindow || e.data?.type !== "playback_update") return;
      const d: Update = e.data.payload ?? {};
      if (d.playingURI && d.playingURI !== this.track().uri) return;
      if (this.finished(d)) return;
      if (!d.isPaused) { this.wanted = true; this.begun = true; this.say(null); }
      this.setPlaying(!d.isPaused);
    });
    if (this.wanted) this.start();
  }

  private start() {
    if (this.plain) {
      if (this.loaded !== this.at) { this.plain.src = this.plainSrc(); this.plain.title = `Spotify player: ${this.track().title}`; this.loaded = this.at; }
      if (!this.playing) { this.say(TAP_PLAY); this.forced = true; }
      this.changed();
      return;
    }
    if (!this.controller) { this.load(); return; }
    if (this.loaded !== this.at) {
      this.controller.loadUri(this.track().uri);
      this.loaded = this.at;
      this.songStarted = false;
    }
    if (this.songStarted && this.controller.resume) this.controller.resume();
    else this.controller.play();
    this.songStarted = true;
    this.lastStart = Date.now();
    // A phone may refuse to let the page start Spotify: then ask for one tap on the player's own ▶ (showing
    // the card even if it's tucked away).
    clearTimeout(this.blocked);
    this.blocked = setTimeout(() => {
      if (this.wanted && !this.playing) { this.say(TAP_PLAY); this.forced = true; this.changed(); }
    }, 3000);
  }

  /** The record: play, or pause. */
  toggle() {
    const starting = this.wanted && Date.now() - this.lastStart < 3000;
    if (this.playing || starting) this.pause(); else this.play();
  }

  private play() {
    this.wanted = true;
    this.begun = true;
    this.everPlayed = true;
    write(ON_KEY, "on");
    this.changed();
    this.start();
  }

  private pause() {
    this.wanted = false;
    this.forced = false;
    clearTimeout(this.blocked);
    clearTimeout(this.endWatch);
    this.controller?.pause();
    if (this.plain) this.plain.src = this.plainSrc();      // reloading it stops the sound
    this.say(null);
    this.setPlaying(false);
  }

  /** Skip forwards (+1) or back (-1), looping round. */
  skip(dir: 1 | -1) {
    clearTimeout(this.endWatch);
    this.at = (this.at + dir + LOFI.length) % LOFI.length;
    this.songStarted = false;
    this.begun = true;
    if (this.controller) {
      this.controller.loadUri(this.track().uri);
      this.loaded = this.at;
    } else if (this.plain) {
      this.plain.src = this.plainSrc();
      this.plain.title = `Spotify player: ${this.track().title}`;
      this.loaded = this.at;
      this.playing = false;                                // the new song waits for a tap on ▶
    }
    this.changed();
    if (this.wanted || this.playing) { this.wanted = true; this.start(); }
  }

  /** Show or tuck away the Spotify card (remembered on this device). */
  toggleCard() {
    this.cardHidden = !this.cardHidden;
    write(CARD_KEY, this.cardHidden ? "hidden" : "shown");
    this.changed();
  }
}

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let player: LofiPlayer | null = null;
/** The one player, made on first use in the browser. */
export function lofi() { return (player ??= new LofiPlayer()); }

const SERVER: LofiState = {
  track: LOFI[0], label: LABELS[0], playing: false, wanted: false, begun: false, everPlayed: true,
  cardHidden: false, cardOpen: false, line: null,
};
export function useLofi(): LofiState {
  return useSyncExternalStore((cb) => lofi().subscribe(cb), () => lofi().state, () => SERVER);
}
