# Frame Detection

## Purpose

Smart frame identification, context switching, and navigation. This capability enables the plugin to detect which Figma frame contains the user's selection and automatically switch context to show relevant annotations.

## Requirements

### Requirement: Detect Current Frame
The system SHALL detect the top-level frame containing the current selection.

- Traverses node hierarchy to find the nearest FRAME or SECTION ancestor
- Returns frame info including `id`, `name`, `pageId`, `pageName`
- Handles nested frames by finding the top-level container
- Returns null when selection is outside any frame

#### Scenario: Detect frame from nested selection
- **WHEN** user selects a text node nested 3 levels deep in a frame
- **THEN** the system identifies the top-level frame containing it
- **AND** frame info is returned with correct metadata

#### Scenario: Detect frame from direct frame selection
- **WHEN** user selects a top-level frame directly
- **THEN** that frame is identified as the current frame

#### Scenario: Selection outside frames
- **WHEN** user selects an element at the page root (not in any frame)
- **THEN** null is returned for frame detection

### Requirement: Auto-Switch Frame Context
The system SHALL automatically switch to a new frame context when the user's selection changes.

- Listens to Figma `selectionchange` events
- Updates the current frame ID when selection moves to a different frame
- Emits `FRAME_AUTO_SWITCHED` event to UI with new frame's annotations
- Filters annotation list to show only annotations for the new frame

#### Scenario: Selection moves to different frame
- **WHEN** user selects an element in Frame B (currently viewing Frame A)
- **THEN** the plugin context switches to Frame B
- **AND** the UI updates to show Frame B's annotations
- **AND** `FRAME_AUTO_SWITCHED` event is emitted

#### Scenario: Selection within same frame
- **WHEN** user selects a different element in the same frame
- **THEN** no context switch occurs
- **AND** the annotation list remains unchanged

### Requirement: List Available Frames
The system SHALL provide a list of all available frames based on selection scope.

- **Current Page scope**: Returns all top-level frames on the current page
- **Document-Wide scope**: Returns all top-level frames across all pages
- Frame names include page name suffix for document-wide scope

#### Scenario: List frames on current page
- **WHEN** selection scope is "currentPage"
- **THEN** only frames from the current Figma page are listed

#### Scenario: List frames document-wide
- **WHEN** selection scope is "documentWide"
- **THEN** frames from all pages are listed
- **AND** each frame name includes its page name (e.g., "Frame Name (Page 1)")

### Requirement: Navigate to Frame
The system SHALL zoom the viewport to a selected frame.

- Uses `figma.viewport.scrollAndZoomIntoView()` for navigation
- Switches Figma page if the frame is on a different page
- Updates the current frame context after navigation

#### Scenario: Zoom to frame on current page
- **WHEN** user selects a frame from the dropdown
- **THEN** the viewport zooms to show that frame
- **AND** the frame becomes the current context

#### Scenario: Navigate to frame on different page
- **WHEN** user selects a frame that exists on a different page
- **THEN** Figma switches to that page
- **AND** the viewport zooms to the frame

### Requirement: Handle Annotation Table Selection
The system SHALL navigate to the source frame when an annotation table is selected.

- Detects when selected node is an annotation table (by name pattern or metadata)
- Reads source frame ID from table metadata
- Switches context to the source frame
- Expands the corresponding annotation in the UI accordion

#### Scenario: Select annotation table navigates to source
- **WHEN** user selects an "Annotation Table 5 - frameId" node
- **THEN** the plugin context switches to the source frame
- **AND** annotation 5 is expanded in the UI
- **AND** a notification shows "Navigated to source frame: {frameName}"
