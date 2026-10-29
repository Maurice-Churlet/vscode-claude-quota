// Lecture du cache d'utilisation de Claude Code (clé `cachedUsageUtilization` de ~/.claude.json).
// Claude Code écrit cette clé chaque fois qu'il affiche l'utilisation (/usage, panneau « Account & usage »).
// On ne lit QUE cette clé : aucun identifiant, aucun appel réseau.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const CACHE_KEY = "cachedUsageUtilization";

function claudeJsonPath() {
  return path.join(os.homedir(), ".claude.json");
}

function toDate(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toPercent(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Transforme le cache en liste de jauges : [{ label, percent, resetsAt }], la session (5 h) en premier.
// Renvoie null si le cache est absent ou illisible.
function parseCache(cache) {
  if (!cache || typeof cache !== "object") return null;
  const util = cache.utilization;
  if (!util || typeof util !== "object") return null;

  const gauges = [];
  if (Array.isArray(util.limits) && util.limits.length > 0) {
    for (const lim of util.limits) {
      if (!lim || typeof lim !== "object") continue;
      const percent = toPercent(lim.percent);
      if (percent === null) continue;
      let label = null;
      if (lim.kind === "session") label = "5 h";
      else if (lim.kind === "weekly_all") label = "Semaine";
      else if (lim.kind === "weekly_scoped") {
        const name = lim.scope && lim.scope.model && lim.scope.model.display_name;
        if (typeof name === "string" && name.trim()) label = name.trim();
      }
      if (label) gauges.push({ label, percent, resetsAt: toDate(lim.resets_at) });
    }
  } else {
    // Ancien format : fenêtres nommées seulement
    for (const [key, label] of [["five_hour", "5 h"], ["seven_day", "Semaine"]]) {
      const w = util[key];
      const percent = w && toPercent(w.utilization);
      if (percent !== null && percent !== undefined) {
        gauges.push({ label, percent, resetsAt: toDate(w.resets_at) });
      }
    }
  }
  if (gauges.length === 0) return null;
  return { fetchedAt: toDate(cache.fetchedAtMs), gauges };
}

// Lit le fichier et renvoie le résultat de parseCache, ou null (fichier absent, en cours d'écriture…).
function readQuota(file = claudeJsonPath()) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  return parseCache(data && data[CACHE_KEY]);
}

// Vrai si l'heure de remise à zéro de la jauge est passée (le pourcentage relevé ne vaut plus).
function isExpired(gauge, now = new Date()) {
  return Boolean(gauge.resetsAt) && gauge.resetsAt <= now;
}

// Niveau d'alerte d'après la jauge la plus haute : "ok", "warning" ou "error".
function severity(gauges, warnAt = 75, errorAt = 90) {
  if (gauges.length === 0) return "ok";
  const max = Math.max(...gauges.map((g) => g.percent));
  if (max >= errorAt) return "error";
  if (max >= warnAt) return "warning";
  return "ok";
}

function formatAge(fetchedAt, now = new Date()) {
  if (!fetchedAt) return "heure inconnue";
  const minutes = Math.max(0, Math.round((now - fetchedAt) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

function formatReset(resetsAt, now = new Date()) {
  if (!resetsAt) return "";
  const sameDay = resetsAt.toDateString() === now.toDateString();
  const time = resetsAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `remise à zéro à ${time}`;
  const day = resetsAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "numeric" });
  return `remise à zéro ${day} à ${time}`;
}

module.exports = { claudeJsonPath, parseCache, readQuota, isExpired, severity, formatAge, formatReset };
