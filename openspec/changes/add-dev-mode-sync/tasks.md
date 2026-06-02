## 1. Foundation

- [ ] 1.1 Update `@figma/plugin-typings` to latest version for Annotation API types
- [ ] 1.2 Add `devModeSyncEnabled` to `UserSettings` in `types.ts` (default: true)
- [ ] 1.3 Create `src/services/dev-mode-service.ts` with `DevModeService` class skeleton

## 2. Category Management

- [ ] 2.1 Implement `ensureAccessibilityCategory()` - finds or creates "Accessibility" category
- [ ] 2.2 Add category color constant (violet) and label constant
- [ ] 2.3 Cache category ID after first lookup to avoid repeated async calls

## 3. Markdown Formatting

- [ ] 3.1 Create `formatAnnotationAsMarkdown(annotation: Annotation): string` utility
- [ ] 3.2 Handle mobile platform formatting (iOS + Android sections)
- [ ] 3.3 Handle web platform formatting (ARIA section)
- [ ] 3.4 Include annotation order/ID prominently
- [ ] 3.5 Add unit tests for markdown formatting

## 4. Sync Operations

- [ ] 4.1 Implement `syncAnnotationToNative(annotation: Annotation): Promise<void>`
- [ ] 4.2 Implement `removeNativeAnnotation(elementId: string, annotationId: number): Promise<void>`
- [ ] 4.3 Implement `syncAllAnnotationsForFrame(frameId: string, annotations: Annotation[]): Promise<void>`
- [ ] 4.4 Handle case where node no longer exists gracefully

## 5. Integration with Message Router

- [ ] 5.1 Initialize `DevModeService` in `MessageRouter` constructor
- [ ] 5.2 Hook sync into `handleInsertAnnotationsBatched()` - sync after table creation
- [ ] 5.3 Hook sync into `handleUpdateAnnotations()` - sync after table update
- [ ] 5.4 Hook removal into delete handler - remove native annotation
- [ ] 5.5 Hook sync into `SYNC_CANVAS` handler - refresh native annotations

## 6. User Settings

- [ ] 6.1 Add "Dev Mode Sync" toggle to settings UI (if settings panel exists)
- [ ] 6.2 Respect `devModeSyncEnabled` setting in sync operations
- [ ] 6.3 Persist setting via existing settings mechanism

## 7. Error Handling & Graceful Degradation

- [ ] 7.1 Detect Figma API availability (try-catch around annotation API calls)
- [ ] 7.2 Log warning if native annotation API unavailable
- [ ] 7.3 Continue canvas rendering even if native sync fails
- [ ] 7.4 Add circuit breaker to prevent repeated failures

## 8. Testing

- [ ] 8.1 Unit tests for `DevModeService` methods
- [ ] 8.2 Integration test: insert annotations creates native annotations
- [ ] 8.3 Integration test: delete annotation removes native annotation
- [ ] 8.4 Integration test: disabled setting skips native sync
- [ ] 8.5 Manual testing in Figma Dev Mode

## 9. Documentation

- [ ] 9.1 Update PLUGIN_SUMMARY.md with Dev Mode Sync capability
- [ ] 9.2 Update README.md with developer handoff workflow
- [ ] 9.3 Add inline code documentation to DevModeService

## Dependencies

- Task 1.1 must complete before 2.x and 4.x (types needed)
- Task 2.x must complete before 4.x (category needed for sync)
- Task 3.x must complete before 4.x (formatting needed for sync)
- Tasks 2-4 can run in parallel after 1.x
- Task 5.x depends on 4.x (integration needs working service)
- Task 7.x can run in parallel with 5-6
- Task 8.x depends on 5.x (tests need integration)
