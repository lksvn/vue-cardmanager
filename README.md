# MTG Card Manager

A local web application for searching [Magic: The Gathering](https://magic.wizards.com/) cards through the [Scryfall API](https://scryfall.com/docs/api), then saving and organizing them as Obsidian-compatible Markdown notes.

The application stores card metadata in YAML frontmatter, downloads card artwork locally, and provides collection, group, and type management from a Vue interface.

## Features

- Search Scryfall using card names or the full Scryfall search syntax.
- Browse results in grid or list view with pagination.
- Inspect card details, printings, mana symbols, set information, and multi-face cards.
- Save cards as Markdown files with locally downloaded artwork.
- Organize cards by collection, group, and type.
- Browse and filter the locally saved collection.
- Edit card metadata or remove cards and their associated images.
- Create, rename, and delete tags.
- Map Scryfall card types to preferred names.
- Rebuild the collection tag list from saved card notes.
- Rebuild collection, group, and type lists from saved notes.
- Preview, apply, and checksum-safe rollback of the schema-v2 Obsidian migration.
- Preserve searches, view mode, ordering, and uniqueness options in the URL.
- Cache Scryfall set icons and mana-symbol assets through the local server.

## Tech stack

- Vue 3
- Vite
- Express
- Axios
- gray-matter
- fs-extra
- Scryfall API
- Obsidian-compatible Markdown and YAML frontmatter

## Project structure

```text
vue-cardmanager/
├── client/                 # Vue/Vite frontend
│   ├── public/             # Frontend static assets
│   └── src/
│       ├── components/     # Search, card, collection, and settings UI
│       └── services/       # Scryfall and local API clients
├── server/                 # Express backend
│   ├── public/symbols/     # Cached Scryfall symbol assets
│   ├── config.example.json # Safe configuration template
│   ├── lib/                # Filesystem and migration logic
│   ├── routes/             # Express API routes
│   ├── test/               # Server and API tests
│   └── index.js            # Server setup and startup
├── package.json            # Root convenience scripts
└── runboth.bat             # Windows Terminal launcher
```

## Requirements

- Node.js 20 or newer; Node.js 22 LTS is recommended.
- npm.
- An internet connection for Scryfall searches and asset downloads.
- A local directory for Markdown card files and another for card images. These can be inside an Obsidian vault, but Obsidian itself is optional.

## Installation

From the repository root, install all workspace dependencies:

```bash
npm run install-all
```

This installs the root, client, and server packages.

## Configuration

Configuration can be edited in the application's **Settings** view after startup. It is stored in `server/config.json`.

```json
{
  "vaultPath": "D:\\path\\to\\vault\\Cards",
  "imagesPath": "D:\\path\\to\\vault\\Cards\\Images",
  "groupsFile": "D:\\path\\to\\vault\\Cards\\card-manager\\groups.md",
  "typesFile": "D:\\path\\to\\vault\\Cards\\card-manager\\types.md",
  "collectionsFile": "D:\\path\\to\\vault\\Cards\\card-manager\\collections.md",
  "baseFile": "D:\\path\\to\\vault\\Cards List.base",
  "obsidianVaultPath": "D:\\path\\to\\vault",
  "schemaVersion": 1,
  "typeMapping": {
    "Creature": "Creature"
  }
}
```

The configured directories and parent directories for the tag files must already exist. `obsidianVaultPath` must be the full vault containing both card and image directories before migration can run. Tag files are plain text despite their `.md` extension, with one tag per line. The application creates `server/config.json` with empty values if it is missing.

When `baseFile` is configured, adding a group creates a matching Obsidian cards view using `Groups.contains("Group name")`. Renaming or deleting the group keeps that generated view synchronized.

`server/config.json` contains machine-specific absolute paths and is ignored by Git. `server/config.example.json` documents the safe default structure.

## Running locally

Run the frontend and backend in separate terminals from the repository root:

```bash
npm run server
```

```bash
npm run dev
```

Then open the URL printed by Vite, normally `http://localhost:5173`. The API listens on `http://localhost:3001` by default.

On Windows, `runboth.bat` opens both processes as tabs in Windows Terminal:

```bat
runboth.bat
```

To use another backend port, set `PORT` for the server and `VITE_API_PROXY_TARGET` for the client proxy.

## Usage

1. Start both the server and client.
2. Open **Settings** and configure the card, image, and tag-file paths.
3. Search for a card. The search field accepts Scryfall queries such as `type:creature color:red`.
4. Select a result to inspect it, choose its collection, type, and groups, then save it.
5. Open **Collections** to search or filter saved cards and edit their metadata.

When a card is saved, the server writes a note similar to:

```markdown
---
Collection: Example Set (EXM)
Type: Creature
SchemaVersion: 2
SetCode: EXM
CollectorNumber: 42
Name: Example Card
Groups:
  - Favorites
Cover: '[[exm-42-example-card.jpg]]'
---
Card oracle text goes here.
```

The note is written to `vaultPath`, and its artwork is downloaded to `imagesPath`. New notes use a stable key containing the card name, set, collector number, and Scryfall ID so separate printings cannot overwrite each other.

## Schema migration

The **Migration** view upgrades legacy notes to schema version 2. Migration always starts with a read-only preview and lists unresolved cards that will be skipped. Applying it requires entering the exact configured full vault path and confirming the preview totals.

Before changing anything, the server creates a timestamped backup under `.card-manager-backups` in the Obsidian vault. It then normalizes `Groups`, renames card notes and images, and updates Markdown and wiki links throughout the vault. Rollback is allowed only while migrated files still match their recorded checksums.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run install-all` | Install root, client, and server dependencies. |
| `npm run dev` | Start the Vite development server. |
| `npm run server` | Start the Express API. |
| `npm test` | Run the server test suite. |
| `npm run check` | Run server tests and the production client build. |
| `npm run build --prefix client` | Build the frontend into `client/dist`. |
| `npm run preview --prefix client` | Preview the frontend production build. |

## API overview

The Express server exposes endpoints for:

- `/health` — server health check.
- `/api/config` — read and update local path configuration.
- `/api/cards` — list, update, and delete saved cards.
- `/api/cards/save` — save a Scryfall card and its image.
- `/api/images/:filename` — serve locally stored card images.
- `/api/tags` — read and manage collection, group, and type tags.
- `/api/tags/rebuild` — rebuild collection tags from saved notes.
- `/api/tags/rebuild/:type` — rebuild `collections`, `groups`, or `types` from saved notes.
- `/api/tags/:type/impact` — preview how many cards use a tag.
- `/api/migrations/card-schema/preview` — produce a read-only migration preview.
- `/api/migrations/card-schema/apply` — apply a confirmed preview with backup.
- `/api/migrations/card-schema/status` — list migration backups.
- `/api/migrations/card-schema/:id/rollback` — perform checksum-guarded rollback.
- `/api/reports/cards` — run a read-only collection integrity audit.
- `/api/symbols` — read or synchronize Scryfall symbology.
- `/api/sets/:code/icon` — fetch and cache a set icon.

## Data and safety notes

- The backend has read/write access to every path configured in `server/config.json`.
- Deleting a card permanently removes its Markdown file and associated image after confirmation.
- Tag rename and deletion can optionally update matching card notes after reporting the impact; affected notes receive timestamped backups.
- The server binds to `127.0.0.1`, restricts CORS to the configured client origin, and intentionally has no authentication.
- Scryfall data and images remain subject to Scryfall's and Wizards of the Coast's respective terms and policies.

## License

The package metadata declares the project under the ISC license. Add a `LICENSE` file before distributing the project if you want the license text included in the repository.
