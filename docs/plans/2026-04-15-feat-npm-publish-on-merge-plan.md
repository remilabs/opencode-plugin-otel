---
title: "feat: Automated npm publishing on merge"
type: feat
status: active
date: 2026-04-15
---

# feat: Automated npm publishing on merge

## Overview

Wire up the existing release-please + GitHub Actions pipeline to actually publish `@devtheops/opencode-plugin-otel` to npm when a release PR merges. The infrastructure is already 90% in place -- release-please creates release PRs and tags -- but the publish step is missing npm credentials and registry configuration, so it silently fails.

## Problem Statement

Both `.github/workflows/release-please.yml` and `.github/workflows/release.yml` run `npm publish --provenance --access public` but:

1. **No `registry-url`** is passed to `actions/setup-node@v4`, so no `.npmrc` is generated
2. **No `NODE_AUTH_TOKEN`** env var is set, so npm has no credentials
3. **No `NPM_TOKEN` secret** exists in the GitHub repo settings
4. **`release.yml` is redundant** -- it triggers on `v*` tags, which release-please also creates, causing a double-publish race condition on every release

## Proposed Solution

Fix the credential wiring in `release-please.yml`, remove the redundant `release.yml`, and add the `NPM_TOKEN` secret to GitHub.

## Acceptance Criteria

- [x] `release-please.yml` publish job has `registry-url: "https://registry.npmjs.org"` in setup-node
- [x] `release-please.yml` publish job passes `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` to the publish step
- [x] `release-please.yml` publish job has explicit job-level `permissions` (`contents: read`, `id-token: write`)
- [x] `release.yml` is deleted (eliminates double-publish race condition)
- [ ] `NPM_TOKEN` secret is added to GitHub repo settings (manual step -- granular access token scoped to `@devtheops/opencode-plugin-otel` with publish permission)
- [ ] First publish verified on npmjs.com with provenance attestation

## MVP

### `.github/workflows/release-please.yml`

```yaml
name: Release Please

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    name: Release Please
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: node

  publish:
    name: Publish to npm
    needs: release-please
    if: ${{ needs.release-please.outputs.release_created == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22.14.0"
          registry-url: "https://registry.npmjs.org"

      - name: Update npm
        run: npm install -g npm@latest

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Typecheck
        run: bun run typecheck

      - name: Test
        run: bun test

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Delete `.github/workflows/release.yml`

Remove entirely. Recovery from a failed publish can be done by re-running the specific job in the GitHub Actions UI.

## Manual Step Required

After merging the workflow changes, add the npm token to the GitHub repository:

1. Go to [npmjs.com](https://www.npmjs.com) > Access Tokens > Generate New Token
2. Choose **Granular Access Token**
3. Scope to `@devtheops/opencode-plugin-otel` with **Read and write** permission
4. Copy the token
5. Go to GitHub repo > Settings > Secrets and variables > Actions > New repository secret
6. Name: `NPM_TOKEN`, Value: the token from step 4

## Verification

After the first release PR merges:
1. Check the Actions tab for a green publish job
2. Verify the package on `https://www.npmjs.com/package/@devtheops/opencode-plugin-otel`
3. Run `npm audit signatures @devtheops/opencode-plugin-otel` to confirm provenance

## Sources

- `.github/workflows/release-please.yml` -- existing workflow, needs credential fixes
- `.github/workflows/release.yml` -- redundant workflow, to be deleted
- `release-please-config.json` -- confirms release-type `node`, package name
- `.release-please-manifest.json` -- current version `0.6.0`
- [npm provenance docs](https://docs.npmjs.com/generating-provenance-statements)
- [actions/setup-node registry-url](https://github.com/actions/setup-node#usage)
