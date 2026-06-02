# Change: Add CI Workflow for Pull Requests

**Status: Applied** ✅

## Why

Automated testing on PRs will:
- Catch regressions before merge
- Ensure consistent code quality across contributions
- Provide fast feedback with optimized caching
- Build confidence in the test suite

## What Changes

- Add GitHub Actions workflow for PR testing
- Configure npm/node caching for fast CI runs
- Run lint, typecheck, build, and test on every PR
- Add status checks for PR merge requirements

## Impact

- Affected specs: `testing` (adds CI requirement)
- Affected code:
  - `.github/workflows/ci.yml` - new workflow file
- Dependencies on: `add-unit-testing` proposal (must be implemented first)

## Dependencies

This proposal requires `add-unit-testing` to be implemented first, as the CI workflow will run the test suite.
