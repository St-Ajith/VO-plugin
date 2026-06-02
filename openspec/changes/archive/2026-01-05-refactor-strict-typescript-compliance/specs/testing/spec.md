# Spec Delta: Testing - Strict TypeScript Compliance

## MODIFIED Requirements

### Requirement: REQ-TEST-STRICT-001 TypeScript Strict Mode Compliance

The codebase SHALL compile without errors under the following strict TypeScript compiler options:

- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`

#### Scenario: Build succeeds with strict options enabled

**Given** the `tsconfig.json` has all three strict options enabled
**When** `npm run build:debug` is executed
**Then** the build completes with 0 TypeScript errors

#### Scenario: Tests pass with strict type checking

**Given** the `tsconfig.json` has all three strict options enabled
**When** `npm test` is executed
**Then** all tests pass without type-related failures

---

### Requirement: REQ-TEST-STRICT-002 Array Access Safety

Production code SHALL use safe array access patterns that handle potential `undefined` values from indexed access.

#### Scenario: First element access with guard

**Given** an array that may be empty
**When** accessing the first element
**Then** the code uses destructuring with a guard: `const [first] = arr; if (!first) return;`

#### Scenario: Regex capture group access

**Given** a regex match result
**When** accessing capture groups
**Then** the code uses destructuring with fallback: `const [, group1, group2] = text.match(/pattern/) ?? [];`

---

### Requirement: REQ-TEST-STRICT-003 Optional Property Assignment

Code SHALL NOT explicitly assign `undefined` to optional properties. Instead, conditional spreading or property omission SHALL be used.

#### Scenario: Conditional property inclusion

**Given** a value that may be `undefined`
**When** constructing an object with an optional property
**Then** the code uses conditional spreading: `{ ...baseProps, ...(value && { key: value }) }`

---

### Requirement: REQ-TEST-STRICT-004 Explicit Method Overrides

Class methods that override parent class methods SHALL use the `override` keyword.

#### Scenario: Mock class method override

**Given** a mock class extending a base mock class
**When** overriding a method from the parent
**Then** the method declaration includes the `override` keyword
