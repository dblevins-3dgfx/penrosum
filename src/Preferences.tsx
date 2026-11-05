import { useId } from 'react';
import Dialog from './Dialog';
import { SKIN_IDS } from './lib/skins';
import { pieceName, skinAllowed, termsFor, topValue } from './lib/skin';
import { EMOJI_FONTS, skinFor } from './emoji';
import type { Prefs } from './lib/prefs';

interface ToggleProps {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}

// An on/off switch with a label and a line saying what it does.
const Toggle = ({ label, hint, on, onChange }: ToggleProps) => {
  const hintId = useId();
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mr-auto">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <p id={hintId} className="text-xs text-slate-500">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-describedby={hintId}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
};

// The skin picker: a button per skin, the one in use marked, each with
// its name, its first four pieces on their own fills and its rubble, a
// line on what it is, and how far its ladder goes. A skin whose top isn't
// above the game's highest tile (`highest`, named `highestName`) can't be
// picked until the next game, and says why (skinAllowed).
const SkinChoice = ({ skin, highest, highestName, onChange }: {
  skin: Prefs['skin']; highest: number; highestName: string; onChange: (skin: Prefs['skin']) => void;
}) => (
  <fieldset className="py-2">
    <legend className="text-sm font-semibold text-slate-700">Skin</legend>
    <p className="text-xs text-slate-500 mb-2">The ladder the tiles climb. The rules are the same in every skin.</p>
    <div className="flex flex-col gap-2">
      {SKIN_IDS.map(id => {
        const shown = skinFor(id);
        const { name, description, pieces, rubble, pictures, palette } = shown;
        const top = pieceName(termsFor(shown), topValue(shown));
        const blocked = id !== skin && !skinAllowed(shown, highest);
        const swatch = [
          ...pieces.slice(0, 4).map((p, i) => ({ glyph: p.glyph, fill: palette.rungFills[i], text: palette.rungTexts[i] })),
          { glyph: rubble.glyph, fill: palette.zeroFill, text: palette.zeroText },
        ];
        return (
          <button key={id} onClick={() => onChange(id)} aria-pressed={skin === id} disabled={blocked}
            className={`flex items-center gap-3 rounded-md border px-3 py-1.5 text-left text-sm disabled:opacity-60 ${
              skin === id ? 'border-indigo-600 ring-2 ring-indigo-600/40' : 'border-slate-300'
            }`}>
            <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-sm border" style={{ borderColor: palette.tileEdge }}>
              {swatch.map((c, i) => (
                <span key={i} className={`flex h-7 w-7 items-center justify-center ${pictures ? 'text-base' : 'text-sm font-bold'} ${
                  i === swatch.length - 1 ? 'ml-1' : ''
                }`} style={{ background: c.fill, color: c.text, fontFamily: pictures ? EMOJI_FONTS : undefined }}>
                  {c.glyph}
                </span>
              ))}
            </span>
            <span>
              <span className={skin === id ? 'font-semibold' : ''}>{name}</span>
              <span className="block text-xs text-slate-500">{description} {pieces.length} rungs, up to {top}.</span>
              {blocked && (
                <span className="block text-xs font-medium text-amber-700">
                  Your {highestName} is past its top: pick it in your next game.
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  </fieldset>
);

interface PreferencesProps {
  prefs: Prefs;
  highest: number; // the game's highest tile, and its piece's name in the skin in use
  highestName: string;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  onClose: () => void;
}

// The player's preferences, in a dialog over the board. A change applies at
// once and is remembered in this browser; the game carries on.
const Preferences = ({ prefs, highest, highestName, setPref, onClose }: PreferencesProps) => (
  <Dialog title="Preferences" onClose={onClose}>
    <Toggle
      label="Tap to preview"
      hint="On a touch screen, the first tap on a tile shows what the move would do; tap it again to place. A mouse always places with one click."
      on={prefs.tap === 'preview'}
      onChange={on => setPref('tap', on ? 'preview' : 'place')}
    />
    <SkinChoice skin={prefs.skin} highest={highest} highestName={highestName} onChange={skin => setPref('skin', skin)} />
    <p className="mt-2 text-xs text-slate-500">Kept in this browser.</p>
  </Dialog>
);

export default Preferences;
