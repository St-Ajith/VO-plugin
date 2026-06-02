# Tasks: Fix Remaining Strict TypeScript Errors

Tasks combine production code fixes with their corresponding test file fixes to keep context fresh. When fixing a production file, also fix its test files in the same task.

---

## Phase 1: Production Code Fixes (8 errors)

### 1A: annotation-store.ts - Guard Optional Property Access (5 errors)

- [x] **T1A.1** Fix `src/services/annotation-store.ts` line 101: Guard `current` before accessing `current.mobile?.ios`
  - **Error Code:** TS18048
  - **Context:** `updateAnnotation` method, merging mobile data
  - **Fix:** Add guard `if (!current) throw new Error(...)` before accessing properties

- [x] **T1A.2** Fix `src/services/annotation-store.ts` line 105: Guard `current` before accessing `current.mobile?.android`
  - **Error Code:** TS18048
  - **Fix:** Same guard as T1A.1 covers this

- [x] **T1A.3** Fix `src/services/annotation-store.ts` line 109: Guard `current` before accessing `current.mobile`
  - **Error Code:** TS18048
  - **Fix:** Same guard as T1A.1 covers this

- [x] **T1A.4** Fix `src/services/annotation-store.ts` line 112: Guard `current` before accessing `current.web`
  - **Error Code:** TS18048
  - **Fix:** Same guard as T1A.1 covers this

- [x] **T1A.5** Fix `src/services/annotation-store.ts` line 115: Guard `current` before accessing `current.web`
  - **Error Code:** TS18048
  - **Fix:** Same guard as T1A.1 covers this

### 1B: canvas-platform-mobile.ts - Guard Array Access (2 errors)

- [x] **T1B.1** Fix `src/services/canvas-platform-mobile.ts` line 164: Guard `headerTexts[0]` before passing to `createHeaderText`
  - **Error Code:** TS2345
  - **Context:** `createMobileTableHeader` method
  - **Fix:** Extract `const iosHeader = headerTexts[0]`, guard, then use

- [x] **T1B.2** Fix `src/services/canvas-platform-mobile.ts` line 165: Guard `headerTexts[1]` before passing to `createHeaderText`
  - **Error Code:** TS2345
  - **Fix:** Extract `const androidHeader = headerTexts[1]`, guard, then use

### 1C: canvas-platform-web.ts - Guard Array Destructuring (2 errors)

- [x] **T1C.1** Fix `src/services/canvas-platform-web.ts` line 47: Guard `labelWidth` from destructured `columnWidths`
  - **Error Code:** TS2345
  - **Context:** `createWebTableRow` method, line 47 uses `labelWidth`
  - **Fix:** Destructure with fallback or guard: `const [labelWidth, valueWidth] = columnWidths; if (labelWidth === undefined || valueWidth === undefined) throw new Error(...)`

- [x] **T1C.2** Fix `src/services/canvas-platform-web.ts` line 48: Guard `valueWidth` from destructured `columnWidths`
  - **Error Code:** TS2345
  - **Fix:** Same guard as T1C.1 covers this

### 1D: canvas.ts - Missing Import and Assignment Fix (2 errors)

- [x] **T1D.1** Fix `src/services/canvas.ts` line 97: Add missing import for `CanvasParserDependencies`
  - **Error Code:** TS2304
  - **Context:** Type annotation uses `CanvasParserDependencies` but import is missing
  - **Fix:** Add `import type { CanvasParserDependencies } from "./canvas-parser";` at top of file

- [x] **T1D.2** Fix `src/services/canvas.ts` line 95: Fix `annotationStore` assignment with `exactOptionalPropertyTypes`
  - **Error Code:** TS2412
  - **Context:** Optional property assignment
  - **Fix:** Use conditional assignment or adjust type definition

- [x] **T1.Validation** Validate Phase 1: `npm run build:debug 2>&1 | grep -E "annotation-store|canvas-platform-mobile|canvas-platform-web|canvas\.ts" | grep -E "TS18048|TS2345|TS2304|TS2412"` should return 0

---

## Phase 2: Test File Fixes (41 errors)

### 2A: canvas-operations.test.ts (6 errors)

- [x] **T2A.1** Fix `src/__tests__/integration/canvas-operations.test.ts` line 518: Guard `badges[0]` before accessing `.y`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const firstBadge = badges[0]`, `expect(firstBadge).toBeDefined()`, then `expect(firstBadge?.y).toBe(128)`

- [x] **T2A.2** Fix `src/__tests__/integration/canvas-operations.test.ts` line 519: Guard `badges[1]` before accessing `.y`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const secondBadge = badges[1]`, guard, then access

