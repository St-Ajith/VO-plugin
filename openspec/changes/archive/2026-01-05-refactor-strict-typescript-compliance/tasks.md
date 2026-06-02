# Tasks: Refactor Strict TypeScript Compliance

Tasks combine production code fixes with their corresponding test file fixes to keep context fresh. When fixing a production file, also fix its test files in the same task.

---

## Phase 1: noImplicitOverride (~6 errors)

**Fastest to fix - single file, mechanical changes**

- [x] **T1.1** Add `override` keyword to mock class methods in `src/__tests__/mocks/figma-api.ts`
- [x] **T1.2** Validate: `npx tsc --noEmit 2>&1 | grep -c "noImplicitOverride"` should return 0

---

## Phase 2: noUncheckedIndexedAccess - Production Code + Tests (~60 production + ~100 test errors)

**Approach:** Each task fixes production code and its corresponding test files together to keep context fresh.

### 2A: Regex Capture Groups (~15 errors)

- [x] **T2A.1** Fix regex capture in `src/services/canvas-parser.ts` line 336: `nameMatch[1]` → destructure with guards
- [x] **T2A.2** Fix regex capture in `src/services/canvas-parser.ts` line 336: `nameMatch[2]` → destructure with guards
- [x] **T2A.3** Fix regex capture in `src/services/canvas-parser.ts` line 342: `frameId` from match → guard before use
- [x] **T2A.4** Fix regex capture in `src/services/canvas-parser.ts` line 360: `frameId` from match → guard before use
- [x] **T2A.5** Fix regex capture in `src/services/canvas-parser.ts` line 386: `frameId` from match → guard before use
- [x] **T2A.6** Fix regex capture in `src/services/canvas-parser.ts` line 464: `frameId` from match → guard before use
- [x] **T2A.7** Fix regex capture in `src/services/canvas-parser.ts` line 468: `frameId` from match → guard before use
- [x] **T2A.8** Fix regex capture in `src/services/canvas.ts` line 358: `match[1]` → destructure `const [, id] = match ?? []`
- [x] **T2A.9** Fix regex capture in `src/services/canvas.ts` line 402: `match[1]` → destructure `const [, id] = match ?? []`
- [x] **T2A.10** Fix regex capture in `src/services/canvas.ts` line 502: `frameId` from regex → guard before cache/return
- [x] **T2A.11** Fix regex capture in `src/services/canvas.ts` line 503: `frameId` from regex → guard before cache/return
- [x] **T2A.12** Fix regex captures in `src/__tests__/integration/canvas-operations.test.ts` lines 156-157
- [x] **T2A.13** Fix regex captures in `src/__tests__/integration/canvas-operations.test.ts` lines 180-181
- [x] **T2A.14** Fix regex captures in `src/__tests__/integration/canvas-operations.test.ts` lines 305-306
- [x] **T2A.15** Fix regex captures in `src/__tests__/integration/canvas-operations.test.ts` lines 365-366
- [x] **T2A.16** Fix regex captures in `src/__tests__/integration/canvas-operations.test.ts` lines 460-467
- [x] **T2A.17** Fix regex captures in `src/__tests__/integration/canvas-operations.test.ts` lines 496-503
- [x] **T2A.18** Fix regex captures in `src/__tests__/services/canvas-container.test.ts` lines 383-389
- [x] **T2A.19** Fix regex captures in `src/__tests__/services/canvas-container.test.ts` line 421
- [x] **T2A.20** Fix regex captures in `src/__tests__/services/canvas-container.test.ts` lines 453-456
- [x] **T2A.21** Fix regex captures in `src/__tests__/services/canvas-container.test.ts` lines 498-507
- [x] **T2A.22** Fix regex captures in `src/__tests__/services/canvas-container.test.ts` lines 548-554
- [x] **T2A.23** Fix regex captures in `src/__tests__/services/canvas-container.test.ts` lines 600-606
- [x] **T2A.24** Fix regex captures in `src/__tests__/integration/container-operations.test.ts` line 120
- [x] **T2A.25** Fix regex captures in `src/__tests__/integration/container-operations.test.ts` lines 164-170
- [x] **T2A.26** Fix regex captures in `src/__tests__/integration/container-operations.test.ts` lines 216-222
- [x] **T2A.27** Fix regex capture in `src/services/frame-manager.ts` line 199: `nameMatch[1]` → destructure with guard
- [x] **T2A.28** Fix regex capture in `src/ui/frame-utils.ts` line 79: `nameMatch[1]` → destructure with fallback
- [x] **T2A.29** Fix regex capture in `src/ui/frame-utils.ts` line 80: `nameMatch[2]` → destructure with fallback

