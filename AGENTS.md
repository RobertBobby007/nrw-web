# NRW Agent Notes

## i18n and Crowdin

- Any new user-facing text must be added through the i18n layer, not hardcoded directly in JSX, dialogs, toasts, placeholders, badges, or API response messages.
- New source strings belong in `src/messages/cs.json`.
- Keep `src/messages/en.json` in sync when adding new keys.
- Preserve compatibility with `src/messages/sk.json` so Crowdin can fill Slovak translations without extra runtime changes.
- Prefer `t("...")`, `translate(...)`, and shared i18n helpers over inline strings.
- When adding locale-sensitive dates, times, or counts, use centralized locale helpers instead of branching only between `cs-CZ` and `en-US`.
- If a feature introduces new UI copy but does not update message files, treat it as incomplete work.
