# Design: Dev Mode Sync

## Context

Figma introduced native annotations (Dev Mode Annotations) that appear in the sidebar during Dev Mode. These are separate from plugin-created canvas elements. The plugin currently renders accessibility data as custom tables and badges on the canvas, which are invisible in Dev Mode's structured view.

**Stakeholders**:
- Designers: Continue using canvas tables during design phase
- Developers: Consume accessibility specs via Dev Mode sidebar
- Plugin: Must maintain both systems in sync

**Constraints**:
- Figma's `node.annotations` API is write-only from plugin perspective
- Native annotations support Markdown via `labelMarkdown` property
- Categories must be created per-document (not global)
- API availability depends on Figma version

## Goals / Non-Goals

### Goals
1. Sync plugin accessibility annotations to Figma native annotations
2. Create a dedicated "Accessibility" category for visual organization
3. Format annotation data as readable Markdown
4. One-way sync: plugin is source of truth

### Non-Goals
- Bidirectional sync (reading native annotations back to plugin) - future enhancement
- Replacing canvas rendering - designers need visual tables
- Real-time character-by-character sync - too expensive, use save-time sync

## Decisions

### Decision 1: One-Way Sync Direction
**What**: Plugin annotations → Native Figma annotations (not bidirectional)

**Why**: 
- Plugin data is the authoritative source with richer schema
- Native annotations are for consumption, not editing
- Bidirectional sync adds complexity and conflict resolution needs
- Canvas sync already handles designer edits

**Alternatives considered**:
- Full bidirectional sync: Too complex, conflict resolution unclear
- No sync: Misses Dev Mode opportunity

### Decision 2: Sync Triggers
**What**: Sync native annotations on INSERT_ANNOTATIONS, UPDATE_ANNOTATIONS, and DELETE_ANNOTATION

**Why**:
- INSERT_ANNOTATIONS is when designers finalize annotations for handoff
- UPDATE_ANNOTATIONS refreshes existing tables, should also refresh native
- DELETE_ANNOTATION must clean up native annotation to prevent stale data

**Alternatives considered**:
- Real-time on every field edit: Too expensive, would spam Figma API
- Manual sync button: Extra friction, easy to forget

### Decision 3: Markdown Format
**What**: Use structured Markdown with headers and lists

```markdown
## Accessibility
**Order:** 12

### Mobile
- **Role:** Button
- **iOS Hint:** Dobbelttrykk for å åpne
- **Android Hint:** Dobbelttrykk for å aktivere

### Web
- **ARIA Label:** Close Modal
- **Role:** button
- **Described By:** modal-description
```

**Why**:
- Readable in Dev Mode sidebar
- Hierarchical structure matches our data model
- Markdown is well-supported by Figma's annotation renderer

### Decision 4: Category Management
**What**: Create "Accessibility" category with violet color on first use, reuse thereafter

**Why**:
- Categories are document-scoped, must check existence first
- Violet/purple color is distinct and associated with accessibility in many design systems
- Single category keeps annotations organized

### Decision 5: Service Architecture
**What**: New `DevModeService` class, not integrated into existing `CanvasService`

**Why**:
- Separation of concerns: canvas rendering vs native annotation sync
- Different lifecycles and dependencies
- Easier to enable/disable independently
- Cleaner testing

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Figma API changes | Abstract API calls behind service methods; version check |
| Performance on large annotation sets | Batch native annotation updates; parallel processing |
| Stale native annotations | Delete sync ensures cleanup; consider periodic validation |
| User confusion about two annotation systems | Document in help text; consistent data between both |

## Migration Plan

1. **No migration needed**: New feature, no existing data to migrate
2. **Rollout**: Enable by default with user setting to disable
3. **Rollback**: Disable setting returns to canvas-only behavior

## Open Questions

1. ~~Should we support Figma annotation properties (pinning width, fills)?~~ **Answered**: No, focus on descriptive notes only for V1
2. Consider future enhancement: Link to external a11y documentation in annotation
