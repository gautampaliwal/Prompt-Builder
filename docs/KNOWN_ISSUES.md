# Known issues and limitations

| Date       | Issue                                                                                              | Impact                                      | Plan                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2026-10-27 | TypeScript pinned to 6.0 (7.0 exists) for typescript-eslint compatibility                          | None today                                  | Upgrade when typescript-eslint supports TS 7                                                 |
| 2026-10-27 | Hook config verified against a secondary source (official docs unreachable from the build sandbox) | Hooks could misbehave if the schema changed | Confirm on the first local Claude Code session                                               |
| 2026-10-27 | On narrow screens the Builder preview is below the whole form, so you scroll to see it             | Mobile usability                            | M6 responsive pass: e.g. a sticky "Preview" jump link or a tab toggle                        |
| 2026-10-27 | Initial JS is 120 KB gz after adding Zod and React Hook Form (budget 250 KB)                       | Headroom shrinks as features land           | Watch `check:size`; consider `zod/mini` or route-level code splitting if it nears the budget |
| 2026-10-27 | Screens other than Builder are placeholders                                                        | Partial functionality                       | M2–M6                                                                                        |

## Inherent limitations (by design)

- Browser storage (IndexedDB) is unencrypted and can be cleared by the user or browser. Exports are the real backup (from M5).
- Token counts are estimates: the heuristic is approximate, and the tiktoken mode is exact only for OpenAI-family models.
