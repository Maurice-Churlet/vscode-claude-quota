"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const quota = require("../src/quota");

const CACHE = {
  fetchedAtMs: Date.parse("2026-10-29T02:49:49Z"),
  utilization: {
    five_hour: { utilization: 17, resets_at: "2026-10-29T05:30:00+00:00" },
    seven_day: { utilization: 21, resets_at: "2026-11-02T10:00:00+00:00" },
    limits: [
      { kind: "session", percent: 17, resets_at: "2026-10-29T05:30:00+00:00", scope: null },
      { kind: "weekly_all", percent: 21, resets_at: "2026-11-02T10:00:00+00:00", scope: null },
      { kind: "weekly_scoped", percent: 14, resets_at: "2026-11-02T10:00:00+00:00",
        scope: { model: { id: null, display_name: "Fable" } } },
      { kind: "inconnu", percent: 50 },
    ],
  },
};

test("liste limits : session, semaine, puis modèle ; type inconnu ignoré", () => {
  const r = quota.parseCache(CACHE);
  assert.deepStrictEqual(r.gauges.map((g) => [g.label, g.percent]), [["5 h", 17], ["Semaine", 21], ["Fable", 14]]);
  assert.strictEqual(r.fetchedAt.toISOString(), "2026-10-29T02:49:49.000Z");
});

test("ancien format sans liste limits", () => {
  const old = { fetchedAtMs: 0, utilization: { five_hour: { utilization: 5 }, seven_day: { utilization: 9 } } };
  assert.deepStrictEqual(quota.parseCache(old).gauges.map((g) => g.percent), [5, 9]);
});

test("cache absent ou malformé : null, jamais d'exception", () => {
  for (const bad of [null, undefined, 3, {}, { utilization: null }, { utilization: { limits: [] } },
    { utilization: { limits: [{ kind: "session", percent: "x" }] } }]) {
    assert.strictEqual(quota.parseCache(bad), null);
  }
});

test("readQuota : fichier absent ou JSON tronqué → null", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quota-"));
  assert.strictEqual(quota.readQuota(path.join(dir, "absent.json")), null);
  const broken = path.join(dir, "tronque.json");
  fs.writeFileSync(broken, '{"cachedUsageUtilization": {');
  assert.strictEqual(quota.readQuota(broken), null);
  const good = path.join(dir, "bon.json");
  fs.writeFileSync(good, JSON.stringify({ autre: 1, cachedUsageUtilization: CACHE }));
  assert.strictEqual(quota.readQuota(good).gauges.length, 3);
});

test("niveau d'alerte d'après la jauge la plus haute", () => {
  const g = (p) => [{ percent: 10 }, { percent: p }];
  assert.strictEqual(quota.severity(g(74)), "ok");
  assert.strictEqual(quota.severity(g(75)), "warning");
  assert.strictEqual(quota.severity(g(90)), "error");
});

test("âge du relevé", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  assert.strictEqual(quota.formatAge(null, now), "heure inconnue");
  assert.strictEqual(quota.formatAge(new Date("2026-10-29T11:59:50Z"), now), "à l'instant");
  assert.strictEqual(quota.formatAge(new Date("2026-10-29T11:48:00Z"), now), "il y a 12 min");
  assert.strictEqual(quota.formatAge(new Date("2026-10-29T10:55:00Z"), now), "il y a 1 h 05");
});

test("jauge expirée après sa remise à zéro ; aucune jauge → ok", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  assert.strictEqual(quota.isExpired({ resetsAt: new Date("2026-10-29T11:00:00Z") }, now), true);
  assert.strictEqual(quota.isExpired({ resetsAt: new Date("2026-10-29T13:00:00Z") }, now), false);
  assert.strictEqual(quota.isExpired({ resetsAt: null }, now), false);
  assert.strictEqual(quota.severity([]), "ok");
});

const claude = require("../src/claude");
const path2 = require("path");

test("findClaude : .exe préféré selon PATHEXT, null si absent", () => {
  const dir = path2.join("C:", "outils");
  const exe = path2.join(dir, "claude.exe");
  const env = { PATH: dir, PATHEXT: ".EXE;.CMD" };
  assert.strictEqual(claude.findClaude(env, "win32", (p) => p === exe), exe);
  assert.strictEqual(claude.findClaude(env, "win32", () => false), null);
});

test("arguments : pas de transcript, aucun serveur MCP", () => {
  assert.ok(claude.USAGE_ARGS.includes("--no-session-persistence"));
  assert.ok(claude.USAGE_ARGS.includes("--strict-mcp-config"));
});
