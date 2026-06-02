## 1. Specification
- [ ] 1.1 Update `frame-detection` spec with canvas selection coverage for containers, badges, and table descendants
- [ ] 1.2 Add multi-select rule (use first selected annotation table/descendant)
- [ ] 1.3 Validate change with `openspec validate update-annotation-selection-frame-sync --strict`

## 2. Implementation (after approval)
- [ ] 2.1 Extend selection resolver to handle containers, badges, and table descendants
- [ ] 2.2 Expand UI drawer on canvas badge/table selection
- [ ] 2.3 Honor first-selected annotation table when multiple are selected
- [ ] 2.4 Add tests for container/badge/table selection and multi-select handling
