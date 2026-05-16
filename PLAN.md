# Plan de mise en place — NexPort

Document de travail. Chaque étape se termine par un **livrable visible** (UI qui tourne, commande qui répond, etc.) pour ne jamais coder à l'aveugle plus de 30 min.

---

## Étape 0 — Prérequis (en cours)

- [x] Node.js ≥ 20
- [x] Rust stable (rustup + rustc + cargo)
- [ ] Microsoft C++ Build Tools (workload VCTools) — **install en cours**
- [x] WebView2 (préinstallé Win11)

**Livrable** : `cargo build` réussit sur un projet vide.

---

## Étape 1 — Scaffold Tauri + React/TS

```powershell
npm create tauri-app@latest -- --template react-ts --manager npm
```

Réponses au prompt :
- App name : `NexPort`
- Window title : `NexPort`
- UI template : `React` / `TypeScript`
- Package manager : `npm`

Puis :
```powershell
cd NexPort
npm install
npm run tauri dev
```

**Livrable** : fenêtre Tauri qui s'ouvre avec le template React par défaut.

---

## Étape 2 — Dépendances Rust (côté `src-tauri/`)

Ajouter dans `src-tauri/Cargo.toml` :

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
netstat2 = "0.11"           # énumération sockets TCP/UDP
sysinfo = "0.33"            # process, kill
rusqlite = { version = "0.32", features = ["bundled"] }
anyhow = "1"
thiserror = "2"
```

**Livrable** : `cargo check` passe.

---

## Étape 3 — Dépendances UI (côté racine)

```powershell
npm install @tanstack/react-table @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- `@tanstack/react-table` → tableau triable/filtrable
- `@tanstack/react-query` → cache + refetch périodique des ports
- `zustand` → état global (favoris, filtres)
- `tailwind` → styling rapide

**Livrable** : Tailwind appliqué à `App.tsx` (test avec `bg-slate-900 text-white`).

---

## Étape 4 — Commande Tauri `list_ports`

Fichier `src-tauri/src/ports.rs` :

```rust
use netstat2::*;
use serde::Serialize;
use sysinfo::{System, Pid};

#[derive(Serialize)]
pub struct PortInfo {
    pub port: u16,
    pub protocol: String,   // "tcp" | "udp"
    pub family: String,     // "ipv4" | "ipv6"
    pub state: Option<String>,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub exe_path: Option<String>,
}

#[tauri::command]
pub fn list_ports() -> Result<Vec<PortInfo>, String> {
    // 1. iterate_sockets_info(AddressFamilyFlags::IPV4|IPV6, ProtocolFlags::TCP|UDP)
    // 2. pour chaque socket -> PID
    // 3. sysinfo::System::new() -> resolve name + exe path
    // 4. dédup par (proto, port, pid)
}
```

Enregistrer dans `src-tauri/src/lib.rs` :
```rust
.invoke_handler(tauri::generate_handler![ports::list_ports])
```

**Livrable** : depuis la devtools React, `invoke("list_ports")` retourne un JSON valide.

---

## Étape 5 — Tableau React minimal

`src/components/PortsTable.tsx` :
- `useQuery({ queryKey: ["ports"], queryFn: () => invoke("list_ports"), refetchInterval: 2000 })`
- Colonnes : Port • Proto • Famille • État • PID • Nom • Chemin
- Tri par colonne (TanStack Table)
- Champ recherche global

**Livrable** : tableau qui se met à jour toutes les 2 s avec les ports réels du système.

---

## Étape 6 — Action `kill_process`

`src-tauri/src/process.rs` :

```rust
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    let mut sys = System::new();
    sys.refresh_processes();
    sys.process(Pid::from_u32(pid))
        .ok_or_else(|| "process introuvable".into())
        .and_then(|p| if p.kill() { Ok(()) } else { Err("kill refusé (admin ?)".into()) })
}
```

UI : bouton ❌ par ligne → `tauri-plugin-dialog` pour confirmation → `invoke("kill_process", { pid })`.

**Livrable** : tuer un serveur Node lancé à côté en cliquant le bouton.

---

## Étape 7 — Élévation administrateur

- Bouton « Relancer en admin » dans la barre du haut.
- Windows : relancer l'exe via `ShellExecuteW(..., L"runas", ...)` (depuis Rust via `windows` crate) puis quitter l'instance courante.
- Linux : `pkexec /path/to/NexPort`.
- Indicateur en haut : « Mode standard » / « Mode admin » selon `is_elevated`.

**Livrable** : en mode admin, on peut tuer un process appartenant à un autre utilisateur / système.

---

## Étape 8 — Favoris + notifications

- Table `favorites(port INTEGER, label TEXT)` en SQLite (`%APPDATA%\NexPort\db.sqlite`).
- État zustand `useFavorites()` synchronisé avec la DB.
- Étoile cliquable dans le tableau.
- **Watcher Rust** : tâche `tokio::spawn` qui scan toutes les 2 s, calcule le delta avec le scan précédent, et émet un événement Tauri `port-event` (`{kind: "opened" | "closed", port, pid}`).
- Côté UI : `listen("port-event")` → si port favori → `tauri-plugin-notification` (toast natif OS).

**Livrable** : épingler `:3000`, lancer/arrêter un serveur Node dessus → toasts natifs.

---

## Étape 9 — Historique + export

- Table `events(ts INTEGER, kind TEXT, port INTEGER, pid INTEGER, process TEXT)`.
- Onglet « Historique » avec filtres date / port / type.
- Boutons « Export CSV » / « Export JSON » via `tauri-plugin-dialog` (save dialog).

**Livrable** : fichier `events.csv` exporté ouvre proprement dans Excel.

---

## Étape 10 — Settings

Fichier `%APPDATA%\NexPort\settings.json` :
- Intervalle de refresh (1 / 2 / 5 / 10 s)
- Notifications on/off (global + par favori)
- Thème clair/sombre
- Démarrage avec Windows (optionnel — `tauri-plugin-autostart`)

**Livrable** : la fenêtre Settings persiste les choix entre redémarrages.

---

## Étape 11 — Portabilité Linux

Tester sur une VM/WSL2 + Ubuntu :
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev \
                 libayatana-appindicator3-dev librsvg2-dev
```
- Vérifier `netstat2` (lit `/proc/net/tcp` et `/proc/net/udp`).
- Vérifier que `sysinfo::Process::kill()` fonctionne en non-root pour les process de l'utilisateur.
- Vérifier que `pkexec` est dispo pour le mode admin.

**Livrable** : binaire Linux qui liste et kill correctement.

---

## Étape 12 — Packaging

```powershell
npm run tauri build
```

Produit :
- Windows : `src-tauri/target/release/bundle/msi/NexPort_x.y.z_x64_en-US.msi`
- Linux : `.AppImage` + `.deb`

Ajouter une icône custom (`src-tauri/icons/`) avant le build final.

**Livrable v1.0** : MSI installable qui place l'app dans le menu Démarrer.

---

## Étapes facultatives (post-v1)

- Vue détaillée du process (RAM, CPU, ligne de commande, parent)
- Détection « port suspect » (port d'écoute sur 0.0.0.0 par un process inhabituel)
- Mode sombre auto suivant l'OS
- Multi-langue (FR / EN)
- Système tray + démarrage minimisé
- Build macOS si besoin un jour

---

## Convention de commits

`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` — un commit par étape ou sous-étape pour pouvoir revenir en arrière facilement.
