"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/studyapp/toast";
import { focusTag, subjectName } from "@/lib/social/lobby";
import type { SocialAvatar } from "@/lib/social/types";
import { useNow } from "@/lib/studyapp/clock";
import { friendStatus, friendsCount, inHeldOrder, streakWords, type FriendEntry, type RequestEntry } from "@/lib/studyapp/library/friends";
import type { LibrarySession, Snapshot } from "@/lib/studyapp/library/session";
import { Head } from "./Head";
import { PersonCard } from "./parts";

/**
 * The People panel: requests waiting on you, ALL your friends (the ones in this library first and lit, then those
 * studying elsewhere, then the rest), and everyone else in the room, each with their head. One scrolling area with
 * section headers that stay stuck to its top. Everything short; nothing a student cannot act on (docs/study/library.md,
 * "Friends list").
 *
 * STEADY UNDER A FINGER. The lists keep their order while a pointer is down on the panel and for a moment after it
 * scrolls (`inHeldOrder`): a friend sitting down mid-tap does not move the row you are about to press. Rows are
 * memoised and given plain strings, so a tick that changed nothing for a row does not redraw it.
 */

interface Held { friends: string[]; people: string[]; requests: string[] }
const SETTLE_MS = 350;

const Flame = () => (
  <svg viewBox="0 0 9 11" aria-hidden="true" focusable="false"><path d="M4.5 0C5 2 3 3 3 5.200 3 6 3.300 6.500 3.800 6.800 3.600 5.600 4.900 5 5.300 3.600 6.800 4.600 8 6 8 7.600A3.500 3.500 0 0 1 4.500 11 3.500 3.500 0 0 1 1 7.600C1 6.400 1.500 5.500 2.100 4.800 2.200 5.500 2.500 5.900 2.800 6 2.400 4 4 2 4.500 0Z" fill="currentColor" /></svg>
);
const Streak = ({ n }: { n: number }) => (
  <span className="lb-streak" role="img" aria-label={`${streakWords(n)} streak`}><Flame />{n}</span>
);

interface RowProps {
  id: string; avatar: SocialAvatar | null; colour: number; name: string; status: string | null; tag?: string; pro?: boolean;
  streak: number | null; here?: boolean; picked: boolean; testid: string; onTap: (id: string) => void;
}
const Row = memo(function Row({ id, avatar, colour, name, status, tag, pro, streak, here, picked, testid, onTap }: RowProps) {
  return (
    <li>
      <button type="button" className={`lb-prow${here ? " is-here" : ""}${picked ? " is-picked" : ""}`} aria-pressed={picked} data-testid={testid} data-id={id} onClick={() => onTap(id)}>
        <Head avatar={avatar} colour={colour} id={id} size={40} name={name} />
        <span className="lb-pmain">
          <span className="lb-pname"><span className="lb-pn2">{name}</span>{tag && <small>{tag}</small>}{pro && <small className="lb-pro">Pro</small>}</span>
          {status && <span className="lb-pstatus">{status}</span>}
        </span>
        {streak !== null && <Streak n={streak} />}
      </button>
    </li>
  );
});

const RequestRow = memo(function RequestRow({ r, busy, onAnswer }: { r: RequestEntry; busy: boolean; onAnswer: (id: string, accept: boolean) => void }) {
  return (
    <li className="lb-prow lb-req" data-testid="request-row" data-id={r.id}>
      <Head avatar={r.avatar} colour={r.colour} id={r.id} size={40} name={r.name} />
      <span className="lb-pmain">
        <span className="lb-pname"><span className="lb-pn2">{r.name}</span></span>
        <span className="lb-pstatus">{r.fromLibrary ? "from the library" : "wants to be friends"}</span>
      </span>
      <span className="lb-acts">
        <button type="button" className="btn gold lb-sm" disabled={busy} data-testid="request-accept" aria-label={`Accept ${r.name}`} onClick={() => onAnswer(r.id, true)}>Accept</button>
        <button type="button" className="btn lb-sm" disabled={busy} data-testid="request-decline" aria-label={`Not now, ${r.name}`} onClick={() => onAnswer(r.id, false)}>Not now</button>
      </span>
    </li>
  );
});

