"use client";

import { useEffect, useMemo, useState } from "react";
import { accountsOn, useAccount } from "@/lib/account";
import { useLibrary } from "@/lib/library";
import { browserDriver } from "@/lib/studyapp/library/browserDriver";
import { publishLive } from "@/lib/studyapp/live";
import { JoinCard, SignedOutCard, Waiting } from "./Cards";
import { LibraryRoom } from "./Library";

/**
 * Study is the Grand Library. Signed out: what it is, and a way in. Signed in but not joined: a name and a colour.
 * Joined: the room, with real students in it. Until the server has answered nothing is claimed, here or on the
 * Desk (publishLive).
 */
export function LibraryPage() {
  const account = useAccount();
  const lib = useLibrary();
  const uid = account.user?.id ?? null;
  const joined = !!lib.profile;
  const [base] = useState(() => (typeof window === "undefined" ? null : browserDriver()));
  const driver = useMemo(() => (base && uid ? { ...base, me: uid.toLowerCase() } : null), [base, uid]);

  useEffect(() => {
    if (!accountsOn) publishLive({ state: "off", revising: null, friendsIn: [] });
    else if (account.ready && !uid) publishLive({ state: "signedOut", revising: null, friendsIn: [] });
    else if (uid && lib.checked && !joined) publishLive({ state: "notJoined", revising: null, friendsIn: [] });
  }, [account.ready, uid, lib.checked, joined]);

  if (!accountsOn) return <SignedOutCard accountsOn={false} />;
  if (!account.ready) return <Waiting />;
  if (!uid) return <SignedOutCard accountsOn />;
  if (!lib.checked) return <Waiting />;
  if (!joined) return <JoinCard accountName={account.name} />;
  if (!driver) return <Waiting />;
  return <LibraryRoom key={uid} driver={driver} />;
}
