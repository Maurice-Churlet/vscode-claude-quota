// Quota Claude dans la barre d'état de VS Code.
// Source : le cache que Claude Code tient lui-même (voir src/quota.js). Le clic lance `claude -p /usage`,
// commande locale de Claude Code qui met ce cache à jour sans consommer de tokens (voir src/claude.js).

"use strict";

const vscode = require("vscode");
const fs = require("fs");
const quota = require("./src/quota");
const claude = require("./src/claude");

const REFRESH_COMMAND = "claudeQuota.refresh";
const MIN_AUTO_GAP_MS = 5 * 60 * 1000; // le serveur d'utilisation limite les appels : on reste sobre
const STALE_AFTER_MS = 60 * 60 * 1000;

let item;
let lastGood = null; // dernier relevé lisible : gardé si le fichier est en cours d'écriture
let readFailed = false;
let refreshing = false;
let lastRefreshAt = 0;
let autoTimer;

function settings() {
  const cfg = vscode.workspace.getConfiguration("claudeQuota");
  return {
    autoRefreshMinutes: cfg.get("autoRefreshMinutes", 30),
    warnAt: cfg.get("warnAt", 75),
    errorAt: cfg.get("errorAt", 90),
    showModels: cfg.get("showModels", true),
  };
}

// Relit le fichier (seulement quand il change ou après un rafraîchissement)
function reload() {
  const result = quota.readQuota();
  readFailed = result === null;
  if (result) lastGood = result;
  render();
}

function render() {
  const cfg = settings();
  if (!lastGood) {
    item.text = refreshing ? "$(sync~spin) Claude : —" : "$(pulse) Claude : —";
    item.tooltip = "Quota inconnu. Cliquer pour le relever (ou taper /usage dans Claude Code).";
    item.backgroundColor = undefined;
    return;
  }
  const now = new Date();
  const stale = readFailed || !lastGood.fetchedAt || now - lastGood.fetchedAt > STALE_AFTER_MS;
  // Une jauge dont l'heure de remise à zéro est passée ne vaut plus rien
  const gauges = lastGood.gauges.map((g) => ({ ...g, expired: quota.isExpired(g, now) }));
  const shown = gauges.filter((g, i) => cfg.showModels || i < 2);
  const prefix = refreshing ? "$(sync~spin)" : "$(pulse)";
  const parts = shown.map((g) => `${g.label} ${g.expired ? "?" : `${Math.round(g.percent)} %`}`);
  item.text = `${prefix} ${parts.join(" · ")}${stale ? " ~" : ""}`;

  const md = new vscode.MarkdownString();
  md.appendMarkdown("**Quota Claude**\n\n");
  for (const g of gauges) {
    const detail = g.expired ? "remise à zéro passée : relevé à refaire" : quota.formatReset(g.resetsAt, now);
    md.appendMarkdown(`- ${g.label} : **${g.expired ? "?" : `${Math.round(g.percent)} %`}**${detail ? ` (${detail})` : ""}\n`);
  }
  md.appendMarkdown(`\nRelevé ${quota.formatAge(lastGood.fetchedAt, now)}${stale ? " (ancien : le « ~ » le signale)" : ""}.`);
  md.appendMarkdown("\n\nCliquer pour rafraîchir (sans consommer de tokens).");
  item.tooltip = md;

  const level = quota.severity(gauges.filter((g) => !g.expired), cfg.warnAt, cfg.errorAt);
  item.backgroundColor =
    level === "error" ? new vscode.ThemeColor("statusBarItem.errorBackground")
    : level === "warning" ? new vscode.ThemeColor("statusBarItem.warningBackground")
    : undefined;
}

function refresh(manual) {
  if (refreshing) return;
  if (!manual && Date.now() - lastRefreshAt < MIN_AUTO_GAP_MS) return;
  const exe = claude.findClaude();
  if (!exe) {
    if (manual) {
      vscode.window.showWarningMessage(
        "Quota Claude : commande « claude » introuvable (Claude Code en ligne de commande). Tapez /usage dans Claude Code pour mettre le chiffre à jour.");
    }
    return;
  }
  refreshing = true;
  lastRefreshAt = Date.now();
  const before = lastGood && lastGood.fetchedAt ? lastGood.fetchedAt.getTime() : null;
  render();
  claude.runUsage(exe, (error) => {
    refreshing = false;
    reload();
    if (!manual) return;
    if (error) {
      vscode.window.showWarningMessage(`Quota Claude : rafraîchissement impossible, ${error}. Tapez /usage dans Claude Code.`);
    } else if (lastGood && lastGood.fetchedAt && lastGood.fetchedAt.getTime() === before) {
      // Claude Code ne réinterroge pas son serveur s'il l'a fait il y a moins de 2 minutes environ
      vscode.window.setStatusBarMessage("Quota Claude : relevé déjà récent, inchangé", 4000);
    }
  });
}

function scheduleAutoRefresh() {
  clearInterval(autoTimer);
  const minutes = settings().autoRefreshMinutes;
  if (minutes > 0) autoTimer = setInterval(() => refresh(false), Math.max(5, minutes) * 60000);
}

function activate(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = REFRESH_COMMAND;
  item.show();

  // Claude Code réécrit ~/.claude.json : on suit le fichier (sondage léger, robuste sous Windows)
  const file = quota.claudeJsonPath();
  fs.watchFile(file, { interval: 15000 }, () => reload());
  const ageTimer = setInterval(render, 60000); // fait vieillir « il y a … min » sans relire le fichier

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand(REFRESH_COMMAND, () => refresh(true)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("claudeQuota")) {
        scheduleAutoRefresh();
        render();
      }
    }),
    { dispose: () => { fs.unwatchFile(file); clearInterval(ageTimer); clearInterval(autoTimer); } },
  );

  reload();
  scheduleAutoRefresh();
}

function deactivate() {}

module.exports = { activate, deactivate };
