# Testing Guide - VO Annotations Plugin

This document covers testing procedures for the VO Annotations Figma plugin.

## Table of Contents
1. [Unit Tests](#unit-tests)
2. [Manual Testing](#manual-testing-prerequisites)

---

## Unit Tests

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

Tests are located in `src/__tests__/`:

```
src/__tests__/
├── setup.ts              # Global Figma mock setup
├── fixtures/
│   ├── annotations.ts    # Test annotation factory functions
│   └── frames.ts         # Test frame data
├── utils/
│   └── test-helpers.ts   # Common test utilities
├── services/
│   ├── validation.test.ts        # ValidationService tests (28 tests)
│   └── sync-coordinator.test.ts  # SyncCoordinator tests (11 tests)
├── schema/
│   └── annotation-fields.test.ts # Field schema tests (44 tests)
└── utils/
    └── annotation-deduplication.test.ts # Deduplication tests (27 tests)
```

### Test Coverage (Current)

| Module | Statement Coverage | Notes |
|--------|-------------------|-------|
| `schema/annotation-fields.ts` | 90% | Field definitions and mappings |
| `services/validation.ts` | 86% | Annotation validation logic |
| `utils/annotation-deduplication.ts` | 91% | Deduplication utilities |
| `services/sync-coordinator.ts` | 19% | Change detection only (Figma-dependent code not tested) |

### Writing Tests

**Pattern: Test Pure Logic Only**

Since Figma APIs are not available in the test environment, tests focus on pure logic:

```typescript
// ✅ Good: Testing pure validation logic
it("should reject annotations with empty elementId", () => {
  const result = validation.validateCanvasAnnotation({
    id: 1,
    elementId: "", // Invalid
    platform: "mobile",
  });
  expect(result.isValid).toBe(false);
});

// ❌ Avoid: Testing Figma-dependent code directly
it("should find nodes", async () => {
  const node = await figma.getNodeByIdAsync("123"); // This is mocked but not useful
});
```

**Using Test Fixtures**

```typescript
import { createMobileAnnotation, createWebAnnotation } from "../fixtures/annotations";
import { createFrameInfo } from "../fixtures/frames";

// Create test data with defaults
const annotation = createMobileAnnotation({ id: 1 });

// Override specific fields
const customAnnotation = createMobileAnnotation({
  id: 2,
  voicedPreview: "Custom preview",
  mobile: {
    ios: { label: "Custom", value: "", trait: "Button", hint: "" },
    android: { label: "Custom", value: "", trait: "Button", hint: "" },
  },
});
```

**Mocking Console Output**

Logger calls generate console output. Use `mockConsole()` to suppress:

```typescript
import { mockConsole } from "../utils/test-helpers";

it("should handle operation with logging", () => {
  const consoleMock = mockConsole();
  
  // Your test code that triggers logging
  syncCoordinator.detectAnnotationChanges([], []);
  
  consoleMock.restore(); // Restore original console
});
```

### Figma Global Mock

Tests use a global mock for the `figma` object (defined in `src/__tests__/setup.ts`):

```typescript
// Mocked methods (return empty/default values)
figma.getNodeByIdAsync() → null
figma.currentPage.findAll() → []
figma.notify() → { cancel: vi.fn() }
figma.on() → vi.fn()
```

This mock prevents `ReferenceError: figma is not defined` but does not simulate real Figma behavior. Integration tests requiring Figma APIs should use the mocked services approach (see `openspec/changes/add-integration-testing/`).

---

## Manual Testing Prerequisites

1. **Build the plugin**:
   ```bash
   npm install
   npm run build        # Production build
   npm run build:debug  # Debug build (no minification)
   npm run watch        # Watch mode for development
   ```

2. **Figma Desktop App** - Required for plugin development (browser works for end users)

## Setup Steps

### 1. Create a Test Figma Project

1. Open Figma Desktop App
2. Create a new file or open an existing one
3. Create at least 2-3 top-level frames:
   - Select the Frame tool (F)
   - Draw frames on the canvas
   - Name them: "Login Screen", "Home Screen", "Settings Screen"
   - **Important**: These must be top-level frames (parent is the Page)

### 2. Install the Plugin (Development)

1. In Figma: **Plugins** → **Development** → **Import plugin from manifest...**
2. Navigate to: `manifest.json` (in project root)
3. Select the manifest.json file
4. Plugin appears in: **Plugins** → **Development** → **VO Annotations**

### 3. Open the Plugin

1. Go to: **Plugins** → **Development** → **VO Annotations**
2. The plugin UI should open
3. You should see:
   - Dark header: "Voice over annotations"
   - Frame dropdown (lists your frames, or "No frames available")
   - Mobile/Web platform tabs
   - "Add Annotation" button (disabled until element selected)
   - Empty state message

## Test Scenarios

### Test 1: Frame Selection

**Steps:**
1. Click the "Frame:" dropdown
2. Verify all your frames are listed
3. Select a frame (e.g., "Login Screen")
4. **Expected:**
   - Header updates to show frame name: "Voice over annotations - Login Screen"
   - Empty state shows: "No annotations yet for Login Screen..."
   - "Add Annotation" button remains disabled (no selection)

### Test 2: Create Mobile Annotation

**Steps:**
1. Select the "Login Screen" frame from dropdown
2. In the canvas, select a frame element (e.g., a button or text element inside the Login Screen frame)
3. **Expected:**
   - "Add Annotation" button becomes enabled
   - Frame dropdown auto-selects "Login Screen" (if not already selected)
4. Click "Add Annotation" button
5. **Expected:**
   - Notification: "✅ Annotation 1 created"
   - An accordion item appears in the Mobile tab
   - Accordion shows:
     - Badge number: "1"
     - Voiced preview: e.g., "Button. Knapp."
     - Expandable panel with iOS and Android fields

### Test 3: Edit Annotation

**Steps:**
1. Click the accordion item to expand it
2. **Expected:**
   - Panel opens showing iOS (VoiceOver) and Android (TalkBack) columns
   - Fields: Label, Value, Trait, Hint
3. Edit the iOS Label field:
   - Change "Button" to "Login Button"
   - **Expected:**
     - Textarea auto-resizes as you type
     - Voiced preview updates automatically
     - "Insert into Figma" button text changes to "Update Annotations"
     - Button becomes enabled

### Test 4: Create Web Annotation

**Steps:**
1. Click the "Web" tab
2. **Expected:**
   - Tab switches to Web platform
   - Empty state or existing web annotations shown
3. Select a different element in the Login Screen frame
4. Click "Add Annotation"
5. **Expected:**
   - New annotation created for Web platform
   - Accordion shows Web ARIA fields:
     - aria-label
     - role
     - aria-describedby
     - tabindex

### Test 5: Reorder Annotations

**Steps:**
1. Create 2-3 annotations in the same frame
2. **Expected:**
   - Each has up/down arrows (except first/last)
3. Click "↑" on annotation #2
4. **Expected:**
   - Annotation #2 moves to position #1
   - Numbers update accordingly
   - "Update Annotations" button becomes enabled

### Test 6: Delete Annotation

**Steps:**
1. Click the trash icon (🗑) on an annotation
2. **Expected:**
   - Confirmation dialog: "Are you sure you want to delete this annotation?"
3. Click "OK"
4. **Expected:**
   - Annotation removed from list
   - "Update Annotations" button becomes enabled

### Test 7: Insert Annotations into Figma

**Steps:**
1. Ensure you have at least one annotation created
2. Click "Insert into Figma" button
3. **Expected:**
   - Confirmation dialog: "Insert X annotation(s) for Login Screen?..."
4. Click "OK"
5. **Expected:**
   - Notification: "✅ Inserted X annotations"
   - On canvas, you should see:
     - Gray numbered badges next to annotated elements
     - Detailed annotation tables showing iOS/Android or Web ARIA data
   - Button text changes to "Update Annotations" (disabled until changes)

### Test 8: Update Annotations

**Steps:**
1. After inserting, edit an annotation field
2. **Expected:**
   - "Update Annotations" button becomes enabled
3. Click "Update Annotations"
4. **Expected:**
   - Confirmation: "Update X annotation(s) for Login Screen?..."
5. Click "OK"
6. **Expected:**
   - Notification: "✅ Inserted X annotations"
   - Canvas updates with new annotation data
   - Button becomes disabled again

### Test 9: Toggle Visibility

**Steps:**
1. After inserting annotations, you should see tables on canvas
2. In plugin footer, toggle the switch to "Hide all"
3. **Expected:**
   - Notification: "Details hidden"
   - All annotation tables on canvas become invisible
   - Badges remain visible
4. Toggle back to "Show all"
5. **Expected:**
   - Notification: "Details shown"
   - Tables become visible again

### Test 10: Multiple Frames

**Steps:**
1. Create annotations in "Login Screen"
2. Switch frame dropdown to "Home Screen"
3. **Expected:**
   - Header updates: "Voice over annotations - Home Screen"
   - Empty state or annotations for Home Screen shown
   - Previous Login Screen annotations not visible
4. Create a new annotation in Home Screen
5. Switch back to Login Screen
6. **Expected:**
   - Login Screen annotations still there
   - Frame-specific annotations are preserved

### Test 11: Auto Frame Detection

**Steps:**
1. Select an element inside a frame on the canvas
2. **Expected:**
   - Plugin auto-detects the frame
   - Frame dropdown auto-selects the correct frame
   - Header updates with frame name
   - "Add Annotation" button enables if element is selected

### Test 12: Persistence

**Steps:**
1. Create several annotations across different frames
2. Insert some into Figma
3. Close the plugin
4. Reopen the plugin
5. **Expected:**
   - All annotations are still there
   - Frame dropdown shows all frames
   - Annotations persist across plugin sessions

## Edge Cases to Test

### Edge Case 1: No Frames
- Delete all frames from page
- Open plugin
- **Expected:** Frame dropdown shows "No frames available"

### Edge Case 2: Element Not in Frame
- Select an element that's not inside any top-level frame
- Try to create annotation
- **Expected:** Error notification or "Add Annotation" button remains disabled

### Edge Case 3: Multiple Selection
- Select 2+ elements at once
- **Expected:** "Add Annotation" button disabled (single selection required)

### Edge Case 4: Empty Frame
- Select a frame with no annotations
- **Expected:** Empty state: "No annotations yet for {frameName}. Select an element and click "Add Annotation" to begin."

### Edge Case 5: Deleted Element
- Create an annotation for an element
- Delete the element from canvas
- Reopen plugin
- **Expected:** Annotation is removed (data stored on node)

### Edge Case 6: Canvas Edit Sync
- Insert annotations into Figma
- Edit text directly in the canvas annotation table
- Trigger sync (select the table or wait)
- **Expected:** UI updates to reflect canvas changes (bidirectional sync)

## Debugging Tips

1. **Open Console:**
   - In Figma: **Plugins** → **Development** → **Show/Hide Console**
   - Check for error messages or debug logs
   - Logger output uses structured format: `[Context] message {data}`

2. **Check Build:**
   - If plugin doesn't load, verify `npm run build` completed successfully
   - Check `build/` directory has `main.js`, `ui.js`, `store.js`

3. **Reload Plugin:**
   - After code changes, rebuild and reload:
     - **Plugins** → **Development** → **Reload plugin**
   - Or use watch mode: `npm run watch`

4. **Common Issues:**
   - **Plugin won't open:** Check manifest.json path is correct
   - **No frames detected:** Ensure frames are top-level (parent is Page)
   - **Annotations not saving:** Check console for storage errors
   - **Sync issues:** Check for "Canvas sync" log messages
   - **Tables not updating:** Try "Update Annotations" button or check for node.removed errors

## Expected Behavior Summary

✅ Frame dropdown lists all top-level frames (or "No frames available")
✅ Selecting frame updates header and filters annotations  
✅ Platform tabs switch between Mobile/Web views  
✅ Creating annotation requires: frame selected + element selected  
✅ Editing annotations auto-saves and enables update button  
✅ Reordering works with up/down arrows  
✅ Deleting shows confirmation dialog  
✅ Insert creates badges and tables on canvas  
✅ Update refreshes canvas elements  
✅ Toggle shows/hides annotation tables ("Hide all" / "Show all")
✅ Annotations persist across plugin sessions (stored on nodes)
✅ Auto-detection switches frame when selecting elements
✅ Canvas edits sync back to UI (bidirectional sync)

---

## Performance Benchmarking

### Overview

The plugin includes performance monitoring to ensure operations meet PRD requirements:

- **Plugin load time:** < 2 seconds
- **UI interactions:** < 100ms lag
- **Canvas annotation rendering (50+ annotations):** < 5 seconds
- **Individual canvas insert:** < 1 second
- **Annotation list render:** < 50ms

### Enabling Performance Monitoring

Performance monitoring is disabled by default to minimize overhead. To enable for **development/testing only**:

1. Temporarily update the plugin settings in `src/store.ts`:
   ```typescript
   export const defaultPluginSettings: PluginSettings = {
     enablePerformanceMonitoring: true,  // ⚠️ DEVELOPMENT ONLY - disable for production
     performanceLogLevel: 'detailed', // 'none' | 'basic' | 'detailed'
     // ... other settings
   }
   ```
   **Note:** This affects all users. Only use this approach during development and revert before committing.

2. Or programmatically enable it for specific debugging sessions:
   ```typescript
   import { updatePluginSettings } from './store'
   
   // Enable temporarily for debugging
   updatePluginSettings({
     enablePerformanceMonitoring: true,
     performanceLogLevel: 'basic'
   })
   
   // ... test/debug ...
   
   // Disable when done
   updatePluginSettings({
     enablePerformanceMonitoring: false
   })
   ```

### Performance Logging Levels

- **none**: No performance logs (monitoring still tracks timing internally)
- **basic**: Log only slow operations (> 100ms)
- **detailed**: Log all timed operations with thresholds

### Running Performance Tests

Performance tests are included in the integration test suite:

```bash
# Run all tests including performance benchmarks
npm test

# Run only benchmark tests
npx vitest run src/__tests__/integration/benchmark.test.ts
```

### Baseline Measurements

Performance benchmarks are validated against PRD thresholds:

| Operation | Threshold | Typical Duration | Status |
|-----------|-----------|------------------|--------|
| Plugin initialization | < 2000ms | ~100-500ms | ✅ Pass |
| UI button click | < 100ms | ~1-5ms | ✅ Pass |
| Annotation list render (20 items) | < 50ms | ~1-10ms | ✅ Pass |
| Canvas insert (single annotation) | < 1000ms | ~50-200ms | ✅ Pass |
| Canvas render (50 annotations) | < 5000ms | ~1000-3000ms | ✅ Pass |

*Note: Actual timings vary based on hardware, Figma file complexity, and number of annotations.*

### Using the Benchmark Utility

The benchmark utility (`src/utils/benchmark.ts`) provides helpers for timing critical operations:

```typescript
import { benchmark, PERFORMANCE_THRESHOLDS } from './utils/benchmark'

// Start/stop pattern
benchmark.start('my-operation')
// ... do work ...
const duration = benchmark.stop('my-operation', PERFORMANCE_THRESHOLDS.UI_INTERACTION)

// Measure synchronous operation
const result = benchmark.measure('sync-op', () => {
  return expensiveCalculation()
}, 100)

// Measure async operation
const result = await benchmark.measureAsync('async-op', async () => {
  return await fetchData()
}, 1000)

// Get statistics
const stats = benchmark.getStats('my-operation')
console.log(`Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms`)

// Export results for analysis
const json = benchmark.export()
```

### Performance Optimizations

#### List Virtualization

For 20+ annotations, the plugin automatically enables virtualized list rendering to maintain smooth scrolling:

- **Without virtualization:** All items rendered (may lag with 50+ items)
- **With virtualization:** Only visible items rendered (smooth with 100+ items)
- **Trigger:** Automatically enabled when `platformAnnotations.length >= 20` and `enablePerformanceMonitoring === true`

#### Message Batching

UI updates are batched to reduce communication overhead:

- **Batch delay:** 50ms
- **Max batch size:** 100 messages
- **Priority support:** High-priority messages bypass batching

#### Batch Processing

Canvas operations use concurrent batching with configurable limits:

- **Max concurrency:** 3 operations (configurable via `maxConcurrentSyncs`)
- **Priority ordering:** High → Normal → Low
- **Progress tracking:** Optional callback for UI progress bars

### Monitoring in Production

To monitor performance in production:

1. Enable performance monitoring temporarily
2. Use the benchmark export feature to collect metrics
3. Analyze the JSON output for bottlenecks
4. Disable monitoring when done to reduce overhead

Example:

```typescript
// Enable monitoring
updatePluginSettings({ enablePerformanceMonitoring: true })

// ... use plugin normally ...

// Export results
const metrics = benchmark.export()
console.log(metrics) // Copy and analyze

// Disable monitoring
updatePluginSettings({ enablePerformanceMonitoring: false })
```

---
