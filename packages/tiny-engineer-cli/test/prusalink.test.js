import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  PRINTER_SESSION_ID,
  animationForTransition,
  digestAuthorization,
  fetchPrinterState,
  parseDigestChallenge,
  parsePrusaLinkArgs,
  postPrinterAnimation,
} from "../src/commands/prusalink.js";
import { decide, emptyState, writeSessionState, readSessionState } from "../src/integrations/claude-code/sessions.js";
import { ANIM_NAMES } from "../src/robot/client.js";

test("transitions: start and finish only", () => {
  assert.equal(animationForTransition("IDLE", "PRINTING"), "print_start");
  assert.equal(animationForTransition("BUSY", "PRINTING"), "print_start");
  assert.equal(animationForTransition("FINISHED", "PRINTING"), "print_start");
  assert.equal(animationForTransition("PRINTING", "FINISHED"), "ring");
  assert.equal(animationForTransition("PAUSED", "FINISHED"), "ring");
  // Already printing when the watcher starts: not a new start.
  assert.equal(animationForTransition(null, "PRINTING"), null);
  // Pause/resume and repeated states are quiet.
  assert.equal(animationForTransition("PRINTING", "PAUSED"), null);
  assert.equal(animationForTransition("PAUSED", "PRINTING"), null);
  assert.equal(animationForTransition("PRINTING", "PRINTING"), null);
  // FINISHED without a print we saw (e.g. watcher started late) is quiet.
  assert.equal(animationForTransition("IDLE", "FINISHED"), null);
  assert.equal(animationForTransition("PRINTING", "STOPPED"), null);
});

test("both animations exist in the firmware allow-list", () => {
  assert.ok(ANIM_NAMES.has("print_start"));
  assert.ok(ANIM_NAMES.has("ring"));
});

test("digest: RFC 2617 section 3.5 example", () => {
  const challenge = parseDigestChallenge(
    'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"',
  );
  assert.deepEqual(challenge, {
    realm: "testrealm@host.com",
    qop: "auth,auth-int",
    nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093",
    opaque: "5ccc069c403ebaf9f0171e9517f40e41",
  });
  const header = digestAuthorization({
    user: "Mufasa",
    password: "Circle Of Life",
    method: "GET",
    uri: "/dir/index.html",
    challenge,
    cnonce: "0a4f113b",
    nc: 1,
  });
  assert.match(header, /response="6629fae49393a05397450978507c4ef1"/);
  assert.match(header, /qop=auth, nc=00000001, cnonce="0a4f113b"/);
  assert.match(header, /opaque="5ccc069c403ebaf9f0171e9517f40e41"/);
});

test("digest without qop and bad challenges", () => {
  const challenge = parseDigestChallenge('Digest realm="Printer API", nonce="abc"');
  const header = digestAuthorization({ user: "maker", password: "pw", method: "GET", uri: "/api/v1/status", challenge, cnonce: "x" });
  assert.doesNotMatch(header, /qop=/);
  assert.equal(parseDigestChallenge('Basic realm="x"'), null);
  assert.equal(parseDigestChallenge(null), null);
});

/** Fake PrusaLink: Digest-protected status endpoint. */
function fakePrinter(state, { password = "secret" } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const auth = init.headers.Authorization;
    if (!auth && !init.headers["X-Api-Key"]) {
      return new Response("", {
        status: 401,
        headers: { "WWW-Authenticate": 'Digest realm="Printer API", nonce="n1", qop="auth"' },
      });
    }
    if (init.headers["X-Api-Key"] && init.headers["X-Api-Key"] !== "key1") return new Response("", { status: 401 });
    if (auth && !auth.includes('username="maker"')) return new Response("", { status: 401 });
    if (auth) {
      // Verify the response hash the way the printer would.
      const expected = digestAuthorization({
        user: "maker",
        password,
        method: "GET",
        uri: "/api/v1/status",
        challenge: { realm: "Printer API", nonce: "n1", qop: "auth" },
        cnonce: /cnonce="([^"]+)"/.exec(auth)[1],
      });
      if (expected !== auth) return new Response("", { status: 401 });
    }
    return Response.json({ printer: { state } });
  };
  return { fetchFn, calls };
}

test("fetchPrinterState: digest handshake", async () => {
  const { fetchFn, calls } = fakePrinter("Printing");
  const state = await fetchPrinterState({ url: "http://printer/", password: "secret", fetchFn });
  assert.equal(state, "PRINTING");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "http://printer/api/v1/status");
});

test("fetchPrinterState: wrong password and api key", async () => {
  const { fetchFn } = fakePrinter("IDLE");
  await assert.rejects(fetchPrinterState({ url: "http://p", password: "nope", fetchFn }), /refused the credentials/);
  assert.equal(await fetchPrinterState({ url: "http://p", apiKey: "key1", fetchFn }), "IDLE");
});

test("postPrinterAnimation hands the pose back to a working Claude session", async () => {
  const dir = mkdtempSync(join(tmpdir(), "te-prusa-"));
  const statePath = join(dir, "s.json");
  writeSessionState(statePath, decide(emptyState(), { sessionId: "claude-a", event: "PreToolUse", anim: "typing" }, 1000).state);

  const posted = [];
  const setAnim = async (anim) => {
    posted.push(anim);
    return { ok: true };
  };
  await postPrinterAnimation("ring", {}, { setAnim, statePath, now: () => 2000, sleep: async () => {} });
  assert.deepEqual(posted, ["ring", "typing"]);
  assert.equal(readSessionState(statePath).sessions[PRINTER_SESSION_ID].status, "idle");
});

test("postPrinterAnimation alone just posts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "te-prusa-"));
  const posted = [];
  await postPrinterAnimation("print_start", {}, {
    setAnim: async (anim) => {
      posted.push(anim);
      return { ok: true };
    },
    statePath: join(dir, "s.json"),
    sleep: async () => {},
  });
  assert.deepEqual(posted, ["print_start"]);
});

test("args: required printer and credentials, interval bounds", () => {
  const saved = { ...process.env };
  for (const key of ["PRUSALINK_URL", "PRUSALINK_PASSWORD", "PRUSALINK_API_KEY", "PRUSALINK_USER"]) delete process.env[key];
  try {
    assert.match(parsePrusaLinkArgs([]).error, /--printer/);
    assert.match(parsePrusaLinkArgs(["--printer", "http://p"]).error, /--password/);
    const ok = parsePrusaLinkArgs(["--printer=http://p", "--password", "pw", "--interval", "10"]);
    assert.equal(ok.error, undefined);
    assert.equal(ok.interval, 10);
    assert.equal(ok.user, "maker");
    assert.match(parsePrusaLinkArgs(["--printer", "http://p", "--password", "pw", "--interval", "0"]).error, /interval/);
    assert.match(parsePrusaLinkArgs(["--bogus"]).error, /unknown option/);
    process.env.PRUSALINK_URL = "http://env";
    process.env.PRUSALINK_PASSWORD = "envpw";
    assert.equal(parsePrusaLinkArgs([]).printer, "http://env");
  } finally {
    process.env = saved;
  }
});
