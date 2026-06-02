# Change: Gauge Performance Against PRD Requirements

## Why
The PRD specifies performance requirements (load <2s, UI <100ms, canvas 50+ annotations <5s) but there's no infrastructure to measure or enforce them. Current batch processing exists but lacks formal benchmarking.

## What Changes
- Add benchmark utility for timing critical paths
- Instrument plugin load, annotation list render, and canvas insert
- Add virtualized rendering for AnnotationList when 20+ annotations
- Create automated benchmark tests asserting PRD thresholds

## Impact
- Affected specs: none (new capability)
- Affected code: batch-processor.ts, message-batcher.ts, AnnotationList.tsx, main.ts
