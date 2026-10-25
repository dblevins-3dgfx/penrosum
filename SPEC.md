# Penrosum: Specification

Status: an experimental prototype. This describes the game as currently implemented (`Game` in `src/Game.tsx`, rules in `src/lib/rules.ts`, board in `src/lib/board.ts` and `penrose-board.ts`). Several rules are not decided yet; they are listed under [Open questions](#5-open-questions), and each option is playable from the **Rules to try** panel.

## 1. Overview

A merging number game on a Penrose tiling of kites and darts. The player places a number, usually 1, on an empty tile. When that makes a group of three or more tiles holding the same number, the tile just placed takes the sum of the group and the other tiles in it are cleared. Three 1s make a 3, three 3s make a 9, and so on.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript |
| Tests | Vitest (`npm test`), for everything in `src/lib` |
| Rendering | HTML5 Canvas 2D, 800 x 600 internal resolution, scaled to the page width |
| Styling | Tailwind CSS v4 utility classes |
| Persistence | The chosen rule options, in the browser's localStorage (`penrosum.options`). The game itself is in memory only |

## 3. Board

- **Tiling.** `penrose-board.ts` is Penrogo's board generator, unchanged: a patch of kites and darts made by subdividing a sun of five kites 7 times, so it is a correct Penrose tiling by construction (see Penrogo's spec, section 4).
- **Placement.** The patch is aligned to a kite (long edge 60 px) at the center of the 800 x 600 playfield, pointing up, and clipped to tiles lying fully inside it: about 220 tiles. The board is the same every game.
- **Adjacency.** Two tiles are neighbors when they share a full edge, so a tile has at most four neighbors. Tiles on the ragged edge of the board have fewer.

## 4. Rules

- **Tiles** are either empty or hold a number. Under the "zero" clearing option (open question 2) a tile can hold 0, which can't be played on and matches nothing.
- **A move** places the value for this move (open question 3) on any empty tile.
- **Group.** After placing, the group is the placed tile plus the tiles holding the same number that count as adjacent to it (open question 1). Tiles with a different number, zeros included, never join the group.
- **Merge.** If the group has 3 or more tiles (`MIN_GROUP`), the placed tile takes the sum of their numbers (the number times the group's size) and the other tiles in the group are cleared (open question 2). Otherwise nothing else changes. Whether the new number can merge again in the same move is open question 5.
- **End.** The game ends when no empty tile is left, or when the goal is reached (open question 4).
- **Undo** steps back one move at a time, as far as the start of the game. **New Game** clears the board. Changing a rule option takes effect from the next move and does not restart the game.

## 5. Open questions

Each option below is implemented and can be switched during play. The first one listed is the default.

### 1. Which tiles count as adjacent?

| Option | Behavior |
|---|---|
| Whole connected group (`connected`) | Every tile with the same number reachable from the placed tile through other tiles with that number. A long chain of matching tiles collapses all at once |
| Direct neighbors only (`neighbors`) | The placed tile and its direct neighbors with the same number (at most four). Tiles further along a chain are left alone, and the end of a chain does not merge with only one matching neighbor |

### 2. What do merged-away tiles become?

| Option | Behavior |
|---|---|
| Empty (`empty`) | Un-numbered: they can be played on again. Free space comes back after every merge, so the board may never fill up |
| Zero (`zero`) | They hold 0: they can't be played on, and they never match a placed number, so they block groups like walls. Every move uses up a tile for good, so the board fills up and the game always ends |

### 3. What value is placed?

| Option | Behavior |
|---|---|
| Always 1 (`ones`) | Every move places 1 |
| Random 1 to 3 (`random`) | Drawn at random, 1 with 70% chance, 2 with 20% and 3 with 10%, and shown in advance ("Next") |
| Player picks 1 to 3 (`choose`) | The player chooses 1, 2 or 3 before each move |

Still to think about: whether other values (bigger numbers, negatives, a "wild" tile) should exist, and whether the random weights are right.

### 4. What is the goal, and when does the game end?

| Option | Behavior |
|---|---|
| Highest tile (`highest`) | No target: the game ends when the board is full, and the result is the highest tile made |
| Reach a target (`target`) | Make a tile of at least the target (20, 50, 100 or 200) to win; filling the board first loses. The win reports how many moves it took, so fewer moves is better |

Still to think about: a scoring system (for example points per merge), a move limit, a time limit, and whether the game should push back somehow (for example new tiles appearing) when merged-away tiles become empty and the board can't fill up.

### 5. Chain reactions?

After a merge, the placed tile's new number may match tiles around it: three 1s make a 3 next to two other 3s.

| Option | Behavior |
|---|---|
| Off (`false`) | One merge per move. The new 3 stays beside the other 3s until the player places next to them |
| On (`true`) | The placed tile merges again whenever its new number makes a group, as many times as it can, so one move can make 3, then 9, then 27. Each merge at least triples the number, so a chain always ends |

## 6. Screen

| Element | Behavior |
|---|---|
| Header | Title, **Undo** (disabled with nothing to undo), **New Game** |
| Stats line | Moves, highest tile, free (empty) tiles; also the target under the target goal, and the next value under the random value rule |
| Value picker | Buttons 1, 2, 3, shown only under the "player picks" value rule |
| Board | Empty tiles light gray; zeros slate gray with a gray "0"; numbered tiles colored by value, from pale yellow for 1 through orange, red, pink, purple and blue to green above 100, with the number on the tile (on a kite at its centroid, on a dart along its axis toward the tip) |
| Last move | Amber outline |
| Hover | The empty tile under the pointer is tinted blue and shows the number it would end up with: the value placed, or the result of its merges (including any chain reaction). The tiles those merges would clear get a blue outline. Occupied tiles show no preview |
| Status line | The last move's merges ("Merged 3 tiles into 3, then 3 tiles into 9"), or the result at the end of the game |
| Rules to try | One row of buttons per open question, plus the target choice under the target goal |

Pointer and touch both work: a tap or click places on the tile under it.

## 7. Known limitations

- One fixed board; no choice of board size or shape.
- No sound, animation or skins yet (Penrogo's skin system could be brought over).
- No high scores or saved games.
- Not yet tested on a physical touch device. On touch screens there is no hover, so the merge preview isn't seen before a move.
