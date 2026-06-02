# Integration Testing Mocks

This directory contains mock utilities for integration testing of the VO Annotations plugin.

## Overview

Integration tests verify that different parts of the system work together correctly. Since the plugin depends on the Figma API, we provide mocks that simulate Figma's behavior without requiring the actual Figma Desktop application.

## Mock Utilities

### `figma.ts` - Figma API Mocks

Provides comprehensive mocking of the Figma API for integration testing.

#### Features

- **Node Management**: Create and manage mock Figma nodes (frames, text, rectangles)
- **Plugin Data**: Full support for `setPluginData()` and `getPluginData()`
- **Page Operations**: Mock page switching and `loadAllPagesAsync()`
- **Call Tracking**: Track all Figma API calls for verification
- **Notifications**: Capture `figma.notify()` calls
- **Isolation**: Each test gets a fresh mock instance

#### Usage

```typescript
import { createMockFigma, MockFrameNode } from "../mocks/figma";

describe("MyService Integration Tests", () => {
  let mockFigma: ReturnType<typeof createMockFigma>;

  beforeEach(() => {
    // Create fresh mock for each test
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;
  });

  afterEach(() => {
    // Clean up after each test
    mockFigma.reset();
  });

  it("should save data to node", async () => {
    // Create a mock node
    const frame = new MockFrameNode("frame-1", "Test Frame");
    mockFigma.addNode(frame);

    // Test your service
    await myService.saveToNode("frame-1", data);

    // Verify the results
    const pluginData = frame.getPluginData("my_namespace");
    expect(pluginData).toBeTruthy();
  });
});
```

#### Mock Node Classes

- **`MockNode`**: Base class for all nodes with plugin data support
- **`MockFrameNode`**: Frame nodes with children support
- **`MockTextNode`**: Text nodes with character styling
- **`MockRectangleNode`**: Rectangle nodes with fill support
- **`MockPageNode`**: Page nodes with selection and children
- **`MockDocumentNode`**: Root document node

#### Test Utilities

```typescript
// Node management
mockFigma.addNode(node);
mockFigma.getNode(id);
mockFigma.removeNode(id);

// Page management
mockFigma.createPage(id, name);
mockFigma.setCurrentPage(page);

// Call tracking
mockFigma.getCalls();
mockFigma.getCallsByMethod("getNodeByIdAsync");
mockFigma.wasMethodCalled("createFrame");

// Notifications
mockFigma.getNotifications();
mockFigma.clearNotifications();

// Reset for next test
mockFigma.reset();
```

### `messages.ts` - Message System Mocks

Provides mocking for the `@create-figma-plugin/utilities` message system.

#### Features

- **Message Capture**: Capture all emitted messages
- **Handler Registration**: Mock `on()` for message handling
- **Message Simulation**: Trigger handlers without emitting
- **Round-Trip Testing**: Helper for request/response patterns
- **Call Tracking**: Verify message sequences

#### Usage

```typescript
import { createMockMessageSystem, createMessageRoundTripHelper } from "../mocks/messages";

describe("MessageRouter Integration Tests", () => {
  let messageSystem: ReturnType<typeof createMockMessageSystem>;

  beforeEach(() => {
    messageSystem = createMockMessageSystem();
  });

  afterEach(() => {
    messageSystem.reset();
  });

  it("should emit message when action occurs", () => {
    // Test your service
    myService.performAction();

    // Verify message was emitted
    expect(messageSystem.wasMessageEmitted("ACTION_COMPLETE")).toBe(true);
    
    const messages = messageSystem.getMessagesByType("ACTION_COMPLETE");
    expect(messages[0].payload).toEqual({ success: true });
  });

  it("should handle incoming messages", () => {
    // Register a handler
    messageSystem.on("COMMAND", (payload) => {
      myService.handleCommand(payload);
    });

    // Simulate incoming message
    messageSystem.simulateMessage("COMMAND", { action: "test" });

    // Verify handler was called
    expect(myService.wasCommandHandled()).toBe(true);
  });
});
```

#### Message System API