### 2B: Array First-Element Access (~20 errors)

- [x] **T2B.1** Fix selection access in `src/services/frame-manager.ts` line 67: `selection[0]` → `const [firstSelection] = selection; if (!firstSelection) return null;`
- [x] **T2B.2** Fix selection access in `src/services/frame-manager.ts` line 169: `selectedNode` from selection → guard chain
- [x] **T2B.3** Fix selection access in `src/services/frame-manager.ts` line 172: `selectedNode` from selection → guard chain
- [x] **T2B.4** Fix selection access in `src/services/frame-manager.ts` line 187: `selectedNode` from selection → guard chain
- [x] **T2B.5** Fix selection access in `src/services/frame-manager.ts` line 211: `selectedNode` from selection → guard chain
- [x] **T2B.6** Fix selection access in `src/services/frame-manager.ts` line 278: `selectedNode` from selection → guard chain
- [x] **T2B.7** Fix selection access in `src/services/frame-manager.ts` line 287: `selectedNode` from selection → guard chain
- [x] **T2B.8** Fix selection access in `src/services/frame-manager.ts` line 294: `selectedNode` from selection → guard chain
- [x] **T2B.9** Fix selection access in `src/services/message-router.ts` lines 156-160: `target` from selection → destructure and guard
- [x] **T2B.10** Fix selection access in `src/services/message-router.ts` line 184: `target` from selection → destructure and guard
- [x] **T2B.11** Fix selection access in `src/services/message-router.ts` lines 197-206: `target` from selection → destructure and guard
- [x] **T2B.12** Fix selection access in `src/services/message-router.ts` line 219: `target` from selection → destructure and guard
- [x] **T2B.13** Fix selection access in `src/__tests__/integration/message-mocks.test.ts` lines 31-34
- [x] **T2B.14** Fix selection access in `src/__tests__/integration/message-mocks.test.ts` lines 46-47
- [x] **T2B.15** Fix selection access in `src/__tests__/integration/message-mocks.test.ts` lines 67-68
- [x] **T2B.16** Fix selection access in `src/__tests__/integration/message-mocks.test.ts` line 79
- [x] **T2B.17** Fix array access in `src/services/annotation-store.ts` line 297: `this.annotations[existingIndex]` → guard index bounds
- [x] **T2B.18** Fix array access in `src/services/annotation-store.ts` line 361: `this.annotations[index]` → guard before swap/use
- [x] **T2B.19** Fix array access in `src/services/annotation-store.ts` line 517: `this.annotations[index]` → guard before swap/use
- [x] **T2B.20** Fix array access in `src/hooks/useNodeChangeSync.ts` line 56: `currentAnnotation` → guard before property access

### 2C: Column Width Arrays (~12 errors)

