import { useState } from 'react';
import Dialog from './Dialog';
import { BOARD_SIZES, type BoardSize } from './lib/board';
import { valueLabel } from './lib/labels';
import type { Scoreboards } from './lib/scores';

interface ScoreboardProps {
  scores: Scoreboards;
  size: BoardSize; // the board size shown first
  latest: { size: BoardSize; rank: number } | null; // the game just added, highlighted
  onClose: () => void;
}

// The top 10 games on each board size, in a dialog over the board.
const Scoreboard = ({ scores, size, latest, onClose }: ScoreboardProps) => {
  const [shown, setShown] = useState(size);
  const list = scores[shown];
  return (
    <Dialog title="Top 10" onClose={onClose}>
      <div role="tablist" className="flex gap-1 mb-3">
        {BOARD_SIZES.map(s => (
          <button key={s.id} role="tab" aria-selected={s.id === shown} onClick={() => setShown(s.id)}
            className={`px-2 py-1 rounded text-sm border ${
              s.id === shown
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}>
            {s.name}
          </button>
        ))}
      </div>
      {list.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2 text-right">Score</th>
              <th className="py-1 pr-2 text-center">Highest</th>
              <th className="py-1 pr-2 text-right">Moves</th>
              <th className="py-1">Date</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={i} className={`border-t border-slate-100 ${
                latest?.size === shown && latest.rank === i + 1 ? 'bg-amber-100 font-semibold' : ''
              }`}>
                <td className="py-1 pr-2 text-slate-500">{i + 1}</td>
                <td className="py-1 pr-2 text-right font-bold">{e.score}</td>
                <td className="py-1 pr-2 text-center">{valueLabel(e.highest)}{e.won ? ' 🏆' : ''}</td>
                <td className="py-1 pr-2 text-right">{e.moves}</td>
                <td className="py-1 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-500">No finished games on this board yet.</p>
      )}
      <p className="text-xs text-slate-500 mt-3">Kept in this browser.</p>
    </Dialog>
  );
};

export default Scoreboard;
