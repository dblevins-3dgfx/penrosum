import { useId } from 'react';
import Dialog from './Dialog';
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

interface PreferencesProps {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  onClose: () => void;
}

// The player's preferences, in a dialog over the board. A change applies at
// once and is remembered in this browser; the game carries on.
const Preferences = ({ prefs, setPref, onClose }: PreferencesProps) => (
  <Dialog title="Preferences" onClose={onClose}>
    <Toggle
      label="Tap to preview"
      hint="On a touch screen, the first tap on a tile shows what the move would do; tap it again to place. A mouse always places with one click."
      on={prefs.tap === 'preview'}
      onChange={on => setPref('tap', on ? 'preview' : 'place')}
    />
    <p className="mt-2 text-xs text-slate-500">Kept in this browser.</p>
  </Dialog>
);

export default Preferences;
