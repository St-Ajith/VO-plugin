## ADDED Requirements

### Requirement: Request ID Generation
The system SHALL generate a unique request ID for each state-mutating operation initiated from the UI.

- Request ID is a UUID v4 generated via `crypto.randomUUID()`
- Request ID is generated in the UI thread before `emit()`
- Request ID is included in the message payload
- Request ID is stored in `inFlightRequests` Map with pre-mutation snapshot

#### Scenario: Create annotation generates request ID
- **WHEN** user clicks "Create Annotation"
- **THEN** a UUID is generated (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **AND** the CREATE_ANNOTATION message includes `requestId` field
- **AND** the request is tracked in `inFlightRequests` with current annotations snapshot

#### Scenario: Request ID is unique per operation
- **WHEN** user rapidly clicks "Create" twice within 100ms
- **THEN** two distinct UUIDs are generated
- **AND** both are tracked separately in `inFlightRequests`

### Requirement: Response Echo and Correlation
The system SHALL echo the request ID in all responses to state-mutating operations.

- Main thread extracts `requestId` from incoming message
- Main thread includes `requestId` in response message
- UI matches response to originating request via `requestId`

#### Scenario: Create response includes request ID
- **WHEN** CREATE_ANNOTATION with `requestId: "abc-123"` is processed
- **THEN** ANNOTATION_CREATED response includes `requestId: "abc-123"`
- **AND** UI can correlate response to the original action

#### Scenario: Error response includes request ID
- **WHEN** an operation fails
- **THEN** the error response includes the original `requestId`
- **AND** UI can identify which operation failed

### Requirement: Stale Response Discard
The system SHALL discard responses with unknown or expired request IDs.

- UI checks `inFlightRequests` for the response's `requestId`
- If not found (unknown or already completed), response is discarded
- Discarded responses are logged as warnings
- Valid responses remove entry from `inFlightRequests`

#### Scenario: Stale response is discarded
- **WHEN** a response arrives with `requestId: "xyz-789"`
- **AND** `inFlightRequests` does not contain "xyz-789"
- **THEN** the response is logged as stale
- **AND** the response is not applied to UI state

#### Scenario: Valid response clears tracking
- **WHEN** a response arrives with `requestId: "abc-123"`
- **AND** `inFlightRequests` contains "abc-123"
- **THEN** the entry is removed from `inFlightRequests`
- **AND** the pre-mutation snapshot is returned for potential rollback

### Requirement: Request Deduplication
The system SHALL prevent duplicate execution of operations with the same request ID.

- Main thread maintains `processedRequestIds` Set with 5-second TTL
- If incoming `requestId` is in Set, operation is skipped
- Skipped operations are logged as duplicates
- Set entries are cleaned up after TTL expires

#### Scenario: Duplicate message is skipped
- **WHEN** CREATE_ANNOTATION with `requestId: "abc-123"` arrives
- **AND** "abc-123" was already processed within 5 seconds
- **THEN** the operation is skipped
- **AND** a debug log notes "Duplicate request skipped"

#### Scenario: Expired deduplication entry allows re-execution
- **WHEN** 6 seconds have passed since `requestId: "abc-123"` was processed
- **AND** the same `requestId` arrives again
- **THEN** the operation is allowed (entry expired)
