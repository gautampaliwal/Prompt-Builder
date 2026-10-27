# Known issues and limitations

| Date       | Issue                                                                                                                         | Impact                                           | Plan                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| 2026-10-27 | TypeScript pinned to 6.0 (7.0 exists) for typescript-eslint compatibility                                                     | None today                                       | Upgrade when typescript-eslint supports TS 7     |
| 2026-10-27 | M0 E2E was run locally against preinstalled Chromium 153 via `PW_CHROMIUM_PATH`; Playwright 1.64 expects its own Chromium 156 | Local E2E evidence uses a slightly older browser | CI uses the bundled browser and is authoritative |
| 2026-10-27 | Hook config verified against a secondary source (official docs unreachable from the build sandbox)                            | Hooks could misbehave if the schema changed      | Confirm on the first local Claude Code session   |
| 2026-10-27 | `src/` contains placeholder screens only                                                                                      | No product functionality yet                     | M1+                                              |

## Inherent limitations (by design)

- Browser storage (IndexedDB) is unencrypted and can be cleared by the user or browser. Exports are the real backup (from M5).
- Token counts are estimates: the heuristic is approximate, and the tiktoken mode is exact only for OpenAI-family models.
