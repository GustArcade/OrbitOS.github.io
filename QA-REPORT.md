# OrbitOS 9 — Final verification · 9 November 2026

The final release adds shared library tools, saved searches, movie watchlists, complete backups and recovery, a break timer and a browser-status/help panel. Both original layouts and all 2,593 browser/built-in catalogue records are preserved. Cloud launch integrations remain unloaded and both cloud catalogues remain empty.

## Automated checks

**Passed:** complete verification, 78 exact deployment assets, 52 parsed scripts including 10 inline scripts, and complete offline-shell references.

`npm run verify` builds the Worker, runs all existing suites plus `test-final.js`, validates deployment routes and audits source/output parity. The final-specific checks cover multiword/accent/typo search; unavailable, malformed and full storage; rollback after partial backup failure; all 2,593 favourite IDs without truncation; old backup compatibility; media, photos, native saves and filter validation; CSV formula escaping; timer deadlines; and the actual player-close implementation's page/player fullscreen distinction.

The existing suites also check exact browser-catalogue fingerprints, removal of cloud integrations, all 161 movie mappings and download resource keys, four native games, queue/progress/collections, themes/cursors, original 13-icon Switch dock, player isolation, music/AI boundaries, proxy fixtures and deployment/private route handling.

## Browser checks in this release

| Flow | Observed result |
| --- | --- |
| Fresh startup | Original OrbitOS home opened; diagnostics reported version 9.0.0, 2,593 catalogue entries, 2,592 visible, browser storage available and zero application errors. |
| Search | `minecarft` returned Minecraft titles; `mario 64` returned six relevant titles in both libraries. |
| Bulk library tools | Selected all seven 2048 matches; batch favourites, queue, named collection and Undo controls responded. Switch library selected six Mario matches and applied/undid Completed status. |
| Saved searches | Created a named 2048 view, reset the library and applied it; the expected seven-match search returned. |
| Original Switch UI | All 13 original dock applications remained in their original order; All Software opened the browser catalogue and new bulk tools. |
| Movies | Saved Dog Days, filtered My watchlist, opened the matching preview, filtered Recently opened and copied the exact original Drive link including its resource key. Download link retained the original file ID/resource key. Saved button state stayed correct when opening and closing a preview. |
| Backup round trip | Downloaded complete JSON including album field and watchlist, with no guest token; imported the same file, reviewed it, applied restore, reloaded and verified the saved movie and restore points remained. |
| Invalid import | Replaced an in-progress valid review with malformed JSON; the old review was removed, the new file was rejected and saved data remained unchanged. |
| Restore points | Manual and pre-restore snapshots appeared. A separate clean first visit created its automatic daily point. |
| Timer | Started one minute, paused, resumed and reset. Deadline/expiry behaviour is also covered by deterministic tests. |
| Dialog and keyboard | Native Tools dialog trapped background interaction; Escape closed it. Controls and search fields retained normal interaction. |
| Built-in game / fullscreen | 2048 loaded with its real board and touch controls; a directional control moved tiles. Page fullscreen state stayed enabled after closing the game, and its exit control remained available. |
| Narrow layout | At 337 CSS pixels, tools tabs wrapped into two columns; the selection toolbar and page had no horizontal overflow (337/337 page; 313/313 toolbar). Browser zoom was used, not a physical phone. |
| Status | Help reported app shell and all four built-in games cached on the preview origin. |
| Music | Live search returned 17 songs for `lofi`; a like persisted and playback reached 18 seconds with readyState 4 and no media error. Pause worked. |
| AI | The live service answered the test prompt with `OK`. |
| Light theme | Tools retained readable text and controls in Switch Light; primary controls use the same accent/foreground pair as the existing theme system. |

This is not a claim that every external game or film was individually played. The original remote providers, Google Drive permissions/quotas, artwork servers and public proxy endpoints remain outside OrbitOS's control. The five missing movie sources and 18 unverified access errors are labelled from the earlier dated source check. No film was downloaded for testing.

---

# Historical release checks

The sections below describe earlier versions and are retained for provenance. Their old cloud feature descriptions do not describe the current release.

# OrbitOS 8.6.5 browser games and movie downloads — 9 November 2026

