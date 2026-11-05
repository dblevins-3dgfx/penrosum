import Dialog from './Dialog';
import { ANY_SHAPE_MAX, BIG_MERGE, CLEAR_MAX, SWAP_MAX, SWAP_SCORE_STEP, SWEEP_MAX, UNDO_MAX, UNDO_START, UPGRADE_MAX } from './lib/powerups';
import { MIN_GROUP, type RuleOptions } from './lib/rules';
import { LETTERS } from './lib/labels';
import { type Skin, isAlphabet, withArticle } from './lib/skin';
import { EMOJI_FONTS } from './emoji';

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}

// A rule still being tried: a row of buttons, one per option
const Choice = <T extends string>({ label, value, options, onChange }: ChoiceProps<T>) => (
  <fieldset className="mb-1">
    <legend className="text-sm font-semibold text-slate-700 mb-1">{label}</legend>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={v === value}
          className={`px-2 py-1 rounded text-sm border ${
            v === value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}>
          {text}
        </button>
      ))}
    </div>
  </fieldset>
);

// The skin's ladder, bottom rung to top, each piece on its own fill (its
// name and rung as a tooltip), then its rubble. A skin whose pieces aren't
// the letters themselves shows each piece's letter under it, since the
// rules below are told in letters.
const Ladder = ({ skin }: { skin: Skin }) => {
  const { palette, pictures } = skin;
  const cell = 'flex h-7 w-7 items-center justify-center rounded-sm';
  const font = pictures ? { fontFamily: EMOJI_FONTS } : {};
  const keyed = !isAlphabet(skin);
  return (
    <figure>
      <figcaption className="mb-1 text-xs text-slate-500">
        {skin.name}: {keyed
          ? `the rules below are told in letters; each letter is drawn as ${withArticle(skin.piece)}, and rubble (#) as ${skin.rubble.glyph}.`
          : 'the ladder, A to Z, and rubble.'}
      </figcaption>
      <ol aria-label={`The ${skin.name} ladder`} className="flex flex-wrap gap-0.5">
        {skin.pieces.map((p, i) => (
          <li key={i} title={`${p.name === p.glyph ? p.glyph : `${p.glyph} ${p.name}`}, ${i + 1} of ${skin.pieces.length}`}
            className="flex flex-col items-center">
            <span className={`${cell} ${pictures ? 'text-base' : 'text-xs font-bold'}`}
              style={{ background: palette.rungFills[i], color: palette.rungTexts[i], ...font }}>{p.glyph}</span>
            {keyed && <span className="text-[9px] leading-tight text-slate-500">{LETTERS[i]}</span>}
          </li>
        ))}
        <li title={`${skin.rubble.glyph === skin.rubble.name ? skin.rubble.glyph : `${skin.rubble.glyph} ${skin.rubble.name}`}, rubble`}
          className="ml-1.5 flex flex-col items-center">
          <span className={`${cell} ${pictures ? 'text-base' : 'text-xs font-bold'}`}
            style={{ background: palette.zeroFill, color: palette.zeroText, ...font }}>{skin.rubble.glyph}</span>
          {keyed && <span className="text-[9px] leading-tight text-slate-500">#</span>}
        </li>
      </ol>
    </figure>
  );
};

interface HowToPlayProps {
  skin: Skin;
  rules: RuleOptions;
  setRule: <K extends keyof RuleOptions>(key: K, value: RuleOptions[K]) => void;
  onClose: () => void;
}

// How to play, in a dialog over the board, with the rules still being
// tried (the open questions in the spec, now Q17) as buttons at the top.
const HowToPlay = ({ skin, rules, setRule, onClose }: HowToPlayProps) => (
  <Dialog title="How to play" onClose={onClose}>
    <div className="mb-4 rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500 mb-2">
        Rules to try: the open questions in the spec. Changes apply at once; the game carries on.
      </p>
      <Choice
        label="Q17. How do you choose what a wildcard (★) plays as?"
        value={rules.wild}
        options={[['auto', 'It chooses the best'], ['tile', 'Pick on the tile'], ['before', 'Pick from Next first']]}
        onChange={v => setRule('wild', v)}
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
      <Ladder skin={skin} />
      <p>
        A merge of exactly {MIN_GROUP} leaves rubble, a #, on its farthest cleared tile; bigger merges
        leave none. # tiles are obstacles that only a placed # or rubble merges away. A ★ is a
        wildcard: it becomes whichever letter does best where you place it, or, with Q17's other options,
        the letter you pick: on the tile you tap, or from the ★ in Next before you place it.
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
