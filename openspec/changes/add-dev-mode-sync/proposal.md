# Change: Add Dev Mode Sync for Native Figma Annotations

## Why

Developers working in Figma's Dev Mode cannot easily access plugin-rendered accessibility annotations without panning around the canvas to find tables. Figma's native annotation system is visible directly in the Dev Mode sidebar, making it the ideal surface for developer handoff. By syncing our accessibility data to Figma's native annotation API, we become a "first-class citizen" in Dev Mode while preserving our custom canvas rendering for designers.

## What Changes

- **New service**: `DevModeService` handles synchronization between plugin annotations and Figma native annotations
- **Custom category**: Creates an "Accessibility" annotation category with purple color for visual distinction
- **Markdown formatting**: Converts annotation data into clean, readable Markdown for `labelMarkdown` property
- **One-way sync**: Plugin → Figma native annotations (on insert/update, not bidirectional)
- **Lifecycle management**: Native annotations are created, updated, and deleted in sync with plugin annotations
- **Opt-in configuration**: User setting to enable/disable Dev Mode sync (default: enabled)

### Enhancements Beyond Base Request

1. **Batch sync on "Sync Canvas"**: When user triggers SYNC_CANVAS, also refresh native annotations
2. **Category reuse**: Check for existing "Accessibility" category before creating to avoid duplicates
3. **Graceful degradation**: If native annotation API unavailable (older Figma versions), log warning and continue
4. **Annotation linking**: Store native annotation reference in table metadata for future bidirectional sync potential

## Impact

- **Affected specs**: 
  - `sync` (new sync target: native annotations)
  - `canvas-rendering` (integration point after table creation)
- **Affected code**: 
  - `src/services/message-router.ts` (hook into INSERT_ANNOTATIONS, UPDATE_ANNOTATIONS)
  - `src/types.ts` (new user settings, message types)
  - New file: `src/services/dev-mode-service.ts`
- **Dependencies**: Requires `@figma/plugin-typings` to be up-to-date for `Annotation`, `AnnotationCategory` types