This update completes the requested movie download control and removes cloud games. It removes 281 cloud-only cards and 483 cloud launch options, while retaining all 2,593 browser/built-in game records with their original IDs, names, launch URLs, artwork, categories and creators. The browser catalogue fingerprint matches the previous release exactly after excluding cloud variants. No saved preferences or browser-game data are cleared.

- Both published cloud catalogues are empty. The main page no longer loads the cloud catalogue, account UI or launch integration. Cloud collection filters are removed from both layouts, and the offline shell no longer preloads cloud catalogues or launchers.
- Backup movie previews have **Download movie ↓** beside **Open in browser**. The download link follows the URL format returned by Google's own Drive viewer, includes the selected file ID and preserves its resource key. Folder entries continue to open their original Drive folder for file downloads.
- Browser checks: OrbitOS and Switch UI opened correctly; neither showed cloud collection choices. Cuphead retained its browser launch and its original URL, with no cloud button/provider controls. All 13 original Switch system icons remain. The unchanged missing-file checker hid its one already missing browser entry; the 2,593-record catalogue itself is retained.
- Browser checks: the Dog Days backup preview displayed the new download link with the correct file ID, resource key and separate-tab target. Movie files were not downloaded during the check. Download permissions, availability and any Google confirmation/sign-in remain controlled by Drive.
- **npm run verify passed**, including the browser catalogue fingerprint, stale-cloud-global protection, empty cloud catalogues, all 161 movie mappings, download URLs/resource keys, the full existing test suite and the Worker deployment audit (75 matching assets, 50 parsed scripts).

The original layouts, themes, browser game files, music/AI code, movie providers, proxy features and personal-data storage code are unchanged.

---

# OrbitOS 8.6.4 movie backup — 9 November 2026

Imported all 161 movie selections from the public Dominum Network Google Sites custom embed. The new **Movies → Backup movies** tab includes search, year filtering, title/newest sorting, posters with fallbacks, incremental loading and a separate preview player. A shortcut is also available above the existing provider cards. All original providers, games and the local-video player are retained.

- All 154 Drive file entries have preview/browser links. All seven Drive folder entries open their original folder in the browser. The Dog Days resource key is retained in both URLs.
- Source-page checks covered all 161 links: 138 pages opened, five returned 404, and 18 returned 401/403 access errors. Missing sources are labelled **Source unavailable**; access errors are labelled **Access not verified**. These are dated source-page checks, not confirmation that each movie plays.
- The browser opened the correct Spider-Man: Into the Spider-Verse preview. Drive reported that its guest viewing limit had been reached and requested Google sign-in. No film playback or sign-in was completed. The player now explains this condition and offers the original browser link.
- Browser checks confirmed the home movie launcher, provider-to-backup shortcut, all three tabs, title search, combined year/search filters, sorting, no-results/reset, 24-to-48-card pagination, Drive folder destinations, preview creation and iframe removal on close/tab change. No uncaught application JavaScript errors were reported during these checks.
- The backup panel fit a 340 CSS-pixel browser width with two card columns and no horizontal overflow (page width/scroll width 340/340; panel 303/303). This used browser zoom, not a physical phone.
- `npm run verify` passed the complete suite, including all 161 catalogue mappings, 154 preview URLs, seven folder links, resource keys, URL validation, duplicate imports and sorting. Deployment audit: 75 exact assets, 50 parsed scripts and complete offline-shell references.

The catalogue is stored with OrbitOS; poster images and movies still depend on their original external hosts. Google Drive permissions, playback limits, missing files and local network restrictions continue to apply. No third-party executable code or movie files were downloaded into the website.

---

# OrbitOS 8.6.3 cloud recovery — 7 November 2026

Reproduced the reported My Friend Pedro error in production: Astra displayed “Something went wrong — please try again.” while OrbitOS incorrectly reported that the player was ready. The provider's polling errors and timeouts do not always emit SDK error events, and mounting the SDK does not establish a working video stream.

