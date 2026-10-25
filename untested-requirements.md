# SPEC.md rules without unit tests

Every rule in `SPEC.md` should have a unit test in `src/lib/*.test.ts` that fails if the rule breaks. This file lists the rules that don't, and why. Keep it current: a pull request that adds or changes a spec rule either tests it or adds a row here, and one that adds a test for a rule listed here removes its row.

The tests only reach plain functions in `src/lib`. Code inside a React component or hook (such as `src/Game.tsx`) needs a browser to run, so a rule that lives there is untested. The fix is usually to move the decision into a function in `src/lib` and have the component call it, as `src/lib/rules.ts` does.

## Untested rules

| Spec section | Rule | Where it lives | Why it isn't tested |
| --- | --- | --- | --- |
| Technology | The rule options are remembered in localStorage | `loadOptions` / `saveOptions` in `src/Game.tsx` | Browser storage. Merging saved options with the defaults could move into `src/lib`. |
| Rules | Undo steps back one move, as far as the start; New Game clears the board | `undoMove` / `newGame` in `src/Game.tsx` | Component state. |
| Rules | Changing a rule option takes effect from the next move and does not restart the game | `setOption` in `src/Game.tsx` | Component state. |
| Screen | Hover preview: shown only on an empty tile while the game is on, drawn as a blue tint and outlines | `preview` and the drawing effect in `src/Game.tsx` | Pointer events and drawing. What it shows (the final number and the cleared tiles) comes from `previewAt`, tested in `rules.test.ts`. |
| Screen | Tile colors and labels, the last-move outline, the status line | `fillFor`, `labelPoint` and the drawing effect in `src/Game.tsx` | Canvas drawing and layout. |
