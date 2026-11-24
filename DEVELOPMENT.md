# Development notes

What isn't written down elsewhere. Read these first:
- [README.md](README.md): running, scripts, layout, publishing and adding a skin.
- [CLAUDE.md](CLAUDE.md): the standing rules: keep `SPEC.md` current, number open questions, test every spec rule.
- [SPEC.md](SPEC.md): the game as built, its open questions, and the decisions already made (section 8).
- [untested-requirements.md](untested-requirements.md): spec rules without unit tests, and why.
- [.github/pull_request_template.md](.github/pull_request_template.md): the PR checklist.

## How changes are made

- **One owner:** `dblevins-3dgfx` owns the repository, opens the issues and merges every PR. There are no other reviewers.
- **Issue first:** an idea or bug is logged as an issue, often with options and a recommendation. Work starts when the owner picks an issue ("let's address #N").
- **Questions:** if an issue would change a rule and the choice isn't settled, it becomes a numbered open question in `SPEC.md`, with every option playable from How to play. Q17 is one (#71, #72). If an issue is only a matter of taste, it becomes a player preference instead, as Q15 became **Tap to preview** (#43).
- **One change per PR:**
  - Write the PR body with the template's sections.
  - Put "Closes #N" first.
  - Commit titles are plain sentences, with the issue number in parentheses.
  - Work so far has come from `claude/…` branches.
- **Merging:** the owner tries the PR's preview (see README, Publishing), then merges with a merge commit (no squash). Follow-up changes asked for in PR comments go on the same PR.
- **Releases:** there are no tags and no versions (`package.json` stays `0.0.0`). Every merge to `main` deploys.

## Checks