The isolated client now observes the normal provider status responses and SDK error display, offers a clean retry, and reports connected only after the game video has real frame dimensions. It excludes the promotional loading video and the provider's 2×2 keepalive video. Provider session-ended and connection-failed cards also show the recovery controls. It releases its own queued or failed allocation before retrying, including an allocation that arrives after cancellation. Normal provider verification, account requirements and SDK transport remain in effect. Stream credentials and allocation IDs are not persisted by this change.

The embedded player has a Cloud provider selector. A failed connection also offers an alternate provider and the existing browser version when those options exist. The separate player page has the same provider selector. Browser and cloud editions can differ; no browser edition is represented as the full cloud game.

Validation for this update:

- `npm run verify` passed all 22 check groups, including the new failure/retry tests, 72 exact embedded deployment assets and 48 parsed scripts.
- Fault fixtures exercised the real client: a silent polling error, retry controls, session cleanup, a successful retry receiving video, stale callbacks, cancellation during allocation and parent-message validation.
- Browser preview: My Friend Pedro reached the provider's real stream setup and its normal connection-choice dialog. Video playback was not confirmed in this browser. The footer continued to say that the video stream was starting instead of claiming success.
- Browser preview: switching to the alternative provider opened the exact My Friend Pedro launcher. That service reported that all free shared accounts were occupied and that its next human check was unavailable for about 51 minutes. No check or account sign-in was attempted.
- The standalone player opened with both expected provider options and the isolated Connect control.
- Production reproduced the original silent error and displayed Retry, alternate-provider and browser-edition controls. Clicking Retry reached stream setup. Its stream later ended without verified gameplay; the additional keepalive/session-ended checks cover that observed state.

The generic remote-provider failure cannot be repaired in OrbitOS itself. This update fixes the misleading status, missing recovery controls and failed-session cleanup. Availability and actual video playback still depend on the streaming provider and the user's connection.

## Earlier 8.6 verification

The final build passed two complete automated verification runs, with 20 passing check groups in each run. Both runs produced the same Worker bundle. Browser checks covered the two interfaces and the main application flows. This is not a claim that every third-party game or film was individually played.

## Changes included

- Combined the latest 8.6 cloud catalogue with the provider-backed account controls and isolated-player session fixes. The 8.6 archive had omitted those account changes.
- Preserved all 483 cloud launch options on 300 title cards, including the 209 newer-provider options on 208 cards. Existing game IDs and browser launches remain available.
- Changed Cinefork to an ordinary browser-opening link. Its server explicitly sends `X-Frame-Options: DENY`, and the embedded page was observed refusing the connection.
- The production check caught a Workers-specific cloud request failure. The adapter now uses supported manual redirect handling and explicitly rejects redirects; this also prevents forwarding account credentials to a different host. See the [Workers Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/).
- Added a deployment audit that checks every first-party asset, parses every JavaScript file and inline script, checks offline-shell references, and verifies private/source route handling.

## Automated checks

Both runs used `npm run verify`, which builds the Worker, runs the full test suite, validates deployment routes, and audits the generated assets.

| Area | Result |
| --- | --- |
| Build and deployment assets | Passed: all 71 first-party assets exactly match the generated Worker responses. |
| JavaScript syntax | Passed: 47 scripts, including 10 inline scripts. |
| Catalogue and cloud imports | Passed: all source identifiers represented, stable existing IDs/URLs, unique title cards, repeated imports add no duplicates. |
| Provider account adapter | Passed against controlled provider fixtures: register, login, matching authenticated-user verification, expired sessions, wrong passwords, duplicate usernames, sign-out, provider failures and rate limits. |
| Account isolation | Passed: private per-browser cookies, CSRF checks, allowlisted upstream routes, no fake authenticated success, provider cookies excluded from response JSON. |
| Cloud player | Passed: opaque SDK storage, parent/player message validation, session lifecycle and fixed provider URLs. |
| Themes and cursors | Passed: 33 palettes, contrast rules, safe custom colours, four cursors and invalid saved-value handling. |
| Saves and library data | Passed: native save validation, 2048 rules, ratings/progress, collections, queues, backup validation and imported-data boundaries. |
| Media and AI | Passed: track/chat validation, music queues and playback boundaries, lyrics parsing, API request limits and streaming range handling. |
| Original Switch interface | Passed: exact original dock ordering and icons, layout restoration and cover loading/failover. |
| Fullscreen | Passed: native API requests, user activation, exit, unsupported/denied cases and WebKit fallback. |
| Proxy implementation | Passed: local protocol fixtures, uploaded-only proxy selection, request rewriting and private-network blocking. This does not establish that the public proxies are currently reachable. |