- [x] **T2C.1** Fix column widths in `src/services/canvas-platform-ios.ts` lines 44-46: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.2** Fix column widths in `src/services/canvas-platform-ios.ts` lines 63-64: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.3** Fix column widths in `src/services/canvas-platform-ios.ts` line 105: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.4** Fix column widths in `src/services/canvas-platform-ios.ts` lines 147-148: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.5** Fix column widths in `src/services/canvas-platform-ios.ts` lines 222-233: Guard `textNodes[0]`, `textNodes[1]`, `textNodes[2]` and `expectedRow`
- [x] **T2C.6** Fix column widths in `src/services/canvas-platform-mobile.ts` lines 52-54: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.7** Fix column widths in `src/services/canvas-platform-mobile.ts` lines 71-72: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.8** Fix column widths in `src/services/canvas-platform-mobile.ts` line 109: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.9** Fix column widths in `src/services/canvas-platform-mobile.ts` lines 151-152: Destructure `const [labelWidth, iosWidth, androidWidth] = columnWidths`
- [x] **T2C.10** Fix column widths in `src/services/canvas-platform-mobile.ts` lines 231-242: Guard textNodes and expectedRow
- [x] **T2C.11** Fix column widths in `src/services/canvas-platform-web.ts` lines 47-48: Destructure `const [labelWidth, valueWidth] = columnWidths`
- [x] **T2C.12** Fix column widths in `src/services/canvas-platform-web.ts` line 63: Destructure `const [labelWidth, valueWidth] = columnWidths`
- [x] **T2C.13** Fix column widths in `src/services/canvas-platform-web.ts` lines 133-138: Guard textNodes and expectedRow
- [x] **T2C.14** Fix column widths in `src/services/canvas.ts` line 657: `labelColumnWidth` → guard or use fallback

### 2D: Table Row/Cell Access (~10 errors)

- [x] **T2D.1** Fix row access in `src/services/canvas-parser.ts` line 278: `row` from rows array → guard before accessing `row.children`
- [x] **T2D.2** Fix row access in `src/services/canvas-parser.ts` line 317: `cellValue` → already guarded by loop, add explicit check
- [x] **T2D.3** Fix row access in `src/services/canvas-parser.ts` line 428: `headerRow` → guard
- [x] **T2D.4** Fix row access in `src/services/canvas-parser.ts` line 439: `headerCells[i]` → guard
- [x] **T2D.5** Fix row access in `src/services/message-router.ts` line 1352: `targetRow` → guard
- [x] **T2D.6** Fix row access in `src/services/message-router.ts` line 1383: `textNodes[cellLocation.cellIndex]` → guard
- [x] **T2D.7** Fix loop access in `src/services/canvas.ts` line 1087: `allAnnotationsForFrame[i]` → guard in loop
- [x] **T2D.8** Fix loop access in `src/services/canvas.ts` line 1207: `sortedAnnotations[i]` → guard in loop
- [x] **T2D.9** Fix transaction wrapper in `src/utils/transaction-wrapper.ts` line 135: `child` from children array → `if (!child) continue;`
- [x] **T2D.10** Fix transaction wrapper in `src/utils/transaction-wrapper.ts` line 145: `child` from children array → `if (!child) continue;`
- [x] **T2D.11** Fix transaction wrapper in `src/utils/transaction-wrapper.ts` line 147: `child` from children array → `if (!child) continue;`

### 2E: Schema Field Access (~5 errors)

- [x] **T2E.1** Fix schema field access in `src/schema/annotation-fields.ts` line 307: `rowFields[0]` → guard before access
- [x] **T2E.2** Fix schema field access in `src/schema/annotation-fields.ts` line 360: `field` → guard before access
- [x] **T2E.3** Fix schema field access in `src/schema/annotation-fields.ts` line 365: `field` → guard before access
- [x] **T2E.4** Fix schema field access in `src/schema/annotation-fields.ts` line 492: `expectedMobileRows[i]` → guard or use `!`
- [x] **T2E.5** Fix schema field access in `src/schema/annotation-fields.ts` line 502: `expectedWebRows[i]` → guard or use `!`

### 2F: Computed Property Names (~6 errors)

- [x] **T2F.1** Fix computed keys in `src/hooks/useAnnotationOperations.ts` line 58: Add length check then cast `parts[1] as string`
- [x] **T2F.2** Fix computed keys in `src/hooks/useAnnotationOperations.ts` line 60: Add length check then cast `parts[1] as string`
- [x] **T2F.3** Fix computed keys in `src/hooks/useAnnotationOperations.ts` line 66: Add length check then cast `parts[1] as string`
- [x] **T2F.4** Fix computed keys in `src/ui/components/AccordionItem.tsx` line 109: Add length validation
- [x] **T2F.5** Fix computed keys in `src/ui/components/AccordionItem.tsx` line 111: Add length validation
- [x] **T2F.6** Fix computed keys in `src/ui/components/AccordionItem.tsx` line 117: Add length validation

