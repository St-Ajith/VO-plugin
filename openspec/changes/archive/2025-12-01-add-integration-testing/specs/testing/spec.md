## ADDED Requirements

### Requirement: Figma API Mock Infrastructure
The system SHALL provide mock utilities for testing Figma API interactions.

- Mocks cover: `figma.getNodeByIdAsync()`, `figma.currentPage`, `figma.loadAllPagesAsync()`
- Mocks cover: `node.setPluginData()`, `node.getPluginData()`
- Mocks track calls for verification
- Mocks reset between tests for isolation

#### Scenario: Mock node plugin data
- **WHEN** test calls `node.setPluginData(key, value)`
- **THEN** the value is stored in the mock
- **AND** `node.getPluginData(key)` returns the stored value

#### Scenario: Mock node lookup
- **WHEN** test registers a mock node with ID "123"
- **AND** test calls `figma.getNodeByIdAsync("123")`
- **THEN** the registered mock node is returned

#### Scenario: Mock reset between tests
- **WHEN** `mockFigma.reset()` is called
- **THEN** all registered nodes are cleared
- **AND** all tracked calls are cleared

### Requirement: Integration Tests for Services
The system SHALL have integration tests for services that interact with Figma API.

- Tests cover `AnnotationStore` CRUD operations
- Tests cover `MessageRouter` handler flows
- Tests cover `CanvasService` node creation/parsing
- Tests use mocked Figma API

#### Scenario: Test annotation creation saves to node
- **WHEN** `AnnotationStore.createAnnotation()` is called with valid data
- **THEN** `node.setPluginData()` is called on the target element
- **AND** the annotation data is serialized correctly

#### Scenario: Test message routing
- **WHEN** a CREATE_ANNOTATION message is received
- **THEN** `AnnotationStore.createAnnotation()` is called
- **AND** ANNOTATION_CREATED response is emitted

#### Scenario: Test error handling
- **WHEN** an operation fails (e.g., node not found)
- **THEN** error is logged
- **AND** appropriate error response is emitted
- **AND** system state remains consistent

### Requirement: Message Mock Utilities
The system SHALL provide utilities for testing message passing.

- Mock `emit()` to capture outgoing messages
- Mock `on()` to simulate incoming messages
- Helper to simulate full message round-trips

#### Scenario: Capture emitted messages
- **WHEN** service calls `emit('EVENT_NAME', payload)`
- **THEN** the message is captured in mock
- **AND** test can verify message type and payload

#### Scenario: Simulate incoming message
- **WHEN** test triggers a mock incoming message
- **THEN** registered handler is called
- **AND** handler receives correct payload
