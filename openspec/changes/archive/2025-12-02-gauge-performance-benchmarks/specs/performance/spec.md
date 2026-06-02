## ADDED Requirements

### Requirement: Performance Benchmarking Infrastructure
The system SHALL provide utilities for measuring and reporting performance metrics.

- Benchmark utility supports start/stop/measure patterns
- Critical paths are instrumented (plugin load, canvas insert, UI render)
- Metrics can be enabled/disabled via plugin settings
- Benchmark results are logged to console when enabled

#### Scenario: Measure plugin load time
- **WHEN** the plugin is opened
- **THEN** load time is measured from initialization start to UI ready
- **AND** the metric is logged if performance monitoring is enabled

#### Scenario: Measure canvas insert time
- **WHEN** annotations are inserted into Figma canvas
- **THEN** total insert time is measured and logged
- **AND** per-annotation timing is available for debugging

### Requirement: Virtualized Annotation List
The system SHALL render annotation lists efficiently for large counts.

- Lists with 20+ annotations use virtualized/windowed rendering
- Only visible annotations are rendered to DOM
- Scroll position is maintained during updates
- Performance remains under 100ms for UI interactions

#### Scenario: Render large annotation list
- **WHEN** a frame has 50+ annotations
- **THEN** only visible annotations are rendered to DOM
- **AND** scrolling remains smooth (no jank)

#### Scenario: Maintain scroll position on update
- **WHEN** an annotation is updated while scrolled down
- **THEN** the scroll position is preserved
- **AND** the updated annotation reflects changes immediately
