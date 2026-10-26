import Dialog from './Dialog';
import { CLEAR_MAX, MIN_GROUP, UNDO_MAX, UNDO_START, type Options } from './lib/rules';

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}

const Choice = <T extends string>({ label, value, options, onChange }: ChoiceProps<T>) => (
  <fieldset className="mb-3">
    <legend className="text-sm font-semibold text-slate-700 mb-1">{label}</legend>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={`px-2 py-1 rounded text-sm border ${
            v === value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  </fieldset>
);

interface HowToPlayProps {
  options: Options;
  setOption: <K extends keyof Options>(key: K, value: Options[K]) => void;
  onClose: () => void;
}

// How to play, in a dialog over the board, with the rules still being
// tried (the open questions in the spec) as buttons.
const HowToPlay = ({ options, setOption, onClose }: HowToPlayProps) => (
  <Dialog title="How to play" onClose={onClose}>
    <div className="mb-4 rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500 mb-2">
        Rules to try: the open questions in the spec. Changes apply at once; the game carries on.
      </p>
      <Choice
        label="Q15. On a touch screen, what does a tap do?"
        value={options.tap}
        options={[['place', 'Place at once'], ['preview', 'Preview, tap again to place']]}
        onChange={v => setOption('tap', v)}
      />
    </div>
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
      <p className="text-slate-500">
        Hover a tile (or, with Q15's preview, tap it once) to see what would merge and where rubble lands.
      </p>
    </div>
  </Dialog>
);

export default HowToPlay;
