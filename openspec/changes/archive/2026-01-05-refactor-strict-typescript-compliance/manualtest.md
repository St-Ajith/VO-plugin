# Manual Test: Strict TypeScript Compliance

## Status

- Copy/paste crash resolved: UI now adds new frames to `screens` on `FRAME_AUTO_SWITCHED`, so pasted frames (with or without annotations) no longer trigger invalid dropdown values.

Follow this smoke checklist in the Figma plugin and capture console/debug logs for each step.

## Prereqs

- Use the standard dev/test Figma file with a frame containing at least one table and badge.
- Start the plugin from the current branch build; open the Figma console for logs.

## Steps

- [x] Launch: Run the plugin; confirm it loads without console errors.
- [ ] Create/update/delete: Add an annotation to a frame, edit its text/platform fields, then delete it. Badge/table should reflect changes; no stuck toasts/errors.
- [ ] Reorder: Move an annotation up/down; order updates in both canvas badge/table and annotation list.
- [ ] Persist/load: Save, close plugin (or reselect frame), reopen; annotations reload correctly.
- [ ] Cross-platform fields: Add mobile and web data; conditional fields appear and save without errors.
- [ ] Duplicate request guard: Perform the same action twice quickly (e.g., two deletes). No duplicate notifications or crashes.
- [ ] Undo/redo: Undo the last change in Figma, then redo; annotations and badges remain consistent.
- [ ] Performance quick check: Create or edit ~5–10 annotations; no noticeable lag or warning spam.

## Recording Results

- For each step, paste the observed result, console lines (if any), and whether it passed/failed.

## Error log
