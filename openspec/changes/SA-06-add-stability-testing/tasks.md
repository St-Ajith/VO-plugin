## 1. Test Infrastructure Enhancements

**Note**: Some mock enhancements were implemented as part of SA-04:
- `findAllWithCriteria` method added to MockPageNode
- `resize`, `insertChild` methods added to MockFrameNode

- [ ] 1.1 Add `simulateFailure(operation, count)` to Figma mock
- [ ] 1.2 Add `simulateDelay(ms)` to async operations in mock
- [ ] 1.3 Add `getCallCount(operation)` to track invocation counts
- [ ] 1.4 Add `captureNodeState()` for before/after comparison
- [ ] 1.5 Add `resetMockState()` to ensure test isolation (partially exists via `reset()`)

## 2. Idempotency Test Suite

- [ ] 2.1 Create `src/__tests__/integration/idempotency.test.ts`
- [ ] 2.2 Test: CREATE_ANNOTATION with same requestId executes once
- [ ] 2.3 Test: UPDATE_ANNOTATION with same requestId executes once
- [ ] 2.4 Test: DELETE_ANNOTATION with same requestId executes once
- [ ] 2.5 Test: REORDER_ANNOTATION with same requestId executes once
- [ ] 2.6 Test: Duplicate INSERT_ANNOTATIONS creates same number of nodes

## 3. Concurrency Stress Tests

- [ ] 3.1 Create `src/__tests__/integration/stability.test.ts`
- [ ] 3.2 Test: 10 rapid CREATE_ANNOTATION calls produce 10 unique annotations
- [ ] 3.3 Test: Interleaved CREATE/DELETE produces consistent final state
- [ ] 3.4 Test: Concurrent updates to same annotation apply in order
- [ ] 3.5 Test: Queue depth logging shows correct serialization

## 4. Race Condition Tests

- [ ] 4.1 Test: Async font loading doesn't allow interleaving
- [ ] 4.2 Test: Response arrives for superseded request (stale discard)
- [ ] 4.3 Test: nodechange during table creation is suppressed
- [ ] 4.4 Test: Plugin restart during transaction cleans orphans

## 5. Transaction Wrapper Tests

**Note**: Transaction wrapper tests were implemented as part of SA-04 in `src/__tests__/utils/transaction-wrapper.test.ts` (20 tests). The mock enhancements (`findAllWithCriteria`) were also added in SA-04.

- [x] 5.1 Create tests for `withTransaction()` success path (implemented in SA-04)
- [x] 5.2 Test: Failed operation leaves no orphan nodes (implemented in SA-04)
- [x] 5.3 Test: Startup cleanup removes `isTransactionDraft` nodes (implemented in SA-04)
- [x] 5.4 Test: `⚠️ [BUILDING]` prefix removed on commit (implemented in SA-04)
- [ ] 5.5 Test: Nested transactions (if supported) work correctly - **Note: Nested transactions are not supported by design**

## 6. Circuit Breaker Tests

**Note**: Comprehensive circuit breaker unit tests were implemented as part of SA-05 in `src/__tests__/utils/circuit-breaker.test.ts` (27 tests). The following integration tests focus on end-to-end behavior with the message router.

- [x] 6.1 Create `src/__tests__/utils/circuit-breaker.test.ts` (implemented in SA-05)
- [x] 6.2 Test: 3 failures within 5s trips breaker (implemented in SA-05)
- [x] 6.3 Test: Breaker blocks subsequent calls (implemented in SA-05)
- [x] 6.4 Test: Breaker resets after 30s cooldown (implemented in SA-05)
- [x] 6.5 Test: Success resets failure count (implemented in SA-05)
- [x] 6.6 Test: Independent breakers per operation (implemented in SA-05)
- [x] 6.7 Test: FIGMA_ERROR emitted on trip (implemented in SA-05)
- [ ] 6.8 Integration test: INSERT_ANNOTATIONS blocked when breaker open
- [ ] 6.9 Integration test: UPDATE_ANNOTATIONS blocked when breaker open

## 7. State Recovery Tests

**Note**: Basic state recovery tests already exist in `src/__tests__/integration/state-recovery.test.ts` from SA-03, covering:
- 7.1 ✅ Test: Failed save triggers REQUEST_RESYNC (covered)
- 7.2 ✅ Test: Re-sync restores authoritative state (covered)
- 7.3 ✅ Test: `isSyncing` signal transitions correctly (covered)

The following tasks focus on additional edge cases:

- [ ] 7.4 Test: Concurrent document changes are captured in re-sync
- [ ] 7.5 Test: Actions blocked when `isSyncing.value` is true (all mutation handlers return early)
- [ ] 7.6 Test: INIT during sync doesn't trigger save-data emissions
- [ ] 7.7 Test: Invalid payload returns error with requestId for correlation
- [ ] 7.8 Test: `setAnnotations` filters invalid entries and continues with valid ones

## 8. Documentation

- [ ] 8.1 Add test pattern documentation to TESTING.md
- [ ] 8.2 Document idempotency test structure for future tests
- [ ] 8.3 Add CI integration notes for stability test suite

## Dependencies

- Depends on SA-01 through SA-05 being implemented
- Task 1.x must complete before all other tasks
- Tasks 2.x through 7.x can run in parallel after 1.x
- Task 8.x runs after all tests pass
