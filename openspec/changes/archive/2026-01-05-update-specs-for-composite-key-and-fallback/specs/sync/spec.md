## MODIFIED Requirements
### Requirement: Request ID Generation
The system SHALL generate a unique request ID for each state-mutating operation initiated from the UI.

- **Request ID is a UUID v4 generated via `crypto.randomUUID()` when available**
- **The system SHALL provide a fallback unique identifier (e.g., timestamp + random) for environments where `crypto.randomUUID()` is unavailable**
- Request ID is generated in the UI thread before `emit()`
- Request ID is included in the message payload
- Request ID is stored in `inFlightRequests` Map with pre-mutation snapshot

#### Scenario: Create annotation generates request ID
- **WHEN** user clicks "Create Annotation"
- **THEN** a unique ID is generated
- **AND** the CREATE_ANNOTATION message includes `requestId` field
- **AND** the request is tracked in `inFlightRequests` with current annotations snapshot

#### Scenario: Request ID is unique per operation
- **WHEN** user rapidly clicks "Create" twice within 100ms
- **THEN** two distinct IDs are generated
- **AND** both are tracked separately in `inFlightRequests`

#### Scenario: Fallback ID used when crypto unavailable
- **WHEN** `crypto.randomUUID` is not a function
- **THEN** a fallback ID starting with `req-` is generated
- **AND** the operation proceeds normally