### 2G: Misc Production Fixes (~5 errors)

- [x] **T2G.1** Fix figma-helpers in `src/utils/figma-helpers.ts` line 205: `parts[0]` → destructure with fallback
- [x] **T2G.2** Fix figma-helpers in `src/utils/figma-helpers.ts` line 212: `parts[0]` → destructure with fallback
- [x] **T2G.3** Fix figma-helpers tests in `src/__tests__/utils/figma-helpers.test.ts` lines 81-82: `result[0]`, `result[1]`
- [x] **T2G.4** Fix figma-helpers tests in `src/__tests__/utils/figma-helpers.test.ts` line 124: `result[0]`, `result[1]`

- [x] **T2.Validation** Validate Phase 2: `npm run build:debug 2>&1 | grep -c "TS2532\|TS18048\|TS2345\|TS2464"` targeting 0 (excluding test files)

---

## Phase 3: exactOptionalPropertyTypes - Production Code + Tests (~15 production + ~20 test errors)

**Approach:** Each task fixes production code and its corresponding test files together to keep context fresh.

- [x] **T3.1** Fix message-router emit calls in `src/services/message-router.ts` lines 842-845: Use `...(requestId && { requestId })`
- [x] **T3.2** Fix message-router emit calls in `src/services/message-router.ts` line 893: Use `...(requestId && { requestId })`
- [x] **T3.3** Fix message-router emit calls in `src/services/message-router.ts` lines 947-950: Use `...(requestId && { requestId })`
- [x] **T3.4** Fix annotation object literal in `src/services/annotation-store.ts` line 98: Use conditional spread for `mobile`/`web`
- [x] **T3.5** Fix annotation object literal in `src/services/migration-service.ts` line 86: Use conditional spread for `mobile`/`web`
- [x] **T3.6** Fix annotation object literal in `src/services/node-change-coordinator.ts` line 343: Use conditional spread for `mobile`/`web`
- [x] **T3.7** Fix validation return type in `src/services/validation.ts` line 79: Use `...(errors.length > 0 && { errors })`
- [x] **T3.8** Fix validation return type in `src/utils/event-helpers.ts` line 67: Use conditional spread pattern
- [x] **T3.9** Fix validation return type in `src/utils/node-helpers.ts` line 86: Use conditional spread pattern
- [x] **T3.10** Fix validation tests in `src/__tests__/services/validation.test.ts` line 230: `result[0]`
- [x] **T3.11** Fix validation tests in `src/__tests__/services/validation.test.ts` line 267: `result[0]`
- [x] **T3.12** Fix benchmark result in `src/utils/benchmark.ts` line 55: Use `...(threshold !== undefined && { threshold, passed })`
- [x] **T3.13** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` lines 40-41
- [x] **T3.14** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` lines 51-52
- [x] **T3.15** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` line 69
- [x] **T3.16** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` lines 87-88
- [x] **T3.17** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` line 102
- [x] **T3.18** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` line 289
- [x] **T3.19** Fix benchmark tests in `src/__tests__/integration/benchmark.test.ts` lines 304-305
- [x] **T3.20** Fix FrameSelector props in `src/ui/components/FrameSelector.tsx` line 171: Use `{...(placeholder && { placeholder })}`

- [x] **T3.Validation** Validate Phase 3: `npm run build:debug 2>&1 | grep -c "TS2375\|TS2379\|TS2412"` should return 0

---

## Phase 4: Remaining Test File Fixes (~50 errors)

**Note:** Most test files are now fixed alongside their production code (see Phase 2 and 3). Remaining test-only fixes:

### Common Fix Patterns Reference

These patterns are used throughout Phase 4. Reference completed fixes in `src/__tests__/services/validation.test.ts` (lines 230, 267) and `src/__tests__/utils/figma-helpers.test.ts` (lines 81-82, 124) for examples.

