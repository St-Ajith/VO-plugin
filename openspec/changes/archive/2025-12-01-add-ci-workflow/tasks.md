## 1. Create CI Workflow
- [x] 1.1 Create `.github/workflows/ci.yml`
- [x] 1.2 Configure triggers: pull_request to main/develop
- [x] 1.3 Set up Node.js environment (node 20.x)

## 2. Configure Caching
- [x] 2.1 Enable npm cache with `actions/setup-node` cache option
- [x] 2.2 Cache node_modules with hash of package-lock.json
- [x] 2.3 Verify cache hit/miss in workflow logs

## 3. Define CI Steps
- [x] 3.1 Install dependencies (`npm ci` for reproducible installs)
- [x] 3.2 Run linting (`npm run lint`)
- [x] 3.3 Run type checking (included in build)
- [x] 3.4 Run build (`npm run build`)
- [x] 3.5 Run tests (`npm test`)

## 4. Status Checks
- [x] 4.1 Verify workflow appears in PR checks
- [x] 4.2 Document required checks for branch protection (optional)

## 5. Validation
- [x] 5.1 Create test PR to verify workflow runs
- [x] 5.2 Verify caching works on subsequent runs
- [x] 5.3 Verify failure correctly blocks PR (intentional failing test)
