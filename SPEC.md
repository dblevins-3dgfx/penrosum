# Penrosum: Specification

Status: an experimental prototype. This describes the game as currently implemented (`Game` in `src/Game.tsx`, the Preferences dialog in `src/Preferences.tsx`, rules in `src/lib/rules.ts`, board in `src/lib/board.ts` and `penrose-board.ts`, fitting it to the screen in `src/lib/view.ts`, saved choices in `src/lib/prefs.ts`). Several rules are not decided yet; they are listed under [Open questions](#5-open-questions), and each option is playable from the **Preferences** dialog. Questions already decided are recorded under [Resolved questions](#8-resolved-questions).

## 1. Overview

A merging number game on a Penrose tiling of kites and darts. The player places a number from 0 to 3, dealt at random and shown in advance, on an empty tile. When that makes a group of three or more tiles holding the same number, the tile just placed takes the sum of the group and the other tiles in it are cleared. Three 1s make a 3, three 3s make a 9, and so on. Each game starts with a few numbers already scattered on the board.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript |
| Tests | Vitest (`npm test`), for everything in `src/lib` |
| Rendering | HTML5 Canvas 2D, sized to the space between the header and the status line at the screen's pixel density |
| Styling | Tailwind CSS v4 utility classes |
| Persistence | The rule options (`penrosum.options`) and board size (`penrosum.boardSize`), in the browser's localStorage. A missing or unrecognized saved value falls back to its default. The game itself is in memory only |

## 3. Board

- **Tiling.** `penrose-board.ts` is Penrogo's board generator, unchanged: a patch of kites and darts made by subdividing a sun of five kites 7 times, so it is a correct Penrose tiling by construction (see Penrogo's spec, section 4).
- **Sizes.** Three board sizes, each a square playfield in board units (the kite's long edge is 60 units). The sides are picked for about 50, 100 and 200 tiles:

  | Size | Playfield | Tiles |
  |---|---|---|
  | Small | 360 x 360 | 47 |
  | Medium (default) | 485 x 485 | 103 |
  | Large | 660 x 660 | 196 |

- **Shape.** Every board is square, so it fits the screen the same way whichever way the screen is turned; rotating a phone mid-game just rescales the board.
- **Placement.** The patch is aligned to a kite at the center of the playfield, pointing up, and clipped to tiles lying fully inside it. Each size always gives the same board (before seeding).
- **Adjacency.** Two tiles are neighbors when they share a full edge, so a tile has at most four neighbors. Tiles on the ragged edge of the board have fewer.

## 4. Rules

- **Start.** Each new game seeds the board: 10% of its tiles (`SEED_FRACTION`, rounded), picked at random, get a random number from 0 to 3 (`SEED_VALUES`), each equally likely. Neighboring seeds never hold the same number, so no group exists before the first move; a picked tile whose neighbors already hold all four numbers is passed over for another. Seeded 0s can't be played on and match only a placed 0, so they act as obstacles; drawn 0s can merge them (see **Merge**). Seeded tiles look the same as placed ones. Undo goes back as far as the seeded board.
- **Tiles** are either empty or hold a number. A tile can hold 0 (a seed, or a placed 0), which can't be played on and matches only a placed 0.
- **Next value.** Each move's value is drawn at random from the deck (`DECK`) before the move and shown in advance ("Next" in the header): 0 10% of the time, 1 63%, 2 18% and 3 9% (1, 2 and 3 at 7 : 2 : 1). With wildcards (Q8) the deck can also deal a wildcard, shown as ★.
- **A move** places the next value on any empty tile.
- **Group.** After placing, the group is the placed tile plus every matching tile connected to it through other matching tiles (tiles are connected when they share an edge). So a long chain of matching tiles collapses all at once, even when the placed tile is at its end. Matching tiles hold the same number, and may also need the same shape (Q6). Tiles with a different number never join the group, and the group never passes through them; zeros join only a placed 0.
- **Merge.** If the group has 3 or more tiles (`MIN_GROUP`), the placed tile takes the sum of their numbers (the number times the group's size) and the other tiles in the group become empty: they leave the board and can be played on again, so free space comes back after every merge. Otherwise nothing else changes. Zeros merge the same way: a 0 placed so that it connects to two or more zeros takes them into one 0 where it was placed, so zero obstacles can be consolidated, moved and reduced (three zeros become one).
- **Chain reaction.** After a merge, the placed tile's new number may match the tiles around it: three 1s make a 3 next to two other 3s. If its new number makes a group of 3 or more, it merges again, and keeps going as long as it can, so one move can make 3, then 9, then 27. Every merge empties at least two numbered tiles and numbers none, so a chain always ends.
- **Pressure.** After the move (and any chain reaction), the pressure rule may add zeros to the board (Q9).
- **End.** The game ends when no empty tile is left, or when the goal is reached (Q4).
- **Undo** steps back one move at a time, as far as the start of the game. **New Game** starts over on a new board of the size picked from its menu. Changing a rule option takes effect from the next move and does not restart the game.

## 5. Open questions

Each option below is implemented and can be switched during play, in the **Preferences** dialog. The first one listed is the default.

Every question has a permanent number, Q1, Q2 and so on, given in the order the questions were opened. A number never changes and is never reused, so it means the same question here, in **Resolved questions** (section 8), in the Preferences dialog, and in pull requests and commits. The next new question is **Q10**.

### Q4. What is the goal, and when does the game end?

| Option | Behavior |
|---|---|
| Highest tile (`highest`) | No target: the game ends when the board is full, and the result is the highest tile made |
| Reach a target (`target`) | Make a tile of at least the target (20, 50, 100 or 200) to win; filling the board first loses. The win reports how many moves it took, so fewer moves is better |

Still to think about: a scoring system (for example points per merge), a move limit, a time limit, and how the game should push back so the board fills up (Q9 tries some ways).

### Q6. Which tiles can match?

| Option | Behavior |
|---|---|
| Any shape (`any`) | Kites and darts with the same number match each other |
| Same shape only (`same`) | They must also be the same shape: kite with kite, dart with dart. A group never crosses into the other shape, and a chain reaction only continues with tiles of the placed tile's shape |

How the board affects this, on the medium board before seeding (103 tiles): the 60 kites mostly touch two other kites and form one large connected kite region of 41 tiles. The 43 darts are scattered: the largest dart regions are five-dart stars, and 7 darts touch no other dart, so under "same shape only" a number placed on one of them can never merge.

### Q8. Wildcards in the deck?

A wildcard (★) is placed like a number, on any empty tile, and becomes whichever number does best there (`resolveWild`). It tries each number held by a neighbor, plays out the move with it (chain reactions included), and keeps the one that merges rather than not; among merges, the one leaving the biggest number; then the one clearing the most tiles. If no neighbor's number would merge, it is placed as a 1. So a wildcard can complete any group, including numbers bigger than the deck ever deals (two 27s and a wildcard make 81). The status line says what it became ("Wild played as 3."), and the hover preview shows the result before the move.

| Option | Behavior |
|---|---|
| No (`none`) | The deck deals only numbers |
| Yes (`deck`) | A draw is a wildcard 5% of the time (`WILD_CHANCE`); 0 to 3 share the rest in the same proportions as without |

Still to think about: how often wildcards should come up, whether the player should choose what a wildcard becomes instead of it choosing the best, and other special values (bigger numbers, negatives).

### Q9. Pressure

Merged-away tiles become empty, so a careful player can keep space free and the board may never fill. Each option below adds zeros (obstacles that only drawn 0s can merge away) after a move (`applyPressure`). A merge of zeros never counts as a merge for pressure, so cleaning up zeros never makes more.

| Option | Behavior |
|---|---|
| Off (`none`) | Nothing is added |
| A random 0 after each merge (`mergeZero`) | After a move that merges, a 0 lands on a random empty tile. It costs a tile per merging move, but a 3-tile merge still frees two, so merging still gains space overall |
| A 0 every move, ringed in advance (`spawn`) | After every move, a 0 appears on a tile announced a move ahead, shown with a dashed gray ring. Playing on the ringed tile blocks that move's 0. Then the next tile is announced, picked at random from the empty ones. The board fills steadily whatever the player does, and only merging keeps pace, as in Threes and 2048 |
| Rubble from 3-tile merges (`rubble`) | Each merge of exactly 3 tiles (in a chain reaction too) leaves a 0 on its cleared tile farthest from the placed one. Bigger merges leave none, so it pays to build bigger groups |

## 6. Screen

Everything fits on one screen with no scrolling: a header, the board filling the space below it, and a status line at the bottom.

| Element | Behavior |
|---|---|
| Header | Title; the stats (moves, highest tile, free (empty) tiles, plus the target under the target goal, and the next value, ★ for a wildcard); **Undo** (disabled with nothing to undo), **New Game ▾** and **Preferences**. On a narrow screen it wraps onto two lines |
| New Game menu | Small, Medium and Large, each with its tile count; the current board's size is highlighted. Picking one starts a new game on that size and remembers it for next time. Escape or a click outside closes the menu without starting a game |
| Board | Scaled to fill its space (leaving 8 px around it) and centered. When the window changes size or the screen is rotated, the board is rescaled to fit. Empty tiles white with thin gray edges (one screen pixel wide at any scale); zeros slate gray with a gray "0"; numbered tiles colored by value, from pale yellow for 1 through orange, red, pink, purple and blue to green above 100, with the number on the tile (on a kite at its centroid, on a dart along its axis toward the tip) |
| Last move | Amber outline |
| Next spawn | Under the "a 0 every move" pressure rule, a dashed gray ring on the empty tile where the next 0 will appear |
| Hover | The empty tile under the pointer is tinted blue and shows the number it would end up with: the value placed, or the result of its merges (including any chain reaction). The tiles those merges would clear get a blue outline. Occupied tiles show no preview |
| Status line | Before the first move, a one-line hint on how to play; then what a wildcard became ("Wild played as 3.") the last move's merges ("Merged 3 tiles into 3, then 3 tiles into 9") and any zeros the pressure rule added ("A 0 dropped."), or the result at the end of the game. Cut off with an ellipsis if too long |
| Preferences | A dialog over the board: one row of buttons per open question, labeled with its number (Q4, Q6, Q8, Q9), the target choice under the target goal, and how to play. Escape, the ×, **Done** or a click outside closes it |

Pointer and touch both work: a tap or click places on the tile under it.

## 7. Known limitations

- No sound, animation or skins yet (Penrogo's skin system could be brought over).
- No high scores or saved games.
- Not yet tested on a physical touch device. On touch screens there is no hover, so the merge preview isn't seen before a move.

## 8. Resolved questions

Open questions that have been decided, oldest first, under their permanent numbers. The decision itself now lives in the Rules (section 4), and the options that lost were removed from the game, the code and the tests. Reasons are recorded where they were given.

Before permanent numbers, questions were numbered by position and renumbered as others closed, so older pull requests and commits use those numbers:

| Q | Earlier numbers, in order |
|---|---|
| Q1 | 1 |
| Q2 | 2 |
| Q3 | 3, 2, 1 |
| Q4 | 4, 3, 2, 1 |
| Q5 | 5 |
| Q6 | 5, 4, 3, 2 |
| Q7 | 6, 5, 4 |
| Q8 | 3 |
| Q9 | 4 |

| Q | Decided | Question | Options tried | Decision | What changed | Pull request |
|---|---|---|---|---|---|---|
| Q5 | 2026-10-25 | Chain reactions? | Off; On | **On** | A merged tile merges again while its new number makes a group (Rules: **Chain reaction**). Reason: the game felt better with it on | [#2](https://github.com/dblevins-3dgfx/penrosum/pull/2) |
| Q2 | 2026-10-25 | What do merged-away tiles become? | Empty; Zero (stays on the board as an obstacle) | **Empty** | Merged-away tiles leave the board and can be played on again (Rules: **Merge**). Every merge now frees space, which is what later raised the need for pressure (Q9) | [#5](https://github.com/dblevins-3dgfx/penrosum/pull/5) |
| Q1 | 2026-10-25 | Which tiles count as adjacent? | Whole connected group; Direct neighbors only | **Whole connected group** | A group follows matching tiles through each other, so a chain collapses even from its end (Rules: **Group**) | [#7](https://github.com/dblevins-3dgfx/penrosum/pull/7) |
| Q3 | 2026-10-25 | What value is placed? | Always 1; Random 1 to 3 (7 : 2 : 1); Player picks 1 to 3 | **Random** | Every move is dealt from one deck and shown in advance (Rules: **Next value**). Raised a new question: wildcards (Q8) | [#8](https://github.com/dblevins-3dgfx/penrosum/pull/8) |
| Q7 | 2026-10-25 | Zeros in the deck? | No; Yes (0 on 10% of draws) | **Yes** | The deck is 0 10%, 1 63%, 2 18%, 3 9%, so drawn 0s can merge seeded zero obstacles away (Rules: **Next value**, **Merge**) | [#8](https://github.com/dblevins-3dgfx/penrosum/pull/8) |
