# Penrosum

A merging game on a Penrose tiling of kites and darts. Values climb a ladder of powers of 3 written as letters: # (0), A (1), B (3), C (9) and on up to Z. Place the next value (dealt at random) on an empty tile. When that makes a group of three or more matching tiles, they merge into the tile you placed, one rung up or more: three As make a B, nine make a C. Merges score points as you play. Make a Z to win.

The board comes from [Penrogo](https://github.com/dblevins-3dgfx/penrogo). Some rules are still being decided: the game's **Preferences** dialog switches between the options, and [SPEC.md](SPEC.md) lists them as open questions. **New Game** offers three square board sizes (about 50, 100 and 200 tiles), fitted to the screen.

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
- `src/lib/board.ts`: board sizes, builds this game's square boards, and finds the tile under a point
- `src/lib/view.ts`: fits the board to the space on screen
- `src/lib/colors.ts`: tile colors, shared by the board and the Next chip
- `src/lib/labels.ts`: how values are written (as letters)
- `src/lib/prefs.ts`: reads the saved rule options and board size
- `src/lib/rules.ts`: the rules, with an option for each open question
- `src/lib/*.test.ts`: unit tests for the above
- `src/Game.tsx`: the game screen (state, drawing, controls)
- `src/Preferences.tsx`: the Preferences dialog
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point and Tailwind setup
- `SPEC.md`: the game as implemented, and the open questions
- `untested-requirements.md`: spec rules without unit tests, and why
