# Contributing

Thanks for taking the time to improve `@0001-labs/drag`.

## Development

Use pnpm and Node.js 20 or newer.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm test:browser
```

## Pull requests

- Keep changes focused.
- Add or update tests for behavioral changes.
- Update docs when the public API changes.
- Do not commit generated output from `dist/`, `docs-dist/`, Playwright reports, or coverage.

## Design constraints

The core package should stay framework-neutral and imperative. Optional framework adapters, auto-scroll, hitbox utilities, and polished visual indicators should live outside the v1 core unless the project intentionally expands scope.
