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
| Rendering | HTML5 Canvas 2D, sized to the board's square at the screen's pixel density |
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

- **Start.** Each new game seeds the board: 10% of its tiles (`SEED_FRACTION`, rounded), picked at random, get a random number from the values the deck deals (0 to 3, or 0, 1, 3 and 9, by Q11), each equally likely. Neighboring seeds never hold the same number, so no group exists before the first move; a picked tile whose neighbors already hold all four values is passed over for another. Seeded 0s can't be played on and match only a placed 0, so they act as obstacles; drawn 0s can merge them (see **Merge**). Seeded tiles look the same as placed ones. Undo goes back as far as the seeded board.
- **Tiles** are either empty or hold a number. A tile can hold 0 (a seed, or a placed 0), which can't be played on and matches only a placed 0.
- **Next value.** Each move's value is drawn at random from the deck before the move and shown in advance ("Next" in the panel): 0 10% of the time, then three numbers at 63%, 18% and 9% (7 : 2 : 1). The numbers are 1, 2 and 3 (`DECK`), or 1, 3 and 9 (`POW3_DECK`) under Q11's power-of-3 options. With wildcards (Q8) the deck can also deal a wildcard, shown as ★.
- **A move** places the next value on any empty tile.
- **Group.** After placing, the group is the placed tile plus every matching tile connected to it through other matching tiles (tiles are connected when they share an edge). So a long chain of matching tiles collapses all at once, even when the placed tile is at its end. Matching tiles hold the same number; shape doesn't matter, so kites and darts match each other. Tiles with a different number never join the group, and the group never passes through them; zeros join only a placed 0.
- **Merge.** If the group has 3 or more tiles (`MIN_GROUP`), the placed tile takes what the merge makes (Q11; by default the sum of their numbers, the number times the group's size) and the other tiles in the group become empty: they leave the board and can be played on again, so free space comes back after every merge. Otherwise nothing else changes. Zeros merge the same way: a 0 placed so that it connects to two or more zeros takes them into one 0 where it was placed, so zero obstacles can be consolidated, moved and reduced (three zeros become one).
- **Chain reaction.** After a merge, the placed tile's new number may match the tiles around it: three 1s make a 3 next to two other 3s. If its new number makes a group of 3 or more, it merges again, and keeps going as long as it can, so one move can make 3, then 9, then 27. Every merge empties at least two numbered tiles and numbers none, so a chain always ends.
- **Pressure.** After the move (and any chain reaction), the pressure rule may add zeros to the board (Q9).
- **End.** The game ends when no empty tile is left, or when the goal is reached (Q4), or, under Q11's power-of-3 options, when a Z (3 to the 25th) is made, which always wins.
- **Undo** steps back one move at a time, as far as the start of the game. **New Game** starts over on a new board of the size picked from its menu. Changing a rule option takes effect from the next move and does not restart the game.

## 5. Open questions

Each option below is implemented and can be switched during play, in the **Preferences** dialog. The first one listed is the default.

Every question has a permanent number, Q1, Q2 and so on, given in the order the questions were opened. A number never changes and is never reused, so it means the same question here, in **Resolved questions** (section 8), in the Preferences dialog, and in pull requests and commits. The next new question is **Q12**.

### Q4. What is the goal, and when does the game end?

| Option | Behavior |
|---|---|
| Highest tile (`highest`) | No target: the game ends when the board is full, and the result is the highest tile made |
| Reach a target (`target`) | Make a tile of at least the target (20, 50, 100 or 200) to win; filling the board first loses. The win reports how many moves it took, so fewer moves is better |

Still to think about: a scoring system (for example points per merge), a move limit, a time limit, and how the game should push back so the board fills up (Q9 tries some ways).

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

### Q10. How do the shapes matter?

Kites and darts match each other (Q6 decided that), but the two shapes can still matter in other ways (`ShapesRule`). The medium board, before seeding, has 60 kites and 43 darts; the kites mostly link into one large region, while the darts sit in small clusters (at most five-dart stars), so darts are the scarcer, more scattered spots.

| Option | Behavior |
|---|---|
| Off (`none`) | Shape changes nothing |
| Next value comes with a shape (`dealt`) | Each drawn value is dealt a shape too: a kite 60% of the time (`KITE_CHANCE`, about the board's own share), otherwise a dart. It must go on an empty tile of that shape; if none is left, any empty tile will do (`shapeToPlace`). The Next chip is drawn as a kite or dart, and empty tiles of the other shape are shaded gray |
| Merges on a dart double (`dartDouble`) | A merge into a dart (the placed tile is a dart) is worth double: three 1s make 6. Each merge of a chain reaction on a dart doubles again |
| Same-shape merges double (`sameBonus`) | A merge whose tiles are all one shape (all kites or all darts) is worth double. Mixed groups still merge, at face value |

Under Q11's "sum" option, the doubling options make numbers that aren't sums of the deck's values (6, 12, 36 ...), so groups can form from numbers that would otherwise never meet. Under its power-of-3 options, "double" means one power of 3 higher (x3) instead, so results stay powers of 3. The status line calls either a bonus. Still to think about: whether a doubled merge should be marked on the board, and the suns and stars idea (a merge completing five kites or five darts around a point does something special).

### Q11. What does a merge make?

Summing a group gives oddball values: four 1s make 4, a dealt 2 makes 6s and 18s, and Q10's doubling makes 12s and 36s, so numbers that could have grouped never meet. The power-of-3 options keep every number on one ladder, 1, 3, 9, 27, 81 ..., and deal from its bottom rungs (`mergeResult`, `valuesFor`).

| Option | A merge makes | Deals and seeds |
|---|---|---|
| The sum (`sum`) | The sum of the group: four 1s make 4, three 2s make 6 | 0, 1, 2, 3 |
| The sum, rounded down to a power of 3 (`cap`) | The sum, rounded down to the nearest power of 3 (`floorPow3`): three or four 1s make 3, five 3s (15) make 9, nine 1s make 9 | 0, 1, 3, 9 |
| The next power of 3 (`step`) | Three times the group's number, however many tiles merge: any group of 1s makes 3, of 3s makes 9 | 0, 1, 3, 9 |

Under both power-of-3 options a merge makes a power of 3 (or 0), and a Q10 bonus merge goes one power higher (x3). The deck keeps its shape: 0 10%, 1 63%, 3 18%, 9 9%. With "cap", a big group can jump more than one power (nine 1s make 9); with "step", group size never matters, so the only way up is one rung at a time. Switching mid-game changes the deck at once; the seeds follow from the next New Game, so numbers already on the board (2s, say) stay until then.

**Letters.** Under both power-of-3 options values are written as letters instead of numbers, one per rung of the ladder (`valueLabel` in `src/lib/labels.ts`): **#** for 0, then **A** for 1, **B** for 3, **C** for 9, **D** for 27, and so on to **Z** for 3 to the 25th (`TOP_VALUE`). Letters are used everywhere a value appears: on the tiles, in the Next chip, the hover preview, the stats ("Highest" and "Target") and the status line ("Merged 3 tiles into B"). A target goal is written as the first letter that reaches it (20 is D, 50 is E, 100 and 200 are F). A number that isn't a power of 3, left on the board from before switching rules, stays a number until the next New Game.

**Making Z wins.** Under the power-of-3 options, making a Z ends the game at once as a win, whatever the goal and however many tiles are free ("You made Z, the top of the alphabet, in N moves. You win!").

## 6. Screen

Everything fits on one screen with no scrolling. The board is square, so the screen is split into a square for the board and a panel in the space left over:

- **Wide screens** (landscape): the board fills the height on the left, and the panel takes the rest of the width on the right, at least 16 rem wide (the board's square shrinks if needed to leave that).
- **Tall screens** (portrait): the board fills the width at the top, and the panel takes the rest of the height below, at least 12 rem tall.

Rotating a phone moves the panel between the side and the bottom; the game carries on.

| Element | Behavior |
|---|---|
| Next chip | The next value, at the top of the panel beside the title, drawn as a rounded tile in the same colors that number has on the board (fill and number color, from `src/lib/colors.ts`, shared with the board drawing). A wildcard shows ★ on a rainbow gradient, a look no number has. When the value is dealt a shape (Q10), the chip is cut into a kite or a dart instead of a rounded square. Each newly drawn value pops in (a quick grow and settle, 0.25 s), except when the device asks for reduced motion |
| Panel | From the top: the title and the Next chip; the stats as small cards (moves, highest tile, free (empty) tiles, plus the target under the target goal); **Undo** (disabled with nothing to undo), **New Game ▾** and **Preferences**, wrapping onto more lines if the panel is narrow; then the status line |
| New Game menu | Small, Medium and Large, each with its tile count; the current board's size is highlighted. It opens below the button with the panel at the side, and above it with the panel at the bottom, so it stays on screen. Picking one starts a new game on that size and remembers it for next time. Escape or a click outside closes the menu without starting a game |
| Board | Scaled to fill its square (leaving 8 px around it) and centered. When the window changes size or the screen is rotated, the board is rescaled to fit. Empty tiles white with thin gray edges (one screen pixel wide at any scale), or light gray when the next value was dealt the other shape (Q10); zeros slate gray with a gray "0"; numbered tiles colored by value, from pale yellow for 1 through orange, red, pink, purple and blue to green above 100, with the number on the tile (on a kite at its centroid, on a dart along its axis toward the tip), written as a letter under Q11's power-of-3 options |
| Last move | Amber outline |
| Next spawn | Under the "a 0 every move" pressure rule, a dashed gray ring on the empty tile where the next 0 will appear |
| Hover | The empty tile under the pointer is tinted blue and shows the number it would end up with: the value placed, or the result of its merges (including any chain reaction). The tiles those merges would clear get a blue outline. Occupied tiles show no preview |
| Status line | Before the first move, a one-line hint on how to play (naming the dealt shape, if any); then what a wildcard became ("Wild played as 3.") the last move's merges ("Merged 3 tiles into 3, then 3 tiles into 9", with "(bonus on a dart)" or "(bonus: all one shape)" after a Q10 bonus merge) and any zeros the pressure rule added ("A 0 dropped."), or the result at the end of the game (including the Z win under Q11's power-of-3 options). Values are written as letters under those options. It wraps onto as many lines as it needs |
| Preferences | A dialog over the board: one row of buttons per open question, labeled with its number (Q4, Q8, Q9, Q10, Q11), the target choice under the target goal, and how to play. Escape, the ×, **Done** or a click outside closes it |

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
| Q6 | 2026-10-25 | Which tiles can match? | Any shape; Same shape only | **Any shape** | Kites and darts with the same number match each other (Rules: **Group**). Reason: same-shape matching makes use of the two kinds of tile, but the game was more fun without it; other ways to use the shapes are being tried in Q10 | [#14](https://github.com/dblevins-3dgfx/penrosum/pull/14) |
