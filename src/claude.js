// Recherche et lancement de `claude -p /usage`, qui fait rafraîchir à Claude Code son cache d'utilisation.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

// --no-session-persistence : pas de transcript laissé ; --strict-mcp-config : aucun serveur MCP démarré.
const USAGE_ARGS = ["-p", "/usage", "--no-session-persistence", "--strict-mcp-config"];
const TIMEOUT_MS = 90000;

// Emplacements usuels absents du PATH quand VS Code est lancé depuis le Dock (macOS) ou un raccourci.
function fallbackDirs(home = os.homedir()) {
  return [
    path.join(home, ".local", "bin"),
    path.join(home, ".claude", "local"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(home, ".npm-global", "bin"),
    process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : null,
  ].filter(Boolean);
}

// Chemin complet de l'exécutable `claude`, ou null s'il est introuvable.
function findClaude(env = process.env, platform = process.platform, exists = fs.existsSync) {
  const dirs = (env.PATH || env.Path || "").split(path.delimiter).filter(Boolean).concat(fallbackDirs());
  const exts = platform === "win32"
    ? (env.PATHEXT || ".EXE;.CMD;.BAT").split(";").filter(Boolean).map((e) => e.toLowerCase())
    : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, `claude${ext}`);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

// Lance la commande ; callback(errorMessage | null). Arguments constants : rien de l'utilisateur n'y passe.
function runUsage(exe, callback) {
  // Un .cmd/.bat (installation npm sous Windows) exige cmd.exe ; un .exe se lance directement,
  // ce qui permet de le tuer proprement à l'expiration du délai.
  const viaShell = /\.(cmd|bat)$/i.test(exe);
  const file = viaShell ? `"${exe}" ${USAGE_ARGS.join(" ")}` : exe;
  const child = execFile(
    file,
    viaShell ? [] : USAGE_ARGS,
    { cwd: os.tmpdir(), timeout: TIMEOUT_MS, windowsHide: true, shell: viaShell },
    (error, _stdout, stderr) => {
      if (!error) return callback(null);
      if (error.killed) {
        // Avec cmd.exe, seul le shell est tué : on supprime aussi ses enfants
        if (viaShell && process.platform === "win32" && child.pid) {
          execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
        }
        return callback(`pas de réponse en ${TIMEOUT_MS / 1000} s`);
      }
      const detail = String(stderr || "").trim().split(/\r?\n/)[0].slice(0, 100);
      return callback(detail ? `échec (${detail})` : `échec (code ${error.code})`);
    },
  );
  // Sans fin de stdin, Claude Code attend 3 s des données qui ne viendront pas
  if (child.stdin) child.stdin.end();
}

module.exports = { USAGE_ARGS, findClaude, runUsage };
