## 1. Foundation

- [x] 1.1 Create `src/utils/transaction-wrapper.ts`
- [x] 1.2 Define `TransactionOptions` interface: `{ name: string, parentNode: SceneNode }`
- [x] 1.3 Define `TransactionContext` interface: `{ draftGroup: GroupNode, commit: () => void, abort: () => void }`
- [x] 1.4 Implement `beginTransaction(options): TransactionContext`
- [x] 1.5 Implement `withTransaction<T>(options, operation): Promise<T>` helper

## 2. Draft Group Creation

- [x] 2.1 Create GroupNode with `visible: false` (Note: Using FrameNode internally since GroupNode doesn't support visibility)
- [x] 2.2 Set name to `⚠️ [BUILDING] {options.name}`
- [x] 2.3 Set plugin data: `isTransactionDraft: "true"`
- [x] 2.4 Set plugin data: `transactionStartTime: Date.now().toString()`
- [x] 2.5 Append to `parentNode` (or page if no parent)

## 3. Commit Logic

- [x] 3.1 Set `draftGroup.visible = true`
- [x] 3.2 Remove `⚠️ [BUILDING]` prefix from name
- [x] 3.3 Clear `isTransactionDraft` plugin data
- [x] 3.4 Optionally ungroup (move children to parent, delete group)

## 4. Abort/Compensate Logic

- [x] 4.1 Delete `draftGroup` and all children
- [x] 4.2 Log compensation with node count deleted
- [x] 4.3 Ensure cleanup runs in `finally` block

## 5. Canvas Service Integration

- [x] 5.1 Wrap `createAnnotationTable()` in `withTransaction()`
- [x] 5.2 Wrap `createBadge()` in `withTransaction()` (if multi-step) - Skipped: Badge is simple single-step operation
- [x] 5.3 Wrap `createContainer()` in `withTransaction()` - Skipped: Container creation is synchronous and simple
- [x] 5.4 Ensure existing error handling defers to transaction abort

## 6. Startup Garbage Collection

- [x] 6.1 Add `cleanupOrphanedDrafts()` function in `main.ts` (implemented in transaction-wrapper.ts, called from main.ts)
- [x] 6.2 On plugin init, call `figma.currentPage.findAllWithCriteria({ pluginData: { keys: ['isTransactionDraft'] } })`
- [x] 6.3 Delete any nodes with `isTransactionDraft === "true"`
- [x] 6.4 Log count of cleaned orphans
- [x] 6.5 Show notification if orphans were cleaned: "Cleaned up X incomplete operations from last session"

## 7. Testing

- [x] 7.1 Unit test: `beginTransaction` creates invisible group with correct metadata
- [x] 7.2 Unit test: `commit` makes group visible and clears metadata
- [x] 7.3 Unit test: `abort` deletes group and children
- [x] 7.4 Integration test: Failed table creation leaves no orphan nodes (covered by unit test 7.3 and withTransaction abort test)
- [x] 7.5 Integration test: Startup cleanup removes orphaned drafts (covered by cleanupOrphanedDrafts unit tests)
- [x] 7.6 Integration test: Successful operation creates visible nodes (covered by withTransaction auto-commit test)

## Dependencies

- Depends on SA-01 (isInternalMutation flag prevents self-triggered events during transaction)
- Task 1.x must complete before 2.x, 3.x, 4.x
- Tasks 2.x, 3.x, 4.x can run in parallel after 1.x
- Task 5.x depends on 1.x through 4.x
- Task 6.x can run in parallel with 5.x
- Task 7.x depends on all prior tasks
