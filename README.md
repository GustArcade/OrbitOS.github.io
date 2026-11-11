# OrbitOS 9 — Final

OrbitOS keeps the original scrolling home and Switch UI, with shared games, themes, media and saved data. All 2,593 browser/built-in game records retain their IDs, launch URLs and artwork. Cloud-only games and cloud launch options remain removed. The original 13 Switch system icons remain in their original order.

## What is new

- **Smarter search:** searches across title, creator, category and source, supports multiple words in any order, and tolerates small spelling mistakes. Available in both libraries and universal search.
- **Bulk library tools:** choose **Select games**, open **Selection actions**, and choose individual games, shown games, or all matching games. Favourite, remove favourites, add to Up Next, mark Play later/Completed, add to a collection, or export CSV. Changes offer Undo until a later change to that data replaces it.
- **Saved searches:** keep up to 12 named combinations of search, layout, source, sort and filters. Use **Save view** beside either library. Applying a view returns to the layout where it was saved.
- **Movie watchlist and history:** in **Movies → Backup movies**, save titles and filter by My watchlist, Recently opened, Video files or Drive folders. Copy links with their original Drive resource keys.
- **Complete backups:** export favourites, collections, local game saves, progress, queues, music, conversations, album images and settings. Imports show a review first, accept supported fields only, and restore previous values if a storage write fails. Older OrbitOS backups remain supported.
- **Restore points:** up to three local snapshots, with one automatic point per day when space permits, plus manual points and points before restore/clear actions. Restore points exclude album images; full backup exports include them.
- **Break timer:** 1–180 minutes, with pause/resume/reset and a player shortcut. Reminds you when it ends while your game keeps running. The timer runs while this tab remains open; its preferred duration is saved.
- **Help and browser status:** connection, storage availability, hidden/missing-file counts, offline readiness, update checks, browser installation when available, keyboard help and downloadable diagnostics.
- **Reliability fixes:** malformed stored values fall back safely; failed saves show a visible warning; inaccessible storage uses a temporary session. Keyboard shortcuts respect inputs, buttons and native dialogs. Closing a player preserves page fullscreen. Backup imports no longer truncate a large favourites list.

Open **Tools** on the homepage, beside either library, in the Quick Menu, from Settings, or through universal search. **?** opens Help when you are outside an editable field or game. **Ctrl/⌘+K** opens universal search.

## Movies and downloads

**Movies → Backup movies** contains all **161** selections imported from the public Dominum Network source: **154 Google Drive files** and **7 folders**. Search, year filters, sorting, incremental loading and poster fallbacks are included. Select a video, then choose **Download movie ↓** beside **Open in browser**. Folder entries open their original Drive folder for downloads.

The catalogue is stored with OrbitOS; movies and posters remain on their original hosts. Google controls permissions, quotas, sign-in and download confirmations. Dated checks labelled five missing sources and 18 access errors. A frame load does not verify video playback. Source reports and refresh instructions are in `integrations/dominum-movies/`.

## Existing features retained

- Original OrbitOS home, planet hero, featured shelf, full library and Switch console layout.
- 33 themes, custom accent colours, larger text, reduced motion and four cursor styles, including Reactive Aurora.
- Favourites, recent games, shelves/pins, ratings, notes, daily discovery, collections, Up Next and progress filters.
- Four bundled games: Orbit Snake, 2048 Nebula, Cosmic Pairs and Star Breaker. Personal records are saved locally; 2048 also restores its board.
- Original music player with search, queues, likes, playlists, lyrics, shuffle, repeat and sleep timer; existing guest AI conversations.
- Movie providers and local/direct-video player with subtitle files and picture in picture where supported.
- Album imports, cover captures, activity, achievements, Quick Menu, keyboard/gamepad navigation and native page fullscreen.
- Isolated game frames, HTML fallback, display repair, aspect controls, focus mode, reload and original browser links.
- Uploaded 26-proxy list, bookmarks, endpoint testing and optional Node bridge.

## Run the complete website

Extract the entire archive and use **Node.js 20 or later**:

```sh
node server.js
```

Open **http://localhost:4173**. No npm packages or AI API key are needed for the supplied guest service. A remote Node host needs `ORBIT_BIND_HOST=0.0.0.0`, its assigned `PORT`, and HTTPS. The server serves `dist/`, the fixed AI/music routes and the optional proxy bridge.

## Worker and static hosting

```sh
npm run build
node scripts/validate-worker.mjs
```

The build creates `dist/server/index.js`, a self-contained Worker with the website assets embedded. The same fixed AI/music adapter runs in Node and the Worker. The deployment configuration is generated in `dist/.openai/hosting.json`.

Static-only hosting serves the launcher and built-in games, but AI and music search/streaming require the included Node server or Worker. Proxy Web's SOCKS/CONNECT Hosted Bridge requires Node; a separately hosted bridge can be configured under **Proxy Web → Connection setup**.

## Saved data and offline use

Saved data stays in the browser on each hostname. Export a complete backup to move it between hosts. Credentials and guest authentication tokens are excluded from exports. A restore point replaces only the supported fields it contains and leaves album photos as they are. Exported backups may include personal conversations and photos, so keep your backup file somewhere you trust.

The service worker caches the app shell and the four built-in games after a successful secure visit, including localhost. Online games, movies, music and AI still need their services. **Tools → Help & status** reports cache readiness; it does not claim remote content works offline. Oversized/full storage can prevent local restore points; use a downloaded backup instead.

Browser-game files are not bundled unless they are the four built-in games. The source checker hides confirmed missing files and allows manual rechecks. The current check hides one missing entry, so a fresh library normally shows 2,592 available games. Reporting a broken game hides it locally and can be reversed in Settings.

Public proxies are unverified. Local protocol tests establish bridge behaviour, not public endpoint availability. External games, Google Drive, music and AI can change, restrict access or prevent embedding. Use the supplied browser links when appropriate. Continue Playing relaunches an external game and does not add internal save support.

## Verification

Run **`npm run verify`** to build the Worker, run the complete test suite, validate routes and audit embedded assets. See [QA-REPORT.md](QA-REPORT.md) for exact current checks and external-service limits. Historical cloud integration files are retained as source history, but their catalogues, UI and launch integrations are not loaded by this release.

No affiliation with Nintendo. External game names, artwork and code belong to their respective owners.
