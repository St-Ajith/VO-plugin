# Utility Usage Audit - @create-figma-plugin/utilities

## Currently Used Utilities ✅

### Node Utilities
- **`loadFontsAsync`** - Used in `src/services/canvas.ts` for loading fonts before text operations
- **`computeBoundingBox`** - Used extensively in `src/services/canvas.ts` for calculating node bounds

### Event Utilities
- **`emit`** - Used throughout UI components and hooks for sending messages
- **`on`** - Used in hooks for receiving messages

## Utilities Available But Not Used

### Node Utilities

#### `getSceneNodeById<Node>(id)`
**Status**: Not applicable for most use cases

**Why**: 
- Throws error if node doesn't exist
- Our codebase extensively uses `figma.getNodeByIdAsync()` which returns `null` for missing nodes
- We handle null cases gracefully throughout the codebase
- Converting would require try-catch blocks everywhere, reducing code clarity

**Current Pattern**:
```typescript
const node = await figma.getNodeByIdAsync(nodeId);
if (!node || node.removed) {
  return null; // Graceful handling
}
```

**Would Require**:
```typescript
try {
  const node = getSceneNodeById<NodeType>(nodeId);
  // Use node
} catch (error) {
  return null; // Less clear error handling
}
```

**Recommendation**: Keep current pattern - it's more appropriate for our error handling strategy

---

#### `getParentNode(node)`
**Status**: Not applicable

**Why**:
- Throws error if `node.parent` is null
- We traverse parent chains with null checks: `while (parent) { parent = parent.parent }`
- Using `getParentNode` would require try-catch in loops, making code less readable

**Current Pattern** (in `node-change-coordinator.ts`):
```typescript
let parent: BaseNode | null = node.parent;
while (parent) {
  // Process parent
  parent = parent.parent; // Safe null check
}
```

**Recommendation**: Keep current pattern - it's more appropriate for traversal logic

---

#### `deduplicateNodes<Node>(nodes)`
**Status**: Not applicable

**Why**:
- We deduplicate **annotations** (by composite key), not nodes
- Node deduplication would be by ID, but we don't have arrays of nodes that need deduplication
- Our node arrays come from `findAll()` which already returns unique nodes

**Recommendation**: Not needed for current use cases

---

#### `traverseNode` / `traverseNodeAsync`
**Status**: Not applicable

**Why**:
- We use `findAll()` and `findOne()` which are more direct for our use cases
- Manual traversal is rare and simple (parent chain traversal)
- `traverseNode` is useful for complex recursive operations we don't have

**Recommendation**: Not needed - `findAll`/`findOne` are more appropriate

---

#### `getAbsolutePosition(node)`
**Status**: Not applicable

**Why**:
- We use `computeBoundingBox()` which already provides `x` and `y` coordinates
- `getAbsolutePosition` returns `{ x, y }` but we need full bounds `{ x, y, width, height }`
- No benefit to switching

**Recommendation**: Keep `computeBoundingBox` - it provides more information

---

#### `computeMaximumBounds(nodes)`
**Status**: Not applicable

**Why**:
- We calculate bounds for single nodes, not multiple nodes together
- When we need multiple node bounds, we calculate them individually
- No current use case for computing maximum bounds of multiple nodes

**Recommendation**: Not needed for current use cases

---

#### `sortNodesByCanonicalOrder<Node>(siblingNodes)`
**Status**: Not applicable

**Why**:
- We sort annotations by ID, not nodes by layer order
- When we need node order, we maintain it through insertion order (containers)
- No current use case for sorting nodes by canonical order

**Recommendation**: Not needed for current use cases

---

#### `getNodeIndexPath(node)`
**Status**: Not applicable

**Why**:
- We have `getNodePath()` in `src/utils/figma-helpers.ts` that provides human-readable path
- `getNodeIndexPath` returns numeric indices, which we don't need
- Our path function is more useful for logging/debugging

**Recommendation**: Keep current `getNodePath` implementation

---

## Summary

### ✅ Best Practices Followed
1. Using `loadFontsAsync` before text operations
2. Using `computeBoundingBox` for bounds calculations
3. Using `emit`/`on` for event communication

### 📝 Rationale for Not Using Other Utilities
- **Error handling**: Our codebase prefers null checks over exceptions
- **Use case fit**: Most utilities don't match our specific needs
- **Code clarity**: Current patterns are more readable for our use cases

### 🔍 Future Considerations
- If we add features that require:
  - Sorting nodes by layer order → consider `sortNodesByCanonicalOrder`
  - Computing bounds of multiple nodes → consider `computeMaximumBounds`
  - Complex node traversal → consider `traverseNode`/`traverseNodeAsync`

## Conclusion

**Current utility usage is optimal for our codebase.** We're using the utilities that provide the most value (`loadFontsAsync`, `computeBoundingBox`, `emit`/`on`), and the other utilities either:
1. Don't fit our error handling patterns (throw vs null)
2. Don't match our use cases (we work with annotations, not just nodes)
3. Provide less value than our current implementations

No changes recommended at this time.