Generated Worker SHA-256 after both runs:

`44978127eed53f0e51c2ce2c087ab96f23dae8a2ceb29150d490bc913516ff60`

## Browser checks

| Feature | Observed result |
| --- | --- |
| OrbitOS and Switch UI | Both opened and switched correctly; saved layout, Reactive Aurora and Glass cursor survived reload and backup restoration. |
| Original system applications | All 13 controls worked: Orbit Online, News, All Software, Orbit eShop, Album, Proxy Web, My Shelf, Arcade Hub, Play Activity, Controllers, Console Information, Settings and Sleep Mode. Wake-up returned home. |
| Artwork | All five visible Switch covers in the inspected viewport loaded successfully. Artwork fallbacks are also covered by automated tests. |
| All themes/cursors | Clicked all 33 theme choices and all four cursor choices successfully. |
| Narrow layouts | Both layouts fit a 340 CSS-pixel-wide view without horizontal page overflow. This used browser zoom; it was not a physical-phone or touch-device test. |
| 2048 Nebula | A real move changed the score from 0 to 4; reopening restored the same board and score. |
| Orbit Snake / Star Breaker | Start and pause/resume controls responded. |
| Cosmic Pairs | Revealing two cards updated the move counter. |
| Favourites / Album | Added a favourite and saved a game cover; both appeared in their intended views. |
| Game metadata / queue | Rating, notes and Up Next controls responded; starting the queued game removed it from Up Next. |
| Backups | Exported a backup and imported that same file. The restored layout, theme, cursor, favourite count and history matched. |
| Music | Live search returned results; like/queue controls responded. Native audio reached 37 seconds with readyState 4 and no media error. Pause worked. |
| AI | The live service answered the test message with `OK`. |
| Direct video | A public test MP4 loaded and played with readyState 4 and no media error. |
| Movie sources | Atlantic and fprime loaded their catalogue pages. Individual provider films were not played. Cinefork's browser-opening link has the correct destination and opens a separate tab. |
| Cloud catalogue | OrbitOS displayed 300 combined cloud cards and 208 imported-provider cards. Switch All Software also filtered the imported collection correctly. |
| Provider selection | Euro Truck Simulator 2 selected the newer provider in its imported collection and opened its correct `dg0020` launcher. |
| Account controls | Create/sign-in modes, required fields, password confirmation fields and unauthenticated account checks worked. No real password was entered and no live account was created. |
| Application errors | No uncaught JavaScript errors were returned by the browser's error-log check during these flows. |

## Remaining limits

- **Cloud gameplay is not verified.** Achroma reached a real server waiting queue. The newer provider reported that all shared free accounts were in use and its next free-play check was rate limited. Its own valid game-account sign-in remains available. These are external capacity/account requirements; an OrbitOS/Achroma profile does not replace a game-provider account.
- **Real signup/login still needs a user test.** The adapter's success and failure paths passed controlled fixtures, and the forms were checked in the browser. Creating a new real provider account and signing into it was not completed by the agent. Success is only shown after the provider confirms the authenticated username.
- **Live proxy access is not verified.** The preview's selected public-proxy test returned `ENETUNREACH`. The hosted Worker also needs a separately hosted OrbitOS Node bridge for raw proxy connections. No direct-network fallback is represented as proxy success.
- **Address-bar hiding needs a normal-device check.** The native fullscreen control entered/exited its reported state, but the managed desktop's browser toolbar remained visible in the screen capture. The code requests native fullscreen with navigation hidden; the browser controls the final presentation.
- **Physical phones, hardware gamepads, every remote game and every movie stream were not tested.** Browser-width checks and a working launch page do not establish complete gameplay, touch support, server capacity or media licensing/availability.

To reproduce the automated release checks, run `npm run verify` twice from this folder. Keep the provider services and, when using Proxy Web, the configured Node bridge available.
