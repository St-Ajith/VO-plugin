## Context

Unit tests cover pure logic, but the plugin's complexity lies in its interaction with the Figma API. Key areas that need integration testing:

- `AnnotationStore` - CRUD operations that call `node.setPluginData()`
- `MessageRouter` - Handlers that orchestrate multiple services
- `CanvasService` - Frame/text creation and parsing
- `SyncCoordinator.checkCanvasSync()` - Full sync flow with page scanning

## Goals

- Test service integration without running Figma Desktop
- Catch bugs in Figma API usage patterns
- Enable CI testing of complex workflows
- Keep tests deterministic and fast

## Non-Goals

- 100% API coverage (only mock what's used)
- Visual rendering verification (manual testing)
- Real Figma API testing (not feasible in CI)

## Decisions

### Mock Strategy: Minimal Stub Approach

Create focused mocks that:
1. Stub only the Figma APIs actually used
2. Track calls for verification
3. Simulate common error conditions

**Rationale:** Full Figma mock is maintenance-heavy. Focused mocks are easier to maintain and clearly document which APIs we depend on.

### Mock Structure

```typescript
// src/__tests__/mocks/figma.ts
export function createMockFigma() {
  const nodes = new Map<string, MockNode>();
  const emittedMessages: Array<{ type: string; payload: unknown }> = [];
  
  return {
    figma: {
      currentPage: createMockPage(),
      getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
      loadAllPagesAsync: async () => {},
      notify: vi.fn(),
      root: { children: [] as PageNode[] },
    },
    // Test utilities
    addNode: (node: MockNode) => nodes.set(node.id, node),
    getEmittedMessages: () => emittedMessages,
    reset: () => { nodes.clear(); emittedMessages.length = 0; },
  };
}
```

### MockNode Implementation

```typescript
export class MockNode {
  id: string;
  name: string;
  type: NodeType;
  removed = false;
  private pluginData = new Map<string, string>();

  setPluginData(key: string, value: string) {
    this.pluginData.set(key, value);
  }
  
  getPluginData(key: string) {
    return this.pluginData.get(key) ?? '';
  }
}
```

### Test Isolation

Each test:
1. Creates fresh mock instance via `beforeEach`
2. Sets up required nodes
3. Runs service method
4. Verifies mock calls and state

```typescript
describe('AnnotationStore', () => {
  let mockFigma: ReturnType<typeof createMockFigma>;
  let store: AnnotationStore;

  beforeEach(() => {
    mockFigma = createMockFigma();
    globalThis.figma = mockFigma.figma as any;
    store = new AnnotationStore();
  });

  afterEach(() => {
    mockFigma.reset();
  });
});
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Mocks may not match real Figma behavior | Validate against actual Figma periodically; document known differences |
| Mock maintenance as Figma API evolves | Keep mock surface minimal; update when tests fail |
| False confidence from passing mock tests | Maintain manual testing for critical paths |

## Open Questions

1. Should we use a shared mock package like `@anthropic/figma-test-utils` if one exists?
   - Research first, but likely build our own for control
2. How do we handle async timing in tests?
   - Use `vi.useFakeTimers()` for debounced operations