- **Before a PR:** run `npm run typecheck` and `npm test`. CI runs both (`check` in `.github/workflows/deploy.yml`).
- **The build:** `npm run build` runs only in CI's `publish` job, which a PR from a fork skips. Run it locally if you touch `vite.config.ts`, `index.html` or anything under `public/`.
- **No lint or format:** there is no linter or formatter. Match the style of the surrounding code: two-space indents, single quotes, comments in plain sentences.
- **Fresh test runs:** Vitest's file-system module cache is off (`test.fsModuleCache: false` in `vite.config.ts`). With it on, a skin file added under the registry's `import.meta.glob` went untested until the cache was cleared (#80).
- **TypeScript 7:** `typescript` is version 7, the native compiler, which has no JavaScript API. A tool that imports `typescript`, such as a complexity analyser, needs its own TypeScript 5.x install outside the project.

## Running and testing locally

- **Seeing a production build:** `npm run build && npm run preview` serves at `/`. The Pages base path `/penrosum/` is applied only when `BASE_PATH` is set: `BASE_PATH=/penrosum/ npm run build`.
- **Building a preview locally:** set `VITE_PREVIEW=<n>` (and optionally `VITE_PREVIEW_URL`) at build time. That shows the badge and uses the preview's storage keys (`src/storage.ts`, `src/lib/preview.ts`).
- **Resetting saved data:** in the browser's devtools, delete the `penrosum.*` keys. Don't clear all site data for `dblevins-3dgfx.github.io`, because every Pages site of this account shares that origin and its storage.
- **Repeatable browser tests:** with Playwright, seed `Math.random` in `page.addInitScript` and clear `localStorage` there. The same clicks then give the same board.
- **Proving a change doesn't alter the look:** build `main` and the branch, play the same seeded clicks in both, and compare canvas screenshots. This is how "Alphabet draws pixel for pixel as before" was checked in #80, #83, #85 and #87.
- **Tooltips:** headless browsers don't draw native `title` tooltips. Check the attribute instead, as with the board's tooltip (`tip` on `BoardCanvas`).
- **Emoji:** headless Chromium may lack a color emoji font. Picture skins then fall back to older emoji (`canDrawEmoji` in `src/emoji.ts`), so emoji shown in screenshots can differ from a phone's.
- **States that are hard to reach:** a rare state, such as a skin greyed out because the game outgrew it, can be shown with a throwaway local edit, for example multiplying the `highest` passed to Preferences. Never commit such an edit.
- **Checking a deploy from a sandbox:** a sandbox may not reach `github.io` (blocked by a proxy in the cloud sessions used so far). Check the `gh-pages` branch instead: every asset named in `index.html` should exist there. The Actions run named "pages build and deployment" shows whether Pages published it.

## Gotchas

- **Copying a build:** never copy a build into `gh-pages` by size and time. A rebuilt `index.html` is the same size as the last one, with only the script's hash changed, so `rsync`'s quick check skipped it. The live site went blank (#83). The workflow now uses `rsync --checksum`, and a "Check the published pages" step fails the run if a page names a missing file. Keep both.
- **Pages caching:** Pages lets browsers reuse a page for about 10 minutes, so a fresh deploy can look unchanged. The preview comment's link carries `?v=<commit>` for this reason (#82). On the live site, force a reload (Ctrl+Shift+R).
- **Shared origin:** all `dblevins-3dgfx.github.io` sites share one origin, so every key is prefixed `penrosum.`. Previews use `penrosum.pr<N>.` and copy the live data once (#82).
- **Values are numbers:** values are plain powers of 3, so a ladder stops at 34 rungs (3³³ is the last exact one). Longer ladders would need tiles to store rungs instead (#86).
- **The game's goal:** it lives in the game (`top`), not in a constant. `TOP_VALUE` is only Alphabet's Z and the default. Upgrade has no cap at Z, because a game still going holds nothing at its top (#86).
- **Skin files:** a file in `src/lib/skins/` must default-export a skin whose `id` is the file name. Otherwise `index.ts` throws at load.
- **Testing the logic:** keep rule logic out of React. Plain functions in `src/lib` are what the tests reach (`CLAUDE.md`). Most past refactors moved logic there: PRs #52, #61, #63 and #68.
- **Build files:** `*.tsbuildinfo` is in `.gitignore` because one was committed once by mistake.

## Decisions

- **Alphabet:** it is the default skin and must keep drawing exactly as before. Other skins may only change how values look and are named, never the rules (#74).
- **Open/Closed skins:** one file per skin, found by the registry, so adding a skin touches nothing else (owner's request on #80).
- **Skin lengths:**
  - Each skin sets its own length, from 10 to 34 rungs (#86).
  - Switching mid-game is "option B": a skin whose top is above your highest tile switches at once, and one you've outgrown waits for your next game.
  - The top 10 is kept per skin, and old entries moved to Alphabet.
- **Picture tooltips:** in skins whose pieces aren't plain letters, the Next and Spare chips and board tiles name the piece and its rung (#74, #85). Alphabet has no board tooltip.
- **Star forge rubble:** it is **e⁺** (antimatter). The owner rejected ☄️ comets (#83).
- **Previews:**
  - Previews run on GitHub Pages, like the Vercel previews in artist-portfolio (#82).
  - The badge sits small under the title, because beside it it pushed the Spare onto a new line on the owner's Chromebook.
- **Removed or declined:**
  - **Night skin:** dropped when skins became ladders (#74). A calm skin for evening play is now the Garden idea (#76).
  - **Wildcard power-up:** never built, as too strong (#33).
  - **💩 for rubble:** cancelled (#73).
  - **Rename** (#18) and **offline play** (#30): closed as not planned.
- **Writing style:** the owner wants plain, short sentences in the docs and in the game. `SPEC.md` describes what is built, not plans; plans go in issues.
- **The owner's devices:** a Chromebook (mouse and trackpad, so hover works) and an iPhone (home-screen app, no hover). Check layout changes at both sizes.

## Setup outside the repository

- **GitHub Pages:** it must serve from the `gh-pages` branch, root (see README, Publishing). The workflow keeps that branch current; never edit it by hand. Its history grows with each deploy, which is harmless.
- **No other services:** there's no custom domain, analytics, search console, server or scheduled job.

## Things to watch for

- **Real devices:** the game hasn't been tested on a physical touch device (SPEC.md, Known limitations), and emoji look different on Apple, Google and ChromeOS.
- **Colors:** a new palette can clash with the board's own preview and outline colors. The tests check fills against each other, not against `previewTint` or the outlines. Star forge's first transition-metal shades matched them (#83).
- **Contrast:** the contrast test is what catches unreadable text skins (vanadium, #83). Don't loosen it.
- **Left-over previews:** if a PR closes while CI is down, its folder can stay in `gh-pages/pr-preview/`. Remove it by re-running that PR's closed event, or with a commit to `gh-pages`.

## Open work

- **#71 (Q17), how a player picks what a ★ plays as:** all three options are built and playable. The owner still has to choose one, then follow `CLAUDE.md` to resolve it.
- **#79, rubble levels:** meant to become Q18. It touches every skin's rubble icon, so settle it before adding many skins.
- **New skins: #75 Size of things, #76 Garden, #78 Real numbers, #81 Transportation, #84 Treasure.**
  - **Ladder lengths:** these issues were written for 26 rungs, before #86. Each can now choose 10 to 34.
  - **#78:** needs smaller text for 3–4 character labels on darts.
  - **#81:** the ZWJ astronaut 🧑‍🚀 may defeat the emoji check.
  - **#84:** needs the shared piece test changed to allow a repeated 💎.
  - **#76:** asks for a dark page, which skins can't do since Night was removed.
