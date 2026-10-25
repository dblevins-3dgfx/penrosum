import { useEffect } from 'react';
import { MIN_GROUP, TARGET_OPTIONS, type Options } from './lib/rules';
import { targetLabel } from './lib/labels';

interface ChoiceProps<T extends string | number> {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}

const Choice = <T extends string | number>({ label, value, options, onChange }: ChoiceProps<T>) => (
  <fieldset className="mb-3">
    <legend className="text-sm font-semibold text-slate-700 mb-1">{label}</legend>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
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

interface PreferencesProps {
  options: Options;
  setOption: <K extends keyof Options>(key: K, value: Options[K]) => void;
  onClose: () => void;
}

// The rules still being evaluated (SPEC.md, "Open questions"), in a dialog
// over the board. Escape, the backdrop, or Done closes it.
const Preferences = ({ options, setOption, onClose }: PreferencesProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prefs-title"
        className="w-full max-w-md max-h-full overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start mb-1">
          <h2 id="prefs-title" className="text-lg font-bold mr-auto">Preferences</h2>
          <button onClick={onClose} aria-label="Close" className="px-2 text-xl leading-none text-slate-500 hover:text-slate-900">
            ×
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Rules to try: these are the open questions in the spec. Changes apply from the next move.
        </p>
        <Choice
          label="Q4. Goal"
          value={options.goal}
          options={[['highest', 'Highest tile'], ['target', 'Reach a target']]}
          onChange={v => setOption('goal', v)}
        />
        {options.goal === 'target' && (
          <Choice
            label="Target"
            value={options.target}
            options={TARGET_OPTIONS.map(t => [t, targetLabel(t)] as [number, string])}
            onChange={v => setOption('target', v)}
          />
        )}
        <p className="text-xs text-slate-500 mt-2">
          How to play: place the Next letter (beside the title) on an empty tile of the shape it
          comes with, a kite or a dart (any empty tile once none of that shape is left). When it makes
          a group of {MIN_GROUP} or more tiles with the same letter, they merge into the tile you
          placed, one rung up the alphabet (three As make a B; nine make a C). If the new letter then
          makes a group too, it merges again. A merge of exactly {MIN_GROUP} leaves rubble, a #, on its
          farthest cleared tile; bigger merges leave none. # tiles are obstacles that only a placed #
          or rubble merges away. A ★ is a wildcard: it becomes whichever letter does best where you
          place it. A merge scores its new letter's rung (its place in the alphabet: A 1, B 2 …) times
          the tiles merged, times 2, 3 … for later merges in a chain. Make a Z to win. Hover a tile to
          see what would merge and where rubble lands.
        </p>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm">Done</button>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