- [x] **T2A.3** Fix `src/__tests__/integration/canvas-operations.test.ts` line 520: Guard `badges[2]` before accessing `.y`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const thirdBadge = badges[2]`, guard, then access

- [x] **T2A.4** Fix `src/__tests__/integration/canvas-operations.test.ts` line 523: Guard `badges[0]` before accessing `.x`
  - **Error Code:** TS2532
  - **Pattern:** Reuse `firstBadge` from T2A.1

- [x] **T2A.5** Fix `src/__tests__/integration/canvas-operations.test.ts` line 524: Guard `badges[1]` before accessing `.x`
  - **Error Code:** TS2532
  - **Pattern:** Reuse `secondBadge` from T2A.2

- [x] **T2A.6** Fix `src/__tests__/integration/canvas-operations.test.ts` line 525: Guard `badges[2]` before accessing `.x`
  - **Error Code:** TS2532
  - **Pattern:** Reuse `thirdBadge` from T2A.3

### 2B: container-operations.test.ts (7 errors)

- [x] **T2B.1** Fix `src/__tests__/integration/container-operations.test.ts` line 120: Guard `containers[0]` before accessing `.id`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const container = containers[0]`, guard, then access

- [x] **T2B.2** Fix `src/__tests__/integration/container-operations.test.ts` line 164: Guard `badgeColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const firstChild = badgeColumn.children[0]`, guard, then access

- [x] **T2B.3** Fix `src/__tests__/integration/container-operations.test.ts` line 167: Guard `badgeColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const secondChild = badgeColumn.children[1]`, guard, then access

- [x] **T2B.4** Fix `src/__tests__/integration/container-operations.test.ts` line 170: Guard `badgeColumn.children[2]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const thirdChild = badgeColumn.children[2]`, guard, then access

- [x] **T2B.5** Fix `src/__tests__/integration/container-operations.test.ts` line 216: Guard `tableColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const firstChild = tableColumn.children[0]`, guard, then access

- [x] **T2B.6** Fix `src/__tests__/integration/container-operations.test.ts` line 219: Guard `tableColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const secondChild = tableColumn.children[1]`, guard, then access

- [x] **T2B.7** Fix `src/__tests__/integration/container-operations.test.ts` line 222: Guard `tableColumn.children[2]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const thirdChild = tableColumn.children[2]`, guard, then access

### 2C: message-mocks.test.ts (8 errors)

- [x] **T2C.1** Fix `src/__tests__/integration/message-mocks.test.ts` line 31: Guard `messages[0]` before accessing `.type`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const firstMessage = messages[0]`, guard, then access

- [x] **T2C.2** Fix `src/__tests__/integration/message-mocks.test.ts` line 32: Guard `messages[0]` before accessing `.payload`
  - **Error Code:** TS2532
  - **Pattern:** Reuse `firstMessage` from T2C.1

- [x] **T2C.3** Fix `src/__tests__/integration/message-mocks.test.ts` line 33: Guard `messages[1]` before accessing `.type`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const secondMessage = messages[1]`, guard, then access

- [x] **T2C.4** Fix `src/__tests__/integration/message-mocks.test.ts` line 34: Guard `messages[1]` before accessing `.payload`
  - **Error Code:** TS2532
  - **Pattern:** Reuse `secondMessage` from T2C.3

- [x] **T2C.5** Fix `src/__tests__/integration/message-mocks.test.ts` line 46: Guard `eventAMessages[0]` before accessing `.payload`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const firstEventA = eventAMessages[0]`, guard, then access

- [x] **T2C.6** Fix `src/__tests__/integration/message-mocks.test.ts` line 47: Guard `eventAMessages[1]` before accessing `.payload`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const secondEventA = eventAMessages[1]`, guard, then access

- [x] **T2C.7** Fix `src/__tests__/integration/message-mocks.test.ts` line 67: Guard `lastMessage` before accessing `.type`
  - **Error Code:** TS18048
  - **Pattern:** Extract and guard: `const lastMessage = messageSystem.getLastMessage(); expect(lastMessage).toBeDefined(); expect(lastMessage?.type).toBe(...)`

- [x] **T2C.8** Fix `src/__tests__/integration/message-mocks.test.ts` line 68: Guard `lastMessage` before accessing `.payload`
  - **Error Code:** TS18048
  - **Pattern:** Reuse `lastMessage` from T2C.7

- [x] **T2C.9** Fix `src/__tests__/integration/message-mocks.test.ts` line 79: Guard `lastTypeA` before accessing `.payload`
  - **Error Code:** TS18048
  - **Pattern:** Extract and guard: `const lastTypeA = messageSystem.getLastMessageByType("TYPE_A"); expect(lastTypeA).toBeDefined(); expect(lastTypeA?.payload).toEqual(...)`

