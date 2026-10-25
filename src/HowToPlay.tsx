import Dialog from './Dialog';
import { MIN_GROUP } from './lib/rules';

// How to play, in a dialog over the board. (While a rule is an open
// question in the spec, its options are offered here too; none are now.)
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
      <p className="text-slate-500">Hover a tile to see what would merge and where rubble lands.</p>
    </div>
  </Dialog>
);

export default HowToPlay;
