# NexPort

Application desktop (Windows / Linux) pour **visualiser les ports ouverts** sur la machine et **arrêter les processus qui les occupent** — sans ligne de commande.

---

## Pourquoi

Quand un dev lance plusieurs serveurs locaux (Node, Python, Docker, jeux, etc.), il finit souvent par avoir :
- des ports bloqués sans savoir par quoi,
- des process zombies qui empêchent de relancer un serveur sur le même port,
- besoin de jongler avec `netstat`, `lsof`, `Get-NetTCPConnection`, `taskkill`, `kill -9`…

`NexPort` donne **une fenêtre unique** qui liste tout ça en clair et permet de tuer le process responsable d'un clic.

---

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Runtime desktop | **Tauri** | Binaire léger (~10 Mo), cross-platform Win/Linux, sécurité par défaut |
| Backend système | **Rust** | Accès natif aux sockets et process via `netstat2` + `sysinfo` |
| UI | **React + TypeScript** | Tableau interactif, filtres, notifications, écosystème mature |
| Stockage local | **SQLite** (via `rusqlite`) | Historique des ouvertures/fermetures de ports, favoris |
| Build | `cargo` + `vite` | Pipeline standard Tauri |

**Alternatives écartées :**
- *Electron* : trop lourd pour un utilitaire système (~100 Mo).
- *Python + PyQt* : packaging Windows pénible, démarrage plus lent.

---

## Fonctionnalités v1 (niveau « Avancé »)

### Vue principale
- Tableau des ports ouverts : **Port • Protocole (TCP/UDP) • Famille (IPv4/IPv6) • État • PID • Nom du process • Chemin exécutable**
- Tri par colonne, recherche/filtre en direct
- Rafraîchissement automatique (intervalle configurable) + bouton manuel
- Indicateur visuel quand une ligne nécessite des droits admin

### Actions
- **Kill process** (avec confirmation)
- **Copier** PID / nom / chemin
- **Ouvrir le dossier** de l'exécutable
- Bouton **« Relancer en admin »** (élévation UAC sur Windows, `pkexec` sur Linux) — l'app démarre en mode normal et bascule à la demande

### Favoris & surveillance
- Marquer des ports en favoris (ex. 3000, 5173, 8080…)
- **Notifications natives** quand un port favori s'ouvre ou se ferme

### Historique
- Journal local des événements (ouverture/fermeture, kills) en SQLite
- Export CSV / JSON

---

## Architecture

```
┌─────────────────────────────────────────┐
│            UI (React + TS)              │
│  Tableau · Filtres · Notifs · Settings  │
└────────────────┬────────────────────────┘
                 │  Tauri IPC (commandes)
┌────────────────▼────────────────────────┐
│           Core (Rust)                   │
│  ─ scan ports     (netstat2)            │
│  ─ resolve PID    (sysinfo)             │
│  ─ kill process   (sysinfo / nix / win) │
│  ─ watcher        (tokio + delta)       │
│  ─ store          (rusqlite)            │
└─────────────────────────────────────────┘
```

---

## Prérequis de build

- **Node.js** ≥ 20 (présent ✓)
- **Rust** stable (présent ✓)
- **Microsoft C++ Build Tools** (Windows, en cours d'installation)
- **WebView2** (préinstallé sur Windows 11 ✓)
- Côté Linux : `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

---

## Roadmap

- **v0.1 — Squelette** : scaffold Tauri + tableau lisant des données factices
- **v0.2 — Backend** : enumeration réelle des ports + résolution PID/nom
- **v0.3 — Actions** : kill process + confirmation + élévation admin
- **v0.4 — Confort** : refresh auto, filtres, tri, recherche
- **v0.5 — Avancé** : favoris, notifications, historique SQLite, export
- **v1.0 — Packaging** : installeurs `.msi` (Windows) et `.AppImage` / `.deb` (Linux)

---

## Statut

Projet en démarrage — installation des prérequis en cours.