/** A friend who is not in this library: their name, streak and what they are doing, and Remove friend behind a confirm. */
function FriendCard({ session, friend, status, onClose }: { session: LibrarySession; friend: FriendEntry; status: string | null; onClose: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    const r = await session.removeFriend(friend.id);
    setBusy(false);
    toast(r.line);
    if (r.ok) onClose(); else setAsking(false);
  };
  return (
    <div className="lb-pcard" role="group" aria-label={friend.name} data-testid="friend-card">
      <div className="lb-ptop">
        <Head avatar={friend.avatar} colour={friend.colour} id={friend.id} size={56} label={friend.name} />
        <div>
          <b>{friend.name}</b>
          <div className="lb-tags">
            <span className="lb-tag">Friend</span>
            {friend.pro && <span className="lb-tag lb-pro">Plumi Pro</span>}
          </div>
        </div>
        <button type="button" className="btn ghost icon" aria-label="Close" onClick={onClose}>{"×"}</button>
      </div>
      {(friend.streak !== null || status) && (
        <dl className="lb-stats lb-stats2">
          {friend.streak !== null && <div><dt>Day streak</dt><dd>{streakWords(friend.streak)}</dd></div>}
          {status && <div><dt>Right now</dt><dd>{status}</dd></div>}
        </dl>
      )}
      {!asking ? (
        <div className="lb-row"><button type="button" className="btn ghost" data-testid="friend-remove" onClick={() => setAsking(true)}>Remove friend</button></div>
      ) : (
        <div className="lb-ask" role="group" aria-label={`Remove ${friend.name}?`}>
          <p>Remove {friend.name} from your friends?</p>
          <button type="button" className="btn gold" disabled={busy} data-testid="friend-remove-confirm" onClick={() => void remove()}>Remove</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setAsking(false)}>Keep</button>
        </div>
      )}
    </div>
  );
}

const Skeleton = () => (
  <ul className="lb-plist" aria-hidden="true" data-testid="friends-loading">
    {[0, 1, 2].map((i) => (
      <li key={i} className="lb-prow lb-skel"><span className="lb-hd s40 is-wait" /><span className="lb-pmain"><span className="lb-bar" style={{ width: `${52 + i * 14}%` }} /><span className="lb-bar is-short" /></span></li>
    ))}
  </ul>
);

