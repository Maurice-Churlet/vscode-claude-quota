# Claude Quota for VS Code

*Unofficial community extension, not affiliated with or endorsed by Anthropic.* · [Français plus bas](#français)

Shows your Claude subscription quota (Pro or Max) in the VS Code status bar:

    ⚡ 5 h 17 % · Semaine 21 % · Fable 14 %

- **5 h**: rolling 5-hour window; **Semaine**: weekly quota; then any model-specific weekly limit.
- Hover: reset time of each gauge and age of the reading. A trailing `~` flags a reading older than one hour;
  a gauge whose reset time has passed shows `?`.
- Orange background from 75 %, red from 90 % (configurable).
- Click to refresh. Automatic refresh every 30 minutes (configurable, 0 = never).

## Privacy and safety

- Reads **only** the `cachedUsageUtilization` key of `~/.claude.json`, which Claude Code writes itself whenever
  it shows usage. No credentials or tokens are read; the extension makes no network call.
- Refreshing runs `claude -p /usage --no-session-persistence --strict-mcp-config`, a local Claude Code
  command: it consumes no tokens, leaves no transcript and starts no MCP server.
- This key is an internal Claude Code cache, not a public API: a Claude Code update may change it. The
  extension then shows `Claude : —` instead of wrong figures.

## Requirements

- A Claude Pro or Max subscription and Claude Code. The `claude` command line is used for click-to-refresh;
  without it, typing `/usage` in Claude Code updates the figures. On macOS, `claude` is also looked for in
  `~/.local/bin`, `/opt/homebrew/bin` and `/usr/local/bin`.

## Install

Download the `.vsix` from the [Releases](../../releases) page, then:

    code --install-extension claude-quota-1.1.0.vsix

and reload VS Code. Labels are in French for now; contributions welcome.

## Develop

- Tests: `node --test test/quota.test.js` (Node 20+, no dependencies).
- Package: `npx @vscode/vsce package --allow-missing-repository`.

---

## Français

*Extension communautaire non officielle, sans lien avec Anthropic.*

Affiche en bas à droite de VS Code le quota de votre abonnement Claude (Pro ou Max) : fenêtre de 5 heures,
semaine, et limites propres à un modèle. Survol : heure de remise à zéro et âge du relevé (« ~ » au-delà
d'une heure, « ? » si la remise à zéro est passée). Fond orange à 75 %, rouge à 90 %. Clic : rafraîchit, sans
consommer de tokens ; rafraîchissement automatique toutes les 30 minutes.

Ne lit que la clé `cachedUsageUtilization` de `~/.claude.json` (aucun identifiant, aucun appel réseau).
Installation : télécharger le `.vsix` dans *Releases*, puis `code --install-extension claude-quota-1.1.0.vsix`.
