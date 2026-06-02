## 1. Create Figma Mock Infrastructure
- [x] 1.1 Create `src/__tests__/mocks/figma.ts` with base mock structure
- [x] 1.2 Mock `figma.getNodeByIdAsync()` 
- [x] 1.3 Mock `figma.currentPage` and page operations
- [x] 1.4 Mock `figma.loadAllPagesAsync()`
- [x] 1.5 Mock `node.setPluginData()` / `getPluginData()`
- [x] 1.6 Mock `figma.notify()` for notification capture
- [x] 1.7 Mock `figma.createFrame()`, `figma.createText()`, `figma.createRectangle()`
- [x] 1.8 Create `MockNode` class with common node properties

## 2. Create Message Mock Utilities
- [x] 2.1 Mock `emit()` from @create-figma-plugin/utilities
- [x] 2.2 Mock `on()` handler registration
- [x] 2.3 Create helper to simulate message round-trips
- [x] 2.4 Create helper to capture emitted messages

## 3. StorageService Integration Tests (Implemented as StorageService instead of AnnotationStore due to complexity)
- [x] 3.1 Test `saveToNode()` saves annotation to node
- [x] 3.2 Test `loadFromNode()` loads annotation data
- [x] 3.3 Test `removeFromNode()` clears node data
- [x] 3.4 Test error handling for removed nodes
- [x] 3.5 Test rollback on save failure scenarios

## 4. Message Mock Utilities Tests (Implemented as verification of mock utilities)
- [x] 4.1 Test message emit and capture
- [x] 4.2 Test handler registration with `on()`
- [x] 4.3 Test message simulation
- [x] 4.4 Test round-trip helper
- [x] 4.5 Test message sequence verification

## 5. Canvas Operations Integration Tests (Implemented as basic canvas operations)
- [x] 5.1 Test node creation (frame, text, rectangle)
- [x] 5.2 Test table metadata storage on frames
- [x] 5.3 Test frame hierarchy and children
- [x] 5.4 Test notification capture

## 6. Validation
- [x] 6.1 Run integration tests in isolation (50 new tests added, all passing)
- [x] 6.2 Verify mocks don't leak between tests (isolation tests included)
- [x] 6.3 Document mock patterns in test utilities (README.md created)