export function WhoHere({ session, snap, you, picked, onPick, onPullUp }: {
  session: LibrarySession; snap: Snapshot; you: { avatar: SocialAvatar | null; colour: number };
  picked: string | null; onPick: (id: string | null) => void; onPullUp: (id: string) => void;
}) {
  const now = useNow(1000);
  const [friendOpen, setFriendOpen] = useState<string | null>(null);
  const [seenPicked, setSeenPicked] = useState<string | null>(picked);
  const [held, setHeld] = useState<Held | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const down = useRef(false);
  const scrolling = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLDivElement>(null);

  // Someone picked in the room replaces a friend's card (derived from props, as the React docs do it).
  if (picked !== seenPicked) { setSeenPicked(picked); if (picked !== null && friendOpen !== null) setFriendOpen(null); }

  // Opening the People tab reads the friends again at once (and the page reads them every minute while it is live).
  useEffect(() => { void session.refreshFriends(); }, [session]);
  // A different person picked: their card is at the top, so go there.
  useEffect(() => { area.current?.scrollTo({ top: 0 }); }, [picked]);

  const friends = snap.friends;
  const friendIds = new Set((friends ?? []).map((f) => f.id));
  const others = snap.people.filter((p) => !friendIds.has(p.id));
  const here = snap.people.length + 1;
  const open = snap.people.find((p) => p.id === picked) ?? null;
  const openFriend = !open && friendOpen ? (friends ?? []).find((f) => f.id === friendOpen) ?? null : null;

  const shownFriends = inHeldOrder(friends ?? [], held?.friends ?? null);
  const shownOthers = inHeldOrder(others, held?.people ?? null);
  const shownRequests = inHeldOrder(snap.requests, held?.requests ?? null);

  // Hold the order while a pointer is down on the panel, and for a moment after it scrolls.
  const hold = () => setHeld((h) => h ?? { friends: (friends ?? []).map((f) => f.id), people: others.map((p) => p.id), requests: snap.requests.map((r) => r.id) });
  useEffect(() => {
    const up = () => { down.current = false; if (!scrolling.current) setHeld(null); };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); if (settle.current) clearTimeout(settle.current); };
  }, []);
  const onScroll = () => {
    scrolling.current = true;
    hold();
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => { scrolling.current = false; if (!down.current) setHeld(null); }, SETTLE_MS);
  };

  // What a tap needs, kept in a ref so the rows' handler never changes and a row is not redrawn for it.
  const latest = useRef({ friends, picked, onPick });
  useEffect(() => { latest.current = { friends, picked, onPick }; });
  const tapFriend = useCallback((id: string) => {
    const { friends: all, picked: now, onPick: pick } = latest.current;
    if (all?.find((x) => x.id === id)?.here) { setFriendOpen(null); pick(id === now ? null : id); }
    else { pick(null); setFriendOpen((cur) => (cur === id ? null : id)); }
  }, []);
  const tapPerson = useCallback((id: string) => { const { picked: now, onPick: pick } = latest.current; setFriendOpen(null); pick(id === now ? null : id); }, []);

  const answer = useCallback(async (id: string, accept: boolean) => {
    setBusy((b) => new Set(b).add(id));
    const r = await session.answerRequest(id, accept);
    setBusy((b) => { const n = new Set(b); n.delete(id); return n; });
    toast(r.line);
  }, [session]);

  const youLine = snap.seated ? (snap.focusSince !== null ? subjectName(snap.subject) ?? "Focusing" : "Sitting") : "Standing";
  const nFriendsHere = (friends ?? []).filter((f) => f.here).length;

  return (
    <section className="card lb-card lb-pcardwrap" aria-label="People" data-testid="people-panel">
      <div className="lb-head">
        <h2>Who’s here</h2>
        <span className="lb-count">{here}{nFriendsHere ? ` · ${nFriendsHere} friend${nFriendsHere === 1 ? "" : "s"}` : ""}</span>
      </div>
      {open && <PersonCard key={open.id} session={session} person={open} now={now} onClose={() => onPick(null)} onPullUp={onPullUp} />}
      {openFriend && <FriendCard key={openFriend.id} session={session} friend={openFriend} status={friendStatus(openFriend, now)} onClose={() => setFriendOpen(null)} />}

      <div className="lb-pscroll" ref={area} data-testid="people-scroll" tabIndex={-1}
        onPointerDown={() => { down.current = true; hold(); }} onScroll={onScroll}>
        {snap.requests.length > 0 && (
          <section className="lb-sec" aria-labelledby="lb-h-req" data-testid="sec-requests">
            <h3 className="lb-sh" id="lb-h-req">Requests<span>{snap.requests.length}</span></h3>
            <ul className="lb-plist">
              {shownRequests.map((r) => <RequestRow key={r.id} r={r} busy={busy.has(r.id)} onAnswer={answer} />)}
            </ul>
          </section>
        )}

        <section className="lb-sec" aria-labelledby="lb-h-fr" data-testid="sec-friends">
          <h3 className="lb-sh" id="lb-h-fr">Friends<span>{friends && friends.length > 0 ? friendsCount(friends) : ""}</span></h3>
          {friends === null ? <Skeleton /> : friends.length === 0 ? (
            <div className="lb-none" data-testid="friends-empty">
              <span className="lb-ghosts" aria-hidden="true"><i /><i /><i /></span>
              <b>No friends here yet</b>
              <span>{session.canRequestFriends ? "Your friend code is in the iPad app, or tap Add friend on someone’s card." : "Your friend code is in the iPad app."}</span>
            </div>
          ) : (
            <ul className="lb-plist" data-testid="friends-list">
              {shownFriends.map((f) => (
                <Row key={f.id} id={f.id} avatar={f.avatar} colour={f.colour} name={f.name} pro={f.pro} status={friendStatus(f, now)} streak={f.streak}
                  here={!!f.here} picked={f.here ? f.id === picked : f.id === friendOpen} testid="friend-row" onTap={tapFriend} />
              ))}
            </ul>
          )}
        </section>

        <section className="lb-sec" aria-labelledby="lb-h-lib" data-testid="sec-library">
          <h3 className="lb-sh" id="lb-h-lib">In the library<span>{here}</span></h3>
          <ul className="lb-plist" data-testid="library-list">
            <li className="lb-prow is-you" data-testid="you-row">
              <Head avatar={you.avatar} colour={you.colour} id={session.meId} size={40} name="You" />
              <span className="lb-pmain"><span className="lb-pname"><span className="lb-pn2">You</span></span><span className="lb-pstatus">{youLine}</span></span>
            </li>
            {shownOthers.map((p) => (
              <Row key={p.id} id={p.id} avatar={p.avatar} colour={p.colour} name={p.isFriend && p.displayName ? p.displayName : p.nickname} tag={p.isFriend ? "Friend" : undefined} pro={p.pro}
                status={focusTag(p, now) ?? (p.seated ? "Sitting" : null)} streak={null} picked={p.id === picked} testid="library-row" onTap={tapPerson} />
            ))}
          </ul>
          {others.length === 0 && <p className="lb-empty">Just you for now</p>}
        </section>
      </div>
    </section>
  );
}
