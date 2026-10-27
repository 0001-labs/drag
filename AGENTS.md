# Drag

> **Read first:** `/Users/joachim/.agents/harness-instructions.md` (harness instructions), `/Users/joachim/0001/AGENTS.md` (0001). This file wins where they differ.

Drag is the framework-neutral TypeScript drag library, with documentation at https://drag.0001.dev and Play, an Ezo board on Drag and on @hello-pangea/dnd to compare them, on the documentation's front page (`play/`, mounted by `docs/src/components/Play.astro`; `/playground/` redirects there). Call it Play, never playground. Product code: `DRAG`, as recorded in System. Its independent public repository is `0001-labs/Drag`; work on main and keep commits scoped to Drag.

## System parts

System node: `drag` ([map](https://system.0001.dev/system?focus=drag)). Selected requirements: `documentation`, `sharing`, `ds1`, `platform-web`, `stack-astro`, `stack-cloudflare`. Read their guides and dependencies through the studio selection workflow.

- The dedicated Astro/Starlight docs follow Aa's documentation layout. The shared overview remains at docs.0001.dev and links here.
- Design system 1 root tokens, fonts, prose and scaling come through Sync 1 in `play/ds1`; Astro uses that folder as public assets. Play and the docs share those foundations. Retain the pinned source revision when another session has uncommitted DS1 changes.
- The library is headless; the docs style its examples. The documentation rail is a local Starlight adapter following Aa's existing rail, not a new shared control. Starlight owns mobile navigation. Follow DS1's minimal docs chrome: a two-square brand header, GitHub alone in the footer, no Terms/Privacy links, version badge, duplicate header links or header search.
- This is a public static library site: no sign-in, accounts, backend, payments or personal data. Support and licensing point to the public repository. Per the explicit documentation design decision, omit site legal links from this static library docs footer. Feature flags do not apply to complete static documentation.
- Docs describe the development source. Verify npm exports before changing installation guidance: alpha.0 currently lacks sortable, React and grid. A docs deployment is not a package release or a public-source push.

## Checks and release

Use the existing pnpm scripts. `pnpm check`, `pnpm test`, `pnpm build` and `pnpm site:build` cover sync integrity, types, lint, library tests and both static sites. Browser testing follows the harness rule; it is not automatically required for documentation edits.

`pnpm run deploy` checks the source with `sync1 guard`, builds the docs with Play on their front page, and publishes the `drag` Cloudflare Worker. Verify the dedicated domain over HTTP and compare its `drag-revision` meta value with the deployed commit, then check key pages and asset URLs. The fallback workers.dev address alone does not prove drag.0001.dev works. This host intentionally uses the zone route `drag.0001.dev/*`: its existing externally managed DNS record blocks custom-domain attachment, while the zone route serves the checked Worker successfully. Keep that route unless the DNS ownership is migrated.

Npm release is separate, through `scripts/release.mjs`; retain the alpha channel until API compatibility is decided. Keep source-code changes out of a documentation-only release.

## One settle per drop

A reorder must land directly in its final grid-aligned layout once. Resolve destination membership, wrapping, sizing and spacing before measuring the landing target; do not land in a provisional position and then reposition after committing. Adapters that change layout on drop use `prepareDrop` to commit and return the final authored element before the existing overlay settles. One owner animates the handoff; cancellation and reduced motion must leave correct final geometry without a second correction. Pointer regression tests must compare the landing endpoint with the committed element, including side placement and mixed-height content.

Siblings move once per change of place. At lift the engine measures each list's flow (`src/flow.ts`: starts, sizes, margins, gap, collapsing block margins) and checks it draws the list where the page did; where it holds, siblings shift straight to where the dropped order will draw them. Where it does not (wrapping rows, multi-column grids, spacing that depends on position), the uniform room remains. `onMovement` reports every sibling move: `drag` while carried, `drop` for any move after release, which is a second movement and a bug in the prediction or the page.