### 2D: canvas-container.test.ts (20 errors)

- [x] **T2D.1** Fix `src/__tests__/services/canvas-container.test.ts` line 383: Guard `badgeColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const firstChild = badgeColumn.children[0]`, guard, then access

- [x] **T2D.2** Fix `src/__tests__/services/canvas-container.test.ts` line 386: Guard `badgeColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const secondChild = badgeColumn.children[1]`, guard, then access

- [x] **T2D.3** Fix `src/__tests__/services/canvas-container.test.ts` line 389: Guard `badgeColumn.children[2]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract `const thirdChild = badgeColumn.children[2]`, guard, then access

- [x] **T2D.4** Fix `src/__tests__/services/canvas-container.test.ts` line 421: Guard `badgeColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.5** Fix `src/__tests__/services/canvas-container.test.ts` line 453: Guard `badgeColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.6** Fix `src/__tests__/services/canvas-container.test.ts` line 456: Guard `badgeColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.7** Fix `src/__tests__/services/canvas-container.test.ts` line 498: Guard `badgeColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.8** Fix `src/__tests__/services/canvas-container.test.ts` line 501: Guard `badgeColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.9** Fix `src/__tests__/services/canvas-container.test.ts` line 504: Guard `badgeColumn.children[2]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.10** Fix `src/__tests__/services/canvas-container.test.ts` line 507: Guard `badgeColumn.children[3]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.11** Fix `src/__tests__/services/canvas-container.test.ts` line 548: Guard `tableColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.12** Fix `src/__tests__/services/canvas-container.test.ts` line 551: Guard `tableColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.13** Fix `src/__tests__/services/canvas-container.test.ts` line 554: Guard `tableColumn.children[2]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.14** Fix `src/__tests__/services/canvas-container.test.ts` line 600: Guard `tableColumn.children[0]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.15** Fix `src/__tests__/services/canvas-container.test.ts` line 603: Guard `tableColumn.children[1]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2D.16** Fix `src/__tests__/services/canvas-container.test.ts` line 606: Guard `tableColumn.children[2]` before accessing `.name`
  - **Error Code:** TS2532
  - **Pattern:** Extract and guard

- [x] **T2.Validation** Validate Phase 2: `npm run build:debug 2>&1 | grep -E "canvas-operations|container-operations|message-mocks|canvas-container" | grep -E "TS2532|TS18048"` should return 0

---

## Phase 3: Final Validation

- [x] **T3.1** Run full build: `npm run build:debug` - expect 0 errors (no TS2532/TS18048/TS2345/TS2304/TS2412 errors)
- [x] **T3.2** Run test suite: `npm test` - expect all tests pass
- [x] **T3.3** Verify error count: `npm run build:debug 2>&1 | grep -c "error TS"` should return 0

---

## Parallelization Notes

- **Phase 1 tasks can run in parallel** - Different files, no dependencies
- **Phase 2 tasks can run in parallel** - Different test files, no dependencies
- **Phase 3 must run after Phases 1 and 2 complete**

## Estimated Effort

| Phase | Tasks | Estimated Time | Notes |
|-------|-------|----------------|-------|
| 1 | 12 | 30-45 min | Production code fixes |
| 2 | 30 | 1-1.5 hours | Test file fixes |
| 3 | 3 | 15 min | Validation |
| **Total** | **45** | **2-2.5 hours** | Focused on remaining errors |

---

## Troubleshooting

### Common Issues

**Line numbers shift after fixes**
- After making fixes, line numbers in error messages may change
- Re-run `npm run build:debug` to see updated error locations
- Use `grep` to find remaining instances: `grep -n "\[0\]" src/__tests__/integration/canvas-operations.test.ts`

**Test file structure**
- Some tests use helper functions that may not need updates
- Focus on direct array access in test assertions, not helper function implementations

**Error persists after fix**
- Ensure you're extracting the array element before accessing properties
- Verify the guard check (`expect(item).toBeDefined()`) is present
- Check that optional chaining (`?.`) is used for property access after the guard

**Build errors don't match task descriptions**
- TypeScript compiler may report errors at different lines than source
- Use the test name/description to locate the correct code section
- Check surrounding context (3-5 lines) to find the exact problematic line

### Reference Files for Patterns

- **Test Pattern A examples:** See `refactor-strict-typescript-compliance` Phase 4 completed tasks
- **Production Pattern examples:** See `refactor-strict-typescript-compliance` Phase 2 completed tasks

