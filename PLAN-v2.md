# HAF Projects v2.0 — Bouwplan

**Status:** concept — wacht op go/no-go van Roland
**Datum:** 2026-04-08
**Besluit van:** Roland Hameeteman

## Intentie
Productieversie van HAF Projects waarin Roland zijn projecten per HAF-fase beheert, zowel vanaf zijn laptop als zijn telefoon, met dezelfde data op beide apparaten en Claude-chat per fase via CKPS.

## Keuzes (vastgelegd 7 apr 2026)
1. **Backend**: uitbreiding CKPS — nieuwe routes in `ckps-clean/src/server.js`
2. **Database**: `node:sqlite` — aparte file `data/haf-projects.db` (niet vermengen met ckps.db)
3. **Frontend**: PWA — manifest.json + service-worker.js, installeerbaar vanuit browser
4. **Auth**: bestaand CKPS agent-token mechanisme (`Authorization: Bearer ckps_xxx`)
5. **Hosting**: via bestaande Cloudflare tunnel op `ckps.hafworld.com/projects/*`

## Architectuur

```
Telefoon Safari ─┐
                 ├─► https://ckps.hafworld.com/projects/*  (Cloudflare tunnel)
Laptop Chrome  ─┘              │
                               ▼
                    CKPS (Node, :3800)
                    ├── bestaande /v1/messages, /admin/* routes
                    └── NIEUW: /projects/* routes
                               │
                               ▼
                    data/haf-projects.db (nieuwe SQLite)
```

## Backend — nieuwe routes in CKPS

Alle routes vereisen `Authorization: Bearer ckps_xxx` (hergebruikt `authenticateAgent` middleware).

| Method | Route | Functie |
|---|---|---|
| GET | `/projects` | Lijst alle projecten van de agent-owner |
| POST | `/projects` | Nieuw project |
| GET | `/projects/:id` | Project + alle kaarten |
| PUT | `/projects/:id` | Update project-metadata (naam, desc, status, icon, color) |
| DELETE | `/projects/:id` | Verwijder project + kaarten |
| POST | `/projects/:id/cards` | Nieuwe kaart in een fase |
| PUT | `/projects/:id/cards/:cid` | Update kaart (verplaatsen tussen fases = fase-veld updaten) |
| DELETE | `/projects/:id/cards/:cid` | Verwijder kaart |
| GET | `/projects/sync?since=<iso>` | Delta-sync voor offline → online |

### Database schema
```sql
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  owner       TEXT NOT NULL,          -- agent token prefix (ckps_xxx...)
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active',
  icon        TEXT,
  color       TEXT,
  claude_url  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT                    -- soft delete voor sync
);

CREATE TABLE cards (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  phase       TEXT NOT NULL,          -- intentie|observeren|plannen|acteren|valideren|adapteren
  type        TEXT DEFAULT 'note',    -- note|link|image
  title       TEXT,
  content     TEXT,
  url         TEXT,
  priority    TEXT,                   -- high|mid|low
  due_date    TEXT,
  tags        TEXT,                   -- JSON array
  position    INTEGER,                -- volgorde binnen fase
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_projects_owner ON projects(owner);
CREATE INDEX idx_cards_project ON cards(project_id);
CREATE INDEX idx_cards_updated ON cards(updated_at);
```

## Frontend — PWA

### Nieuwe bestanden in repo
- `index.html` — huidige file, uitgebreid met sync-logica
- `manifest.json` — PWA manifest (naam, icons, start_url, display: standalone, theme_color)
- `service-worker.js` — cache-first voor HTML/CSS/JS, network-first voor API
- `icons/` — 192x192, 512x512, maskable voor iOS/Android

### Sync-strategie (offline-first)
1. Alle writes gaan **eerst** naar `localStorage` → direct UI update
2. Wijzigingen worden in een `pending_ops` queue gezet
3. Service worker / sync loop stuurt pending ops naar backend als online
4. Bij app-start: `GET /projects/sync?since=<last_sync>` → merge server-wijzigingen in lokale state
5. Conflict-resolutie: last-write-wins op basis van `updated_at`

### Hoe token wordt geïnjecteerd
Volgt jullie vaste conventie:
- HTML bevat `const CKPS_KEY = 'CKPS_KEY_PLACEHOLDER'` (al aanwezig)
- Admin dashboard levert geprovisioneerde kopie per device
- Mobiel: tester ontvangt testlink → Safari → "Voeg toe aan beginscherm" → PWA staat op home screen met token ingebakken

## Open vragen voor bouwplan-review

1. **Token in PWA** — als de HTML ooit opnieuw geprovisioneerd wordt (nieuwe versie), blijft de oude op de telefoon staan met oud token. Moet er een token-refresh mechanisme komen? Voor nu: nee (voorlopig alleen voor jou, je herinstalleert dan handmatig).
2. **Icons** — ik lever standaard HAF-oranje placeholder icons of wil jij eigen ontwerp?
3. **Sync-frequentie** — nu alleen bij app-start + bij elke write. Wil je ook periodiek polling (bv. elke 30s)? Liever niet, batterij.
4. **Multi-device conflict** — als je op laptop én telefoon tegelijk dezelfde kaart bewerkt: last-write-wins. Akkoord?

## Implementatievolgorde (morgen)

1. **Backend** (1u) — `/projects` routes + schema + integratie in server.js
2. **Database migratie** (15m) — `data/haf-projects.db` aanmaken
3. **Frontend sync laag** (1u) — REST-client, pending queue, merge logica
4. **PWA shell** (45m) — manifest, service worker, icons
5. **Test lokaal** (30m) — op laptop én telefoon via Cloudflare tunnel
6. **Registratie in dashboard** (15m) — HAF Projects v2.0 als apart prototype
7. **Provisioning** (15m) — agent aanmaken, geprovisioneerde kopie downloaden

Totaal: ~4 uur

## Niet-doelen (expliciet uitgesloten)
- Multi-user / delen van projecten met anderen — alleen jij
- App store publicatie — PWA is genoeg
- End-to-end encryptie — token-based auth is voldoende voor nu
- Realtime collab — geen websockets, gewoon polling-based sync
- Notificaties — geen push, geen reminders (nog)
