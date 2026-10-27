import Dialog from './Dialog';
import { ANY_SHAPE_MAX, BIG_MERGE, CLEAR_MAX, SWAP_MAX, SWAP_SCORE_STEP, SWEEP_MAX, UNDO_MAX, UNDO_START, UPGRADE_MAX } from './lib/powerups';
import { MIN_GROUP } from './lib/rules';

// How to play, in a dialog over the board. (When a rule is an open
// question in the spec, its options go at the top as buttons to try; none
// is open now.)
const HowToPlay = ({ onClose }: { onClose: () => void }) => (
  <Dialog title="How to play" onClose={onClose}>
    <div className="text-sm text-slate-700 space-y-2">
      <p>
        Place the Next letter (beside the title) on an empty tile of the shape it comes with, a kite
        or a dart, more often the shape with more empty tiles left (once one shape's tiles are all full,
        you're only dealt the other). When it makes a group of{' '}
        {MIN_GROUP} or more tiles with the same letter, they merge into the tile you placed, one rung
        up the alphabet (three As make a B; nine make a C). If the new letter then makes a group too,
        it merges again.
      </p>
      <p>
        A merge of exactly {MIN_GROUP} leaves rubble, a #, on its farthest cleared tile; bigger merges
        leave none. # tiles are obstacles that only a placed # or rubble merges away. A ★ is a
        wildcard: it becomes whichever letter does best where you place it.
      </p>
      <p>
        A merge scores its new letter's rung (its place in the alphabet: A 1, B 2 …) times the tiles
        merged, times 2, 3 … for later merges in a chain. The game ends when the board is full; make
        the top 10 on your board size. Making a Z wins outright.
      </p>
      <p>
        Tap <b>Spare ⇄</b> to keep the next value for later (a new one is dealt); after that, tap it
        any time to swap the next value with the spare. <b>Undo</b> is a power-up: you start with{' '}
        {UNDO_START} and earn one each time you make a new highest letter (up to {UNDO_MAX}).{' '}
        <b>Clear</b> is a power-up too: a chain reaction (two or more merges in one move) earns one
        (up to {CLEAR_MAX}); tap <b>Clear</b>, then a letter or #, to empty that tile.
      </p>
      <p>
        Suns (five kites meeting at their tips) and stars (five darts) are marked by a small ring
        where the tips meet. Fill all five tiles of one (with anything) to complete it: the ring turns
        gold and earns <b>Any shape</b>, one for a sun, two for a star (up to {ANY_SHAPE_MAX}). Tap{' '}
        <b>Shape</b> to place the next value on a kite or a dart, whichever it was dealt.
      </p>
      <p>
        A merge of {BIG_MERGE} or more tiles earns an <b>Upgrade</b> (up to {UPGRADE_MAX}): tap{' '}
        <b>Upgrade</b>, then a letter, to raise it a rung. If it then matches its neighbors, it
        merges, chain reactions and all.
      </p>
      <p>
        Each rubble merge (rubble landing and merging #s) earns a <b>Sweep</b> (up to {SWEEP_MAX}):
        tap <b>Sweep</b>, then a tile, to clear every # on it and the tiles touching it.
      </p>
      <p>
        Every {SWAP_SCORE_STEP} points earns a <b>Swap</b> (up to {SWAP_MAX}): tap <b>Swap</b>, then two
        tiles of the same shape, to exchange what they hold. Each then merges if it matches its new
        neighbors. To swap a kite with a dart, arm <b>Shape</b> too: the swap then spends an Any shape as well.
      </p>
      <p className="text-slate-500">
        Hover a tile (or, with <b>Tap to preview</b> on in ⚙ Preferences, tap it once) to see what would merge and where rubble lands.
      </p>
    </div>
  </Dialog>
);

export default HowToPlay;
