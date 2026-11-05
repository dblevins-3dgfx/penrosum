# Penrosum

A merging game on a Penrose tiling of kites and darts. Values climb a ladder of powers of 3 written as letters: # (0), A (1), B (3), C (9) and on up to Z. Place the next value (dealt at random, with a shape; now and then a ★ wildcard) on an empty tile of that shape. When that makes a group of three or more matching tiles, they merge into the tile you placed, one rung up or more: three As make a B, nine make a C. A merge of exactly three leaves a # of rubble behind. Merges score points as you play. Make a Z to win.

The board comes from [Penrogo](https://github.com/dblevins-3dgfx/penrogo). The game ends when the board is full; each board size keeps a **Top 10** of scores in your browser. [SPEC.md](SPEC.md) describes the rules, and the decisions behind them; rules still being tried (its open questions) can be switched in the game's **How to play** dialog. **New Game** deals a new board every time, cut from a different part of the tiling at a random angle, in three square sizes (exactly 50, 100 and 200 tiles), fitted to the screen.

## On a phone

On an iPhone, open the game in Safari and use **Share → Add to Home Screen**: it then opens full screen from its own icon, like an app. (Its scores and settings are kept apart from Safari's.) In **⚙ Preferences**, **Tap to preview** lets a tap show what a move would do before you commit, and **Skin** changes the ladder the tiles climb: **Alphabet** (A to Z) or **Evolution** (🦠 microbe to 🧑 human, with 🦴 bones for rubble). The rules are the same in every skin.

## Running

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server also listens on your local network, so you can play from a phone or tablet at the network address Vite prints.

## Publishing

Every pull request and every push to `main` runs the typecheck and unit tests. Once they pass, `.github/workflows/deploy.yml` publishes the game to GitHub Pages from the `gh-pages` branch. It is a static site, so there is no server to run.

- **`main`** is the live game: `https://dblevins-3dgfx.github.io/penrosum/`.
- **Each open pull request** gets a preview: `https://dblevins-3dgfx.github.io/penrosum/pr-preview/pr-<number>/`. One comment on the pull request links to it and is kept up to date. Each push to the pull request rebuilds it, and closing or merging the pull request removes it. Pages can take a minute or two to update. The comment's link changes with each push (`?v=<commit>`), so it always opens the newest build rather than a copy the browser kept.

A preview is the game as it would be after merging. It shows a small **Preview #<number>** badge under the title, linking to the pull request. It keeps its own scores and settings, so trying a change can never alter the live game's top 10 or preferences. The first time a preview opens, it copies the live game's data, so a change to stored data is tried out on real data (`src/lib/preview.ts`). A pull request from a fork gets the checks but no preview.

Changes go through pull requests: see `CLAUDE.md` for the rules (keep `SPEC.md` current, test every spec rule) and `.github/pull_request_template.md` for the checklist.

One-time setup: repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**. The first workflow run creates the branch. If the branch has no live game yet, a preview run builds `main` into it too, so the live site never goes blank when the source is switched.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Run the TypeScript checker |
| `npm test` | Run the unit tests |

## Layout

- `penrose-board.ts`: Penrose tiling generation and the tile adjacency graph (from Penrogo, unchanged)
- `src/lib/board.ts`: board sizes, cuts this game's random square boards from the patch, and finds the tile under a point
- `src/lib/view.ts`: fits the board to the space on screen
- `src/lib/colors.ts`: what a palette is (every color the board and the Next and Spare chips are drawn in), and the game's own, `DEFAULT_PALETTE`
- `src/lib/skin.ts`: what a skin is (a ladder of 26 pieces, a rubble icon, a palette) and the words its messages use (`termsFor`)
- `src/lib/skins/`: the skins, one file each (`alphabet.ts`, `evolution.ts`), with their tests; `index.ts` finds them and `skins.test.ts` checks every one
- `src/emoji.ts`: which emoji this device can draw, so a picture skin falls back to older ones
- `src/lib/labels.ts`: how values are written (as letters)
- `src/lib/prefs.ts`: the player's preferences, and reading them and the board size from storage
- `src/lib/powerups.ts`: the power-ups' rules (what earns each, what each does), then the power-ups in one table (names, caps, what earns each, what using one on the board does), and which one is armed
- `src/lib/status.ts`: the status line: what just happened, or what to do next
- `src/lib/settle.ts`: what follows a move's merges: rubble, points, the power-ups earned and the status line
- `src/lib/scores.ts`: the top 10 for each board size
- `src/lib/rules.ts`: the core rules: placing, merging, chains, rubble, scoring, the deck, wildcards, shapes, the spare and the end (and an option for each open question, when there are any)
- `src/lib/*.test.ts`: unit tests for the above
- `src/Game.tsx`: the game screen: the layout, the panel, the status line and the dialogs
- `src/BoardCanvas.tsx`: the board, fitted to its space and drawn on a canvas, reporting the tile under the pointer
- `src/lib/game.ts`: the game as data and a reducer: taps, Undo, the spare and the power-ups, with randomness passed in so it can be tested
- `src/useGame.ts`: holds the game for the screen and does what isn't pure: remembering the board size, Escape, recording the top 10
- `src/storage.ts`: what is remembered in this browser
- `src/Dialog.tsx`, `src/HowToPlay.tsx`, `src/Scoreboard.tsx`, `src/Preferences.tsx`: the dialogs (How to play, Top 10, Preferences)
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point, Tailwind setup, and the touch and home-screen settings
- `public/`: the web app manifest and icons
- `SPEC.md`: the game as implemented, and the open questions
- `untested-requirements.md`: spec rules without unit tests, and why

## Adding a skin

A skin changes only how the game looks and what its pieces are called. The rules stay the same. To add one:

1. Add `src/lib/skins/<id>.ts`. It default-exports a `Skin` (see `src/lib/skin.ts`) whose `id` is the file name. It needs 26 pieces, each with a name; a rubble icon; the words its messages use (`piece`, `ladder`); and a palette, usually `{ ...DEFAULT_PALETTE, rungFills, rungTexts, zeroFill }`. If the pieces are emoji, set `pictures: true` and give newer emoji a `fallback`.
2. Optionally, add `src/lib/skins/<id>.test.ts` for anything particular to it.
3. List it in SPEC.md's **Skin** row.

Nothing else changes. The registry (`src/lib/skins/index.ts`) finds the file, and the skin appears in Preferences, How to play and the game. `skins.test.ts` runs the shared checks on it: 26 distinct named pieces, a distinct rubble icon, distinct fills, readable text and distinct outlines.

