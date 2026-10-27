# Penrosum

A merging game on a Penrose tiling of kites and darts. Values climb a ladder of powers of 3 written as letters: # (0), A (1), B (3), C (9) and on up to Z. Place the next value (dealt at random, with a shape; now and then a ★ wildcard) on an empty tile of that shape. When that makes a group of three or more matching tiles, they merge into the tile you placed, one rung up or more: three As make a B, nine make a C. A merge of exactly three leaves a # of rubble behind. Merges score points as you play. Make a Z to win.

The board comes from [Penrogo](https://github.com/dblevins-3dgfx/penrogo). The game ends when the board is full; each board size keeps a **Top 10** of scores in your browser. [SPEC.md](SPEC.md) describes the rules, and the decisions behind them; rules still being tried (its open questions) can be switched in the game's **How to play** dialog. **New Game** deals a new board every time, cut from a different part of the tiling at a random angle, in three square sizes (exactly 50, 100 and 200 tiles), fitted to the screen.

## On a phone

On an iPhone, open the game in Safari and use **Share → Add to Home Screen**: it then opens full screen from its own icon, like an app. (Its scores and settings are kept apart from Safari's.) In **⚙ Preferences**, **Tap to preview** lets a tap show what a move would do before you commit.

## Running

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server also listens on your local network, so you can play from a phone or tablet at the network address Vite prints.

## Publishing

Every push runs the typecheck and unit tests, and every push to `main` then publishes the game to GitHub Pages at `https://dblevins-3dgfx.github.io/penrosum/` (see `.github/workflows/deploy.yml`). It is a static site, so there is no server to run.

Changes go through pull requests: see `CLAUDE.md` for the rules (keep `SPEC.md` current, test every spec rule) and `.github/pull_request_template.md` for the checklist.

One-time setup, needed before the first deploy: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.

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
- `src/lib/colors.ts`: tile colors, shared by the board and the Next chip
- `src/lib/labels.ts`: how values are written (as letters)
- `src/lib/prefs.ts`: the player's preferences, and reading them and the board size from storage
- `src/lib/powerups.ts`: the power-ups' rules (what earns each, what each does), then the power-ups in one table (names, caps, what earns each, what using one on the board does), and which one is armed
- `src/lib/settle.ts`: what follows a move's merges: rubble, points, the power-ups earned and the status line
- `src/lib/scores.ts`: the top 10 for each board size
- `src/lib/rules.ts`: the core rules: placing, merging, chains, rubble, scoring, the deck, wildcards, shapes, the spare and the end (and an option for each open question, when there are any)
- `src/lib/*.test.ts`: unit tests for the above
- `src/Game.tsx`: the game screen: the layout, the panel, the status line and the dialogs
- `src/BoardCanvas.tsx`: the board, fitted to its space and drawn on a canvas, reporting the tile under the pointer
- `src/useGame.ts`: the game's state and actions: the position and Undo, the deal and the spare, the power-ups, recording the top 10
- `src/storage.ts`: what is remembered in this browser
- `src/Dialog.tsx`, `src/HowToPlay.tsx`, `src/Scoreboard.tsx`, `src/Preferences.tsx`: the dialogs (How to play, Top 10, Preferences)
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point, Tailwind setup, and the touch and home-screen settings
- `public/`: the web app manifest and icons
- `SPEC.md`: the game as implemented, and the open questions
- `untested-requirements.md`: spec rules without unit tests, and why