**Pattern A: Array result with property access**
```typescript
// Before
expect(result[0].id).toBe(1);

// After
const firstResult = result[0];
expect(firstResult).toBeDefined();
expect(firstResult?.id).toBe(1);
```

**Pattern B: Mock call array access**
```typescript
// Before
expect(calls[0].args[0]).toBe("test-node-9");

// After
const call = calls[0];
expect(call).toBeDefined();
expect(call?.args[0]).toBe("test-node-9");
```

**Pattern C: Changes object array access**
```typescript
// Before
expect(changes.added[0].id).toBe(1);

// After
const firstAdded = changes.added[0];
expect(firstAdded).toBeDefined();
expect(firstAdded?.id).toBe(1);
```

### TypeScript Error Codes

- **TS2532**: Object is possibly 'undefined' (array index access)
- **TS18048**: Object is possibly 'undefined' (property access on potentially undefined)

### 4A: Standalone Test Files

#### storage.test.ts

- [x] **T4A.1** Fix `src/__tests__/integration/storage.test.ts` line 268
  - **Error Code:** TS2532
  - **Test:** "should track Figma API calls" (describe: "mock isolation")
  - **Context:**
    ```typescript
    const calls = mockFigma.getCallsByMethod("getNodeByIdAsync");
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe("test-node-9");  // Line 268
    ```
  - **Fix:** Use Pattern B - Extract call, guard, then access property
  - **Reference:** Similar pattern used in `canvas-operations.test.ts` lines 313-315

#### sync-coordinator.test.ts

**Related File:** `src/services/sync-coordinator.ts` - Production code already fixed, tests need separate attention. The `detectAnnotationChanges` method returns `{ added, removed, modified, unchanged }` arrays.

- [x] **T4A.2** Fix `src/__tests__/services/sync-coordinator.test.ts` line 62
  - **Error Code:** TS2532
  - **Test:** "should identify added annotations" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    const changes = syncCoordinator.detectAnnotationChanges(previous, current);
    expect(changes.added).toHaveLength(1);
    expect(changes.added[0].id).toBe(1);  // Line 62
    ```
  - **Fix:** Use Pattern C - Extract first added, guard, then access property

- [x] **T4A.3** Fix `src/__tests__/services/sync-coordinator.test.ts` line 93
  - **Error Code:** TS2532
  - **Test:** "should identify removed annotations" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    const changes = syncCoordinator.detectAnnotationChanges(previous, current);
    expect(changes.removed).toHaveLength(1);
    expect(changes.removed[0].id).toBe(1);  // Line 93
    ```
  - **Fix:** Use Pattern C - Extract first removed, guard, then access property

- [x] **T4A.4** Fix `src/__tests__/services/sync-coordinator.test.ts` lines 136-137
  - **Error Code:** TS2532
  - **Test:** "should identify modified annotations" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    const changes = syncCoordinator.detectAnnotationChanges(previous, current);
    expect(changes.modified).toHaveLength(1);
    expect(changes.modified[0].previous.voicedPreview).toBe("Original");  // Line 136
    expect(changes.modified[0].current.voicedPreview).toBe("Modified");    // Line 137
    ```
  - **Fix:** Use Pattern C - Extract first modified, guard, then access nested properties

- [x] **T4A.5** Fix `src/__tests__/services/sync-coordinator.test.ts` line 154
  - **Error Code:** TS2532
  - **Test:** "should identify unchanged annotations" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    const changes = syncCoordinator.detectAnnotationChanges(previous, current);
    expect(changes.unchanged).toHaveLength(1);
    expect(changes.unchanged[0].id).toBe(1);  // Line 154
    ```
  - **Fix:** Use Pattern C - Extract first unchanged, guard, then access property

