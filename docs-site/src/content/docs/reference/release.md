---
title: "Release Guide"
description: "> How to cut a release for Production Backend Kit."
---

<!-- AUTO-GENERATED -->
<!-- Source: docs\release.md -->



> How to cut a release for Production Backend Kit.

## Prerequisites

1. **NPM_TOKEN** secret set in GitHub repository settings
   - Go to npmjs.com → Access Tokens → Generate New Token (Automation)
   - Add to GitHub: Settings → Secrets → Actions → `NPM_TOKEN`

2. **Permissions**: You need push access to `main` branch

## Release Process

### Option A: Automatic Release (Recommended)

The release workflow automatically publishes when version changes:

1. **Bump version in `cli/package.json`**
   ```bash
   cd cli
   npm version patch  # or minor, major
   ```

2. **Update CHANGELOG.md**
   ```markdown
   ## [x.y.z] - YYYY-MM-DD
   
   ### Added
   - New feature description
   
   ### Fixed
   - Bug fix description
   ```

3. **Commit and push**
   ```bash
   git add -A
   git commit -m "chore: release vX.Y.Z"
   git push origin main
   ```

4. **Verify release**
   - Check [Actions](https://github.com/ThanhNguyxn/backend-engineering-kit/actions) for workflow status
   - Check [Releases](https://github.com/ThanhNguyxn/backend-engineering-kit/releases) for new release
   - Check [npm](https://www.npmjs.com/package/production-backend-kit) for published package

### Option B: Manual Release (Dry Run First)

1. **Dry run via workflow dispatch**
   - Go to Actions → Release → Run workflow
   - Check "Dry run" option
   - Review the summary

2. **If dry run looks good**, push a version bump:
   ```bash
   cd cli
   npm version patch
   git push origin main
   ```

## Version Strategy

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes, docs | `patch` | 1.0.0 → 1.0.1 |
| New features (backward compatible) | `minor` | 1.0.0 → 1.1.0 |
| Breaking changes | `major` | 1.0.0 → 2.0.0 |

## Pre-Release Checklist

Before cutting a release:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] CLI smoke tests pass:
  ```bash
  node dist/index.js --help
  node dist/index.js doctor
  node dist/index.js lint
  ```
- [ ] Package sanity:
  ```bash
  npm pack
  tar -tzf production-backend-kit-*.tgz | head
  ```
- [ ] CHANGELOG.md updated
- [ ] README.md examples are current
- [ ] No uncommitted changes

## Troubleshooting

### Release workflow not triggered

- Ensure commit message doesn't contain `skip ci` or `skip release`
- Check that changes include `cli/**` files

### npm publish fails

- Verify NPM_TOKEN is set correctly
- Check token hasn't expired
- Verify package name isn't taken

### Tag already exists

- Release is skipped if tag exists
- Bump version again if needed

## Rollback

If a bad release is published:

```bash
# Deprecate the bad version
npm deprecate production-backend-kit@x.y.z "Critical bug, use x.y.z+1"

# Fix and release new version immediately
npm version patch
git push origin main
```

## Local Testing Before Release

```bash
cd cli
npm run build
npm pack

# Test in fresh directory
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install /path/to/production-backend-kit-x.y.z.tgz
npx bek --help
npx bek doctor
```
