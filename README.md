# Quota Claude (extension VS Code)

Affiche en bas à droite de VS Code le quota de votre abonnement Claude (Pro ou Max) :

    ⚡ 5 h 17 % · Semaine 21 % · Fable 14 %

- **5 h** : fenêtre glissante de 5 heures ; **Semaine** : quota hebdomadaire ; puis les limites propres à
  un modèle, s'il y en a.
- Survol : heure de remise à zéro de chaque jauge et âge du relevé. Un « ~ » signale un relevé de plus d'une heure.
- Fond orange à 75 %, rouge à 90 % (réglables).
- Clic : rafraîchit le relevé. Rafraîchissement automatique toutes les 30 minutes (réglable, 0 = jamais).

## Sécurité

- Lit **uniquement** la clé `cachedUsageUtilization` de `~/.claude.json`, que Claude Code écrit lui-même
  quand il affiche l'utilisation. Aucun identifiant ni jeton lu, aucun appel réseau par l'extension.
- Le rafraîchissement lance `claude -p /usage`, commande locale de Claude Code : elle ne consomme pas de tokens.

## Prérequis

- Abonnement Claude Pro ou Max, Claude Code installé (extension VS Code ; la commande `claude` en ligne de
  commande sert au rafraîchissement par clic : sans elle, taper `/usage` dans Claude Code met le chiffre à jour).
  Sur Mac, `claude` est aussi cherché dans `~/.local/bin`, `/opt/homebrew/bin` et `/usr/local/bin`.

## Installer

Dans un terminal : `code --install-extension claude-quota-1.1.0.vsix`, puis recharger VS Code.

## Développer

- Tests : `node --test test/quota.test.js` (Node 20 ou plus, aucune dépendance).
- Paquet : `npx @vscode/vsce package`.
