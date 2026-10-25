# Penrosum: Specification

Status: an experimental prototype. This describes the game as currently implemented (`Game` in `src/Game.tsx`, the Preferences dialog in `src/Preferences.tsx`, rules in `src/lib/rules.ts`, board in `src/lib/board.ts` and `penrose-board.ts`, fitting it to the screen in `src/lib/view.ts`, saved choices in `src/lib/prefs.ts`). Several rules are not decided yet; they are listed under [Open questions](#5-open-questions), and each option is playable from the **Preferences** dialog.

## 1. Overview

A merging number game on a Penrose tiling of kites and darts. The player places a number, usually 1, on an empty tile. When that makes a group of three or more tiles holding the same number, the tile just placed takes the sum of the group and the other tiles in it are cleared. Three 1s make a 3, three 3s make a 9, and so on. Each game starts with a few numbers already scattered on the board.

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

- **Start.** Each new game seeds the board: 10% of its tiles (`SEED_FRACTION`, rounded), picked at random, get a random number from 0 to 3 (`SEED_VALUES`), each equally likely. Neighboring seeds never hold the same number, so no group exists before the first move; a picked tile whose neighbors already hold all four numbers is passed over for another. Seeded 0s can't be played on and match only a placed 0, so they act as obstacles (which can be cleared up only with zeros in the deck, open question 5). Seeded tiles look the same as placed ones. Undo goes back as far as the seeded board.
- **Tiles** are either empty or hold a number. A tile can hold 0 (a seed, or a placed 0), which can't be played on and matches only a placed 0.
- **A move** places the value for this move (open questions 2 and 5) on any empty tile.
- **Group.** After placing, the group is the placed tile plus the matching tiles that count as adjacent to it (open question 1). Matching tiles hold the same number, and may also need the same shape (open question 4). Tiles with a different number never join the group; zeros join only a placed 0.
- **Merge.** If the group has 3 or more tiles (`MIN_GROUP`), the placed tile takes the sum of their numbers (the number times the group's size) and the other tiles in the group become empty: they leave the board and can be played on again, so free space comes back after every merge. Otherwise nothing else changes. Zeros merge the same way: a 0 placed next to two or more zeros (under the adjacency rule) takes them into one 0 where it was placed.
- **Chain reaction.** After a merge, the placed tile's new number may match the tiles around it: three 1s make a 3 next to two other 3s. If its new number makes a group of 3 or more, it merges again, and keeps going as long as it can, so one move can make 3, then 9, then 27. Every merge empties at least two numbered tiles and numbers none, so a chain always ends.
- **End.** The game ends when no empty tile is left, or when the goal is reached (open question 3).
- **Undo** steps back one move at a time, as far as the start of the game. **New Game** starts over on a new board of the size picked from its menu. Changing a rule option takes effect from the next move and does not restart the game.

## 5. Open questions

Each option below is implemented and can be switched during play, in the **Preferences** dialog. The first one listed is the default.

### 1. Which tiles count as adjacent?

| Option | Behavior |
|---|---|
| Whole connected group (`connected`) | Every tile with the same number reachable from the placed tile through other tiles with that number. A long chain of matching tiles collapses all at once |
| Direct neighbors only (`neighbors`) | The placed tile and its direct neighbors with the same number (at most four). Tiles further along a chain are left alone, and the end of a chain does not merge with only one matching neighbor |

### 2. What value is placed?

| Option | Behavior |
|---|---|
| Always 1 (`ones`) | Every move places 1 |
| Random 1 to 3 (`random`) | Drawn at random, 1 with 70% chance, 2 with 20% and 3 with 10%, and shown in advance ("Next"). Zeros in the deck (open question 5) add 0 to the draw |
| Player picks 1 to 3 (`choose`) | The player chooses 1, 2 or 3 before each move |

Still to think about: whether other values (bigger numbers, negatives, a "wild" tile) should exist, and whether the random weights are right.

### 3. What is the goal, and when does the game end?

| Option | Behavior |
|---|---|
| Highest tile (`highest`) | No target: the game ends when the board is full, and the result is the highest tile made |
| Reach a target (`target`) | Make a tile of at least the target (20, 50, 100 or 200) to win; filling the board first loses. The win reports how many moves it took, so fewer moves is better |

Still to think about: a scoring system (for example points per merge), a move limit, a time limit, and whether the game should push back somehow (for example new tiles appearing) since merged-away tiles become empty and the board may never fill up.

### 4. Which tiles can match?

| Option | Behavior |
|---|---|
| Any shape (`any`) | Kites and darts with the same number match each other |
| Same shape only (`same`) | They must also be the same shape: kite with kite, dart with dart. A group never crosses into the other shape, even under the connected rule, and a chain reaction only continues with tiles of the placed tile's shape |

How the board affects this, on the medium board before seeding (103 tiles): the 60 kites mostly touch two other kites and form one large connected kite region of 41 tiles. The 43 darts are scattered: the largest dart regions are five-dart stars, and 7 darts touch no other dart, so under "same shape only" a number placed on one of them can never merge. With "direct neighbors only" adjacency as well, only darts with two dart neighbors (22 of them) can merge at all.

### 5. Zeros in the deck?

Seeded zeros are obstacles. With zeros in the deck the player can place 0s too, and a 0 placed next to two or more zeros merges them into one 0 where it was placed, so obstacles can be consolidated, moved and reduced (three zeros become one).

| Option | Behavior |
|---|---|
| No (`none`) | 0 is never the value to place; zeros on the board stay where they are |
| Yes (`deck`) | A drawn value is 0 10% of the time (`ZERO_CHANCE`): under "always 1", each move is 0 or 1 (90%); under "random", 0 takes 10% and 1, 2 and 3 share the rest as 63%, 18% and 9%. The next value is shown in advance ("Next"). Under "player picks", 0 joins the choices |

## 6. Screen

Everything fits on one screen with no scrolling: a header, the board filling the space below it, and a status line at the bottom.

| Element | Behavior |
|---|---|
| Header | Title; the stats (moves, highest tile, free (empty) tiles, plus the target under the target goal, and the next value whenever it is drawn at random: under the random value rule, or with zeros in the deck); the value picker; **Undo** (disabled with nothing to undo), **New Game ▾** and **Preferences**. On a narrow screen it wraps onto two lines |
| Value picker | Buttons 1, 2, 3 (and 0 with zeros in the deck), shown only under the "player picks" value rule. If 0 is picked and zeros then leave the deck, the move places 1 |
| New Game menu | Small, Medium and Large, each with its tile count; the current board's size is highlighted. Picking one starts a new game on that size and remembers it for next time. Escape or a click outside closes the menu without starting a game |
| Board | Scaled to fill its space (leaving 8 px around it) and centered. When the window changes size or the screen is rotated, the board is rescaled to fit. Empty tiles white with thin gray edges (one screen pixel wide at any scale); zeros slate gray with a gray "0"; numbered tiles colored by value, from pale yellow for 1 through orange, red, pink, purple and blue to green above 100, with the number on the tile (on a kite at its centroid, on a dart along its axis toward the tip) |
| Last move | Amber outline |
| Hover | The empty tile under the pointer is tinted blue and shows the number it would end up with: the value placed, or the result of its merges (including any chain reaction). The tiles those merges would clear get a blue outline. Occupied tiles show no preview |
| Status line | Before the first move, a one-line hint on how to play; then the last move's merges ("Merged 3 tiles into 3, then 3 tiles into 9"), or the result at the end of the game. Cut off with an ellipsis if too long |
| Preferences | A dialog over the board: one row of buttons per open question, the target choice under the target goal, and how to play. Escape, the ×, **Done** or a click outside closes it |

Pointer and touch both work: a tap or click places on the tile under it.

## 7. Known limitations

- No sound, animation or skins yet (Penrogo's skin system could be brought over).
- No high scores or saved games.
- Not yet tested on a physical touch device. On touch screens there is no hover, so the merge preview isn't seen before a move.
