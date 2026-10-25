# Penrosum: Specification

Status: an experimental prototype. This describes the game as currently implemented (`Game` in `src/Game.tsx`, the How to play and Top 10 dialogs in `src/HowToPlay.tsx` and `src/Scoreboard.tsx`, rules in `src/lib/rules.ts`, the top 10 in `src/lib/scores.ts`, how values are written in `src/lib/labels.ts`, board in `src/lib/board.ts` and `penrose-board.ts`, fitting it to the screen in `src/lib/view.ts`, saved choices in `src/lib/prefs.ts`). No rule is an open question right now (see [Open questions](#5-open-questions)). Questions already decided are recorded under [Resolved questions](#8-resolved-questions).

## 1. Overview

A merging game on a Penrose tiling of kites and darts. Values climb a ladder of powers of 3, written as letters: **#** for 0, then **A** (1), **B** (3), **C** (9), **D** (27) and on up to **Z**. The player places the next value, dealt at random with a shape and shown in advance, on an empty tile of that shape. When that makes a group of three or more matching tiles, they merge into the tile just placed, which climbs the ladder: three As make a B, three Bs make a C, and a big enough group can jump further (nine As make a C). A merge of exactly three leaves a # of rubble behind. Merges score points; the game ends when the board is full, and the best scores on each board size make a top 10. Making a Z wins outright. Each game starts with a few values already scattered on the board.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript |
| Tests | Vitest (`npm test`), for everything in `src/lib` |
| Rendering | HTML5 Canvas 2D, sized to the board's square at the screen's pixel density |
| Styling | Tailwind CSS v4 utility classes |
| Persistence | The board size (`penrosum.boardSize`) and the top 10 for each board size (`penrosum.scores`), in the browser's localStorage. A missing or unrecognized saved value falls back to its default, and a damaged or nonsensical top 10 entry is dropped (`parseScores`). The game in progress is in memory only. Rule options saved by earlier versions (`penrosum.options`) are no longer read |

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

- **Values.** Every value is a power of 3, or 0: 0, 1, 3, 9, 27 ... up to 3 to the 25th. Each is written as a letter (`valueLabel` in `src/lib/labels.ts`): **#** for 0, then **A** for 1, **B** for 3, **C** for 9, **D** for 27 and so on to **Z** for 3 to the 25th (`TOP_VALUE`). Letters are used everywhere a value appears: on the tiles, in the Next chip, the hover preview, the stats and the status line ("Merged 3 tiles into B").
- **Start.** Each new game seeds the board: 10% of its tiles (`SEED_FRACTION`, rounded), picked at random, get a random value from the ones the deck deals, #, A, B or C (`SEED_VALUES`), each equally likely. Neighboring seeds never hold the same value, so no group exists before the first move; a picked tile whose neighbors already hold all four values is passed over for another. Seeded #s can't be played on and match only a placed #, so they act as obstacles; dealt #s can merge them (see **Merge**). Seeded tiles look the same as placed ones. Undo goes back as far as the seeded board.
- **Tiles** are either empty or hold a value. A tile can hold # (a seed, or a placed #), which can't be played on and matches only a placed #.
- **Next value.** Each move's value is drawn at random from the deck (`DECK`) before the move and shown in advance ("Next" in the panel). A draw is a wildcard, shown as ★, 5% of the time (`WILD_CHANCE`); otherwise it is a number (`NUMBERS`): # 10% of the time, A 63%, B 18% and C 9% (A, B and C at 7 : 2 : 1).
- **Wildcard.** A ★ is placed like a number and becomes whichever value does best there (`resolveWild`). It tries each value held by a neighbor, plays out the move with it (chain reactions included), and keeps the one that merges rather than not; among merges, the one leaving the highest value; then the one clearing the most tiles. If no neighbor's value would merge, it is placed as an A. So a wildcard can complete any group, including values higher than the deck ever deals (two Ds and a wildcard make an E). The status line says what it became ("Wild played as B."), and the hover preview shows the result before the move.
- **Shape.** Each value is dealt with a shape too (`dealShape`), on the board it will be played on: a kite 60% of the time (`KITE_CHANCE`, about the board's own share), otherwise a dart. Only a shape that still has an empty tile is dealt, so once one shape's empty tiles are all filled, every value comes with the other. The medium board, before seeding, has 60 kites and 43 darts; the kites mostly link into one large region, while the darts sit in small clusters (at most five-dart stars), so darts are the scarcer, more scattered spots.
- **A move** places the next value on an empty tile of its shape (`canPlaceDealt`). As a safeguard, if no empty tile of that shape were left, any empty tile would do (`shapeToPlace`); the deal above never lets that happen.
- **Group.** After placing, the group is the placed tile plus every matching tile connected to it through other matching tiles (tiles are connected when they share an edge). So a long chain of matching tiles collapses all at once, even when the placed tile is at its end. Matching tiles hold the same value; shape doesn't matter, so kites and darts match each other. Tiles with a different value never join the group, and the group never passes through them; #s join only a placed #.
- **Merge.** If the group has 3 or more tiles (`MIN_GROUP`), the placed tile takes the sum of their values **rounded down to a power of 3** (`mergeResult`, `floorPow3`), and the other tiles in the group become empty: they leave the board and can be played on again, so free space comes back after every merge. Three or four As make a B (3 or 4, rounded down to 3), five Bs make a C (15 to 9), and nine As make a C, so a big enough group can climb more than one rung; whatever doesn't make a full rung is lost. Shape never changes what a merge makes. Otherwise nothing else changes. #s merge the same way: a # placed so that it connects to two or more #s takes them into one # where it was placed, so # obstacles can be consolidated, moved and reduced (three #s become one).
- **Chain reaction.** After a merge, the placed tile's new value may match the tiles around it: three As make a B next to two other Bs. If its new value makes a group of 3 or more, it merges again, and keeps going as long as it can, so one move can make B, then C, then D. Every merge empties at least two tiles and fills none, so a chain always ends.
- **Rubble.** Merged-away tiles become empty, so without something pushing back a careful player could keep space free for ever. After the move (and any chain reaction), each merge of exactly 3 tiles leaves a # (rubble) on its cleared tile farthest from the placed one (`dropRubble`). Bigger merges leave none, so it pays to build bigger groups, and a merge of #s never leaves rubble, so cleaning up #s never makes more. Rubble comes from the player's move, so it merges like a placed #: rubble that lands touching two or more connected #s takes them into one # on its own tile (each rubble in turn, after the chain reaction). A rubble merge scores 1 per tile, with no chain bonus (see **Score**). The hover preview shows where the move's rubble would land and the #s it would merge, so rubble can be aimed at #s to tidy them up.
- **End.** The goal is to use up the board: the game ends when no empty tile is left (`outcome`), and the result is the score ("Board full. Score: 229 (highest tile D, 89 moves)."). Making a **Z** ends the game at once as a win, however many tiles are free ("You made Z, the top of the alphabet, in N moves. You win! Score: 900.").
- **Score.** Merges earn points, added up in the **Score** shown in the panel during play. A merge scores the **rung** it makes, the letter's place in the alphabet (`rungOf`: A 1, B 2, C 3 ... Z 26), times the tiles merged (`mergePoints`): three As make a B for 2 × 3 = 6, five Cs make a D for 4 × 5 = 20. Rungs climb in even steps, so the score grows steadily rather than threefold like the values. **Chain bonus:** each merge of a chain reaction scores times its place in the chain, the first ×1, the second ×2, the third ×3 (`scoreMerges`), so a move that makes a B from three As and then a C from three Bs scores 6 + 9 × 2 = 24. A merge of #s scores 1 per tile, so clearing obstacles is worth something; a rubble merge scores the same, with no chain bonus (`scoreRubble`). Wildcards need nothing extra: they make a higher rung, which scores more. Only merges score. Undo takes back a move's points with the move.
- **Top 10.** Each board size keeps its own top 10 (`TOP_SCORES`), since a bigger board allows bigger scores. When a game ends, it is added to its size's list if it makes the top 10 (`addScore`): a higher score ranks higher, and on a tie the game that ended first stays ahead, so a tie with 10th place doesn't make it. An entry records the score, the highest tile, the moves, the date, and whether the game was won with a Z. Each game is recorded once, the first time it ends: Undo can reopen a finished game, but finishing it again doesn't add another entry. The lists are kept in this browser only.
- **Undo** steps back one move at a time, as far as the start of the game, including after the game ends. **New Game** starts over on a new board of the size picked from its menu.

## 5. Open questions

None right now. When a rule is undecided, each of its options is implemented, listed here with the first one as the default, and can be switched during play from the **How to play** dialog.

Every question has a permanent number, Q1, Q2 and so on, given in the order the questions were opened. A number never changes and is never reused, so it means the same question here, in **Resolved questions** (section 8), in the game, and in pull requests and commits. The next new question is **Q13**.

Still to think about: a move limit and a time limit.

## 6. Screen

Everything fits on one screen with no scrolling. The board is square, so the screen is split into a square for the board and a panel in the space left over:

- **Wide screens** (landscape): the board fills the height on the left, and the panel takes the rest of the width on the right, at least 16 rem wide (the board's square shrinks if needed to leave that).
- **Tall screens** (portrait): the board fills the width at the top, and the panel takes the rest of the height below, at least 12 rem tall.

Rotating a phone moves the panel between the side and the bottom; the game carries on.

| Element | Behavior |
|---|---|
| Next chip | The next value, at the top of the panel beside the title, drawn as a rounded tile with its letter, in the same colors that value has on the board (fill and number color, from `src/lib/colors.ts`, shared with the board drawing). A wildcard shows ★ on a rainbow gradient, a look no number has. The chip is cut into a kite or a dart, the shape the value was dealt. Each newly drawn value pops in (a quick grow and settle, 0.25 s), except when the device asks for reduced motion |
| Panel | From the top: the title and the Next chip; the stats as small cards (the score, moves, highest tile, free (empty) tiles); **Undo** (disabled with nothing to undo), **New Game ▾**, **Top 10** and **How to play**, wrapping onto more lines if the panel is narrow; then the status line |
| New Game menu | Small, Medium and Large, each with its tile count; the current board's size is highlighted. It opens below the button with the panel at the side, and above it with the panel at the bottom, so it stays on screen. Picking one starts a new game on that size and remembers it for next time. Escape or a click outside closes the menu without starting a game |
| Board | Scaled to fill its square (leaving 8 px around it) and centered. When the window changes size or the screen is rotated, the board is rescaled to fit. Empty tiles white with thin gray edges (one screen pixel wide at any scale), or light gray when they are the shape the next value wasn't dealt; #s slate gray with a gray "#"; lettered tiles colored by value, from pale yellow for A through yellow (B), red (C), purple (D) and blue (E) to green from F up, with the letter on the tile (on a kite at its centroid, on a dart along its axis toward the tip) |
| Last move | Amber outline |
| Hover | The empty tile under the pointer is tinted blue and shows the value it would end up with: the value placed, or the result of its merges (including any chain reaction). The tiles those merges would clear get a blue outline. The tiles where the move's rubble would land show a gray # with a blue outline, and the #s that rubble would merge are outlined too. Occupied tiles show no preview |
| Status line | Before the first move, a one-line hint on how to play (naming the dealt shape); then what a wildcard became ("Wild played as B.") the last move's merges and the points they scored ("Merged 3 tiles into B, then 3 tiles into C (+24).") any rubble dropped ("Rubble dropped a #.") and any rubble merges ("Rubble merged 3 #s into one (+3)."), or the result at the end of the game, with the score (see Rules: **End**) and, if the game made the top 10, its place ("#3 on the medium board!"). It wraps onto as many lines as it needs |
| Top 10 | A dialog over the board, opened by **Top 10** and opened by itself when a game ends. A button for each board size (Small, Medium, Large) switches between their lists, starting on the current board's size. Each row shows the place, score, highest tile (with 🏆 for a Z win), moves and date; the game that just ended, if it made the list, is highlighted. An empty list says no game on that board has finished yet. A note says the lists are kept in this browser |
| How to play | A dialog over the board: how to play, in a few short paragraphs. While a rule is an open question, its options appear here too, one row of buttons per question labeled with its number (none now) |
| Dialogs | Escape, the ×, **Done** or a click outside closes a dialog |

Pointer and touch both work: a tap or click places on the tile under it.

## 7. Known limitations

- No sound, animation or skins yet (Penrogo's skin system could be brought over).
- No saved games. The top 10 lives in one browser only, with no names and no sharing between devices.
- Ideas not yet tried: how often wildcards should come up; letting the player choose what a wildcard becomes instead of it choosing the best; other special values.
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
| Q11 | 2026-10-25 | What does a merge make? | The sum (deals 0–3); the sum rounded down to a power of 3 (deals 0, 1, 3, 9); the next power of 3 (deals 0, 1, 3, 9) | **The sum, rounded down to a power of 3** | Every value is a power of 3, written as a letter, # and A to Z, and making Z wins (Rules: **Values**, **Merge**, **End**). The deck and seeds are #, A, B, C; Q10 bonus merges go one rung higher; Q4's targets became the rungs D to G. Reason: summing made oddball values that rarely met again; rounding down keeps one ladder while still rewarding big groups (a big enough group climbs more than one rung), where "next power of 3" ignores group size | [#19](https://github.com/dblevins-3dgfx/penrosum/pull/19) |
| Q9 | 2026-10-25 | Pressure: what adds #s so the board fills up? | Off; a random # after each merge; a # every move, ringed a move ahead; rubble from 3-tile merges | **Rubble from 3-tile merges** | Each 3-tile merge leaves a # on its farthest cleared tile, and that rubble merges with the #s it touches like a placed # (Rules: **Rubble**). The other options and the spawn ring were removed; the preview always shows where rubble lands. | [#22](https://github.com/dblevins-3dgfx/penrosum/pull/22) |
| Q10 | 2026-10-25 | How do the shapes matter? | Off; next value comes with a shape; a bonus rung for merges on a dart; a bonus rung for same-shape merges | **Next value comes with a shape** | Every value is dealt a kite or a dart and goes on an empty tile of that shape, or any empty tile when none of it is left (Rules: **Shape**, **A move**). The bonus-rung options were removed, so shape never changes what a merge makes | [#22](https://github.com/dblevins-3dgfx/penrosum/pull/22) |
| Q8 | 2026-10-25 | Wildcards in the deck? | No; Yes (a wildcard on 5% of draws) | **Yes** | The deck deals a ★ 5% of the time, which becomes whichever value does best where it is placed (Rules: **Next value**, **Wildcard**) | [#23](https://github.com/dblevins-3dgfx/penrosum/pull/23) |
| Q12 | 2026-10-25 | What does a merge score? | Rung × tiles merged; rung made; tiles merged; rung + 1 per extra tile; each with or without a chain bonus | **Rung × tiles merged, with the chain bonus** | A merge scores its rung times its tiles, ×2, ×3 … for later merges in a chain; #s and rubble merges score 1 per tile (Rules: **Score**). The other scoring options and the chain bonus switch were removed. Raised by issue [#17](https://github.com/dblevins-3dgfx/penrosum/issues/17) | [#23](https://github.com/dblevins-3dgfx/penrosum/pull/23) |
| Q4 | 2026-10-25 | What is the goal, and when does the game end? | Highest tile (play until the board is full); reach a target (D, E, F or G) | **Use up the board** | The game ends when no empty tile is left, and the result is the score; a Z still wins outright (Rules: **End**). The target goal, its choices and the Target card were removed. Added a top 10 of scores for each board size (Rules: **Top 10**). With no open questions left, the Preferences dialog became **How to play** | [#24](https://github.com/dblevins-3dgfx/penrosum/pull/24) |
