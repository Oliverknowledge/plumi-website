import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canonicalPath, hostPath, isStudyHostname, routeFor, studyEntry } from "./routing";

const S = "study.tryplumi.app";
const M = "tryplumi.app";

describe("the app's own host", () => {
  test("the three places are served from /study, with the address bar unchanged", () => {
    assert.deepEqual(routeFor(S, "/"), { kind: "rewrite", to: "/study" });
    assert.deepEqual(routeFor(S, "/library"), { kind: "rewrite", to: "/study/library" });
    assert.deepEqual(routeFor(S, "/flashcards/", "?deck=x"), { kind: "rewrite", to: "/study/flashcards?deck=x" });
  });
  test("the /study prefix is never shown: it redirects to the clean path", () => {
    assert.deepEqual(routeFor(S, "/study"), { kind: "redirect", to: "/" });
    assert.deepEqual(routeFor(S, "/study/library"), { kind: "redirect", to: "/library" });
    assert.deepEqual(routeFor(S, "/study/flashcards", "?a=1"), { kind: "redirect", to: "/flashcards?a=1" });
  });
  test("sign-in, sign-up and the return trip are served as they are", () => {
    for (const p of ["/sign-in", "/sign-up", "/auth/callback"]) assert.deepEqual(routeFor(S, p), { kind: "pass" }, p);
  });
  test("the design-system pages and Next's own paths pass", () => {
    for (const p of ["/study/design", "/study/dashboards/a", "/_next/data/x", "/api/x"]) assert.deepEqual(routeFor(S, p), { kind: "pass" }, p);
  });
  test("marketing pages are not here: they go to tryplumi.app, query kept", () => {
    assert.deepEqual(routeFor(S, "/terms"), { kind: "redirect", to: "https://tryplumi.app/terms" });
    assert.deepEqual(routeFor(S, "/question-bank/x", "?y=1"), { kind: "redirect", to: "https://tryplumi.app/question-bank/x?y=1" });
  });
  test("robots: the app is not for search", () => {
    assert.deepEqual(routeFor(S, "/robots.txt"), { kind: "robots" });
  });
  test("the host is read case-insensitively and without its port; study.localhost works for trying it", () => {
    assert.equal(isStudyHostname("STUDY.tryplumi.app:443"), true);
    assert.equal(isStudyHostname("study.localhost:3100"), true);
    assert.equal(isStudyHostname("tryplumi.app"), false);
    assert.equal(isStudyHostname("notstudy.tryplumi.app"), false);
    assert.equal(isStudyHostname("study.tryplumi.app.evil.com"), false);
  });
});

describe("the main site and everything else", () => {
  test("the old /study addresses go to the app's host", () => {
    assert.deepEqual(routeFor(M, "/study"), { kind: "redirect", to: "https://study.tryplumi.app" });
    assert.deepEqual(routeFor("www.tryplumi.app", "/study/library"), { kind: "redirect", to: "https://study.tryplumi.app/library" });
    assert.deepEqual(routeFor(M, "/study/flashcards", "?a=1"), { kind: "redirect", to: "https://study.tryplumi.app/flashcards?a=1" });
  });
  test("the design-system pages stay where they are", () => {
    assert.deepEqual(routeFor(M, "/study/design"), { kind: "pass" });
  });
  test("marketing pages pass untouched", () => {
    for (const p of ["/", "/about", "/question-bank", "/sign-in"]) assert.deepEqual(routeFor(M, p), { kind: "pass" }, p);
  });
  test("localhost and previews are left alone: the app is under /study there", () => {
    for (const h of ["localhost:3000", "127.0.0.1:3000", "plumi-website-git-x.vercel.app"]) {
      assert.deepEqual(routeFor(h, "/study/library"), { kind: "pass" }, h);
      assert.deepEqual(routeFor(h, "/"), { kind: "pass" }, h);
    }
  });
});

describe("where Log in and Get started go", () => {
  test("production: the app's host", () => {
    assert.equal(studyEntry("login", M), "https://study.tryplumi.app");
    assert.equal(studyEntry("start", "www.tryplumi.app"), "https://study.tryplumi.app/sign-up");
  });
  test("localhost and previews stay put", () => {
    assert.equal(studyEntry("login", "localhost"), "/study");
    assert.equal(studyEntry("start", "plumi-x.vercel.app"), "/sign-up?next=%2Fstudy");
  });
});

describe("canonical and visible paths", () => {
  test("on the app's host the /study prefix goes", () => {
    assert.equal(hostPath(true, "/study"), "/");
    assert.equal(hostPath(true, "/study/library"), "/library");
    assert.equal(hostPath(false, "/study/library"), "/study/library");
    assert.equal(hostPath(true, "/sign-in?x=1"), "/sign-in?x=1");
  });
  test("a visible path comes back to its canonical form", () => {
    assert.equal(canonicalPath("/"), "/study");
    assert.equal(canonicalPath("/library"), "/study/library");
    assert.equal(canonicalPath("/study/flashcards"), "/study/flashcards");
    assert.equal(canonicalPath("/study"), "/study");
  });
});