- [x] **T4A.6** Fix `src/__tests__/services/sync-coordinator.test.ts` line 169
  - **Error Code:** TS2532
  - **Test:** "should handle mixed changes" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    const changes = syncCoordinator.detectAnnotationChanges(original, modified);
    // annotation3 was removed
    expect(changes.removed).toHaveLength(1);
    expect(changes.removed[0].id).toBe(removed.id);  // Line 169
    ```
  - **Fix:** Use Pattern C - Extract first removed, guard, then access property

- [x] **T4A.7** Fix `src/__tests__/services/sync-coordinator.test.ts` line 173
  - **Error Code:** TS2532
  - **Test:** "should handle mixed changes" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    // annotation4 was added
    expect(changes.added).toHaveLength(1);
    expect(changes.added[0].id).toBe(added.id);  // Line 173
    ```
  - **Fix:** Use Pattern C - Extract first added, guard, then access property

- [x] **T4A.8** Fix `src/__tests__/services/sync-coordinator.test.ts` lines 177-178
  - **Error Code:** TS2532
  - **Test:** "should handle mixed changes" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    // annotation2 was modified
    expect(changes.modified).toHaveLength(1);
    expect(changes.modified[0].previous.id).toBe(2);  // Line 177
    expect(changes.modified[0].current.id).toBe(2);   // Line 178
    ```
  - **Fix:** Use Pattern C - Extract first modified, guard, then access nested properties

- [x] **T4A.9** Fix `src/__tests__/services/sync-coordinator.test.ts` line 182
  - **Error Code:** TS2532
  - **Test:** "should handle mixed changes" (describe: "detectAnnotationChanges")
  - **Context:**
    ```typescript
    // annotation1 was unchanged
    expect(changes.unchanged).toHaveLength(1);
    expect(changes.unchanged[0].id).toBe(1);  // Line 182
    ```
  - **Fix:** Use Pattern C - Extract first unchanged, guard, then access property

#### annotation-deduplication.test.ts

- [x] **T4A.10** Fix `src/__tests__/utils/annotation-deduplication.test.ts` line 43
  - **Error Code:** TS2532
  - **Test:** "should keep single annotation unchanged" (describe: "removeDuplicateAnnotations")
  - **Context:**
    ```typescript
    const result = removeDuplicateAnnotations(annotations, validation);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);  // Line 43
    ```
  - **Fix:** Use Pattern A - Extract first result, guard, then access property
  - **Reference:** See `validation.test.ts` line 230 for completed example

- [x] **T4A.11** Fix `src/__tests__/utils/annotation-deduplication.test.ts` line 57
  - **Error Code:** TS2532
  - **Test:** "should remove duplicate IDs keeping first occurrence" (describe: "removeDuplicateAnnotations")
  - **Context:**
    ```typescript
    const result = removeDuplicateAnnotations(annotations, validation);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual([1, 2]);
    expect(result[0].voicedPreview).toBe("First");  // Line 57
    ```
  - **Fix:** Use Pattern A - Extract first result, guard, then access property

- [x] **T4A.12** Fix `src/__tests__/utils/annotation-deduplication.test.ts` line 117
  - **Error Code:** TS2532
  - **Test:** "should filter out invalid annotations" (describe: "removeDuplicateAnnotations")
  - **Context:**
    ```typescript
    const result = removeDuplicateAnnotations(annotations, validation);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);  // Line 117
    ```
  - **Fix:** Use Pattern A - Extract first result, guard, then access property

- [x] **T4A.13** Fix `src/__tests__/utils/annotation-deduplication.test.ts` line 175
  - **Error Code:** TS2532
  - **Test:** "should still deduplicate true duplicates with same frameId and id" (describe: "removeDuplicateAnnotations")
  - **Context:**
    ```typescript
    const result = removeDuplicateAnnotations(annotations, validation);
    expect(result).toHaveLength(2);
    expect(result[0].voicedPreview).toBe("First");  // Line 175
    ```
  - **Fix:** Use Pattern A - Extract first result, guard, then access property

- [x] **T4A.14** Fix `src/__tests__/utils/annotation-deduplication.test.ts` line 202
  - **Error Code:** TS2532
  - **Test:** "should remove duplicate IDs keeping first occurrence" (describe: "deduplicateCanvasAnnotations")
  - **Context:**
    ```typescript
    const result = deduplicateCanvasAnnotations(annotations);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual([1, 2]);
    expect(result[0].voicedPreview).toBe("First");  // Line 202
    ```
  - **Fix:** Use Pattern A - Extract first result, guard, then access property

- [x] **T4A.15** Fix `src/__tests__/utils/annotation-deduplication.test.ts` line 243
  - **Error Code:** TS2532
  - **Test:** "should deduplicate true duplicates with same frameId and id" (describe: "deduplicateCanvasAnnotations")
  - **Context:**
    ```typescript
    const result = deduplicateCanvasAnnotations(annotations);
    expect(result).toHaveLength(1);
    expect(result[0].voicedPreview).toBe("First");  // Line 243
    ```
  - **Fix:** Use Pattern A - Extract first result, guard, then access property

- [x] **T4.Validation** Validate Phase 4: Check for remaining errors in test files
  - **Command:** `npm run build:debug 2>&1 | grep -E "storage\.test|sync-coordinator\.test|annotation-deduplication\.test" | grep -E "TS2532|TS18048"`
  - **Expected:** 0 errors
  - **Also run:** `npm test` to ensure all tests pass

---

## Phase 5: Final Validation

- [x] **T5.1** Run full build: `npm run build:debug` - expect 0 errors (no TS2532/TS18048/TS2345/TS2464/TS2375/TS2379/TS2412 errors)
- [x] **T5.2** Run test suite: `npm test` - expect all tests pass (375 tests passed)
- [x] **T5.3** Run linter: `npm run lint` - expect 0 new warnings (2 pre-existing lint errors unrelated to strict TypeScript compliance)
- [x] **T5.4** Manual smoke test in Figma plugin (requires manual verification)

---

## Parallelization Notes

- **Phases 1, 2, 3 can run in parallel** - different error types, minimal file overlap
- **Within Phase 2:** Tasks 2A-2G can run in parallel (different files)
- **Within Phase 3:** Tasks 3.1-3.20 can run in parallel (different files)
- **Within Phase 4:** Tasks 4A.1-4A.15 can run in parallel (different test files)
- **Phase 5 must run after all others complete**

**Note:** Production + test fixes are combined in Phases 2 and 3 to keep context fresh. Phase 4 only contains standalone test files that don't have corresponding production fixes.

## Estimated Effort

| Phase | Tasks | Estimated Time | Notes |
|-------|-------|----------------|-------|
| 1 | 2 | 15 min | Mock classes + validation |
| 2 | 95 | 2.5-3.5 hours | Production + tests combined |
| 3 | 21 | 1-1.5 hours | Production + tests combined |
| 4 | 16 | 30-45 min | Standalone test files only |
| 5 | 4 | 30 min | Validation |
| **Total** | **138** | **5-6 hours** | Granular task breakdown |

---

## Troubleshooting

### Common Issues

**Line numbers shift after fixes**
- After making fixes, line numbers in error messages may change
- Re-run `npm run build:debug` to see updated error locations
- Use `grep` to find remaining instances: `grep -n "\[0\]" src/__tests__/integration/storage.test.ts`

**Test file structure**
- Some tests use helper functions (e.g., `createMobileAnnotation`, `createAnnotationSet`) that may not need updates
- Focus on direct array access in test assertions, not helper function implementations
- Check test file imports to understand helper function return types

**Error persists after fix**
- Ensure you're extracting the array element before accessing properties
- Verify the guard check (`expect(item).toBeDefined()`) is present
- Check that optional chaining (`?.`) is used for property access after the guard

**Build errors don't match task descriptions**
- TypeScript compiler may report errors at different lines than source
- Use the test name/description to locate the correct code section
- Check surrounding context (3-5 lines) to find the exact problematic line

**Validation command shows no errors but tests fail**
- Run `npm test` to check runtime test failures
- Some fixes may require test logic changes beyond type safety
- Verify test expectations match the new guarded access pattern

### Reference Files for Patterns

- **Pattern A examples:** `src/__tests__/services/validation.test.ts` lines 230, 267
- **Pattern B examples:** `src/__tests__/integration/canvas-operations.test.ts` lines 313-315
- **Pattern C examples:** See Phase 2/3 completed tasks for similar change detection patterns