```typescript
// Emit messages (auto-calls handlers)
messageSystem.emit("EVENT_TYPE", payload);

// Register handlers
messageSystem.on("EVENT_TYPE", handler);

// Message inspection
messageSystem.getEmittedMessages();
messageSystem.getMessagesByType("EVENT_TYPE");
messageSystem.wasMessageEmitted("EVENT_TYPE");
messageSystem.getLastMessage();
messageSystem.getLastMessageByType("EVENT_TYPE");

// Handler inspection
messageSystem.getHandlerCount("EVENT_TYPE");

// Simulate incoming messages
messageSystem.simulateMessage("EVENT_TYPE", payload);

// Cleanup
messageSystem.clearMessages();
messageSystem.clearHandlers();
messageSystem.reset();
```

#### Round-Trip Helper

For testing request/response patterns:

```typescript
const roundTrip = createMessageRoundTripHelper(messageSystem);

// Send request and wait for response
const response = await roundTrip.sendAndWaitForResponse(
  "REQUEST_TYPE",
  requestPayload,
  "RESPONSE_TYPE",
  1000 // timeout in ms
);

// Verify message sequence
const isValid = roundTrip.verifyMessageSequence(
  "REQUEST_TYPE",
  "RESPONSE_TYPE"
);
```

## Best Practices

### Test Isolation

Always use `beforeEach` and `afterEach` to create fresh mocks:

```typescript
let mockFigma: ReturnType<typeof createMockFigma>;

beforeEach(() => {
  mockFigma = createMockFigma();
  (globalThis as Record<string, unknown>).figma = mockFigma.figma;
});

afterEach(() => {
  mockFigma.reset();
});
```

### Verify Mock Calls

Use call tracking to verify Figma API usage:

```typescript
it("should call getNodeByIdAsync with correct ID", async () => {
  await service.loadNode("node-123");
  
  const calls = mockFigma.getCallsByMethod("getNodeByIdAsync");
  expect(calls).toHaveLength(1);
  expect(calls[0].args[0]).toBe("node-123");
});
```

### Test Real Behavior

Integration tests should verify that components work together correctly:

```typescript
it("should save annotation to node and emit success message", async () => {
  // Arrange
  const node = new MockFrameNode("node-1", "Element");
  mockFigma.addNode(node);

  // Act
  await annotationStore.add(annotation);

  // Assert
  // Verify node was updated
  const pluginData = node.getPluginData("voice_over_annotations");
  expect(pluginData).toBeTruthy();
  
  // Verify message was emitted
  expect(messageSystem.wasMessageEmitted("save-data-result")).toBe(true);
});
```

### Keep Tests Focused

Each test should verify one specific integration:

```typescript
// Good - focused test
it("should store metadata on table creation", () => {
  const table = mockFigma.figma.createFrame();
  canvas.storeTableMetadata(table, "frame-1", 42);
  
  const metadata = table.getPluginData("voice_over_annotations_tableMetadata");
  expect(JSON.parse(metadata).annotationId).toBe(42);
});

// Bad - too broad
it("should handle full annotation workflow", () => {
  // Tests too many things at once
});
```

## Examples

See the integration test files for complete examples:

- `storage.test.ts` - StorageService integration with plugin data
- `message-mocks.test.ts` - Message system mock verification
- `canvas-operations.test.ts` - Canvas operations with mock nodes

## Limitations

### What Mocks Cover

✅ Node CRUD operations
✅ Plugin data storage
✅ Message passing
✅ Page operations
✅ Call tracking
✅ Notifications

### What Mocks Don't Cover

❌ Visual rendering (use manual testing)
❌ Real Figma API edge cases (may differ from mocks)
❌ Performance under load
❌ Complex layout calculations
❌ Font rendering details

### When to Use Mocks

Use mocks for:
- Testing service interactions
- Verifying plugin data storage
- Testing message handling flows
- Catching regressions in API usage

Don't rely solely on mocks for:
- Visual verification (always test in Figma)
- Performance optimization
- Edge cases in real Figma API

## Maintenance

### Updating Mocks

When Figma API changes:
1. Update the relevant mock class
2. Add tests to verify new behavior
3. Update this documentation

### Adding New Mocks

To add a new mock:
1. Create the mock class/function
2. Add test utilities
3. Write tests to verify the mock
4. Document usage patterns
5. Add examples to integration tests

## Related Files

- `src/__tests__/setup.ts` - Global test setup
- `src/__tests__/fixtures/` - Test data fixtures
- `vitest.config.ts` - Test configuration
