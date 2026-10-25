import { describe, expect, it } from 'vitest';
import { TOP_SCORES, addScore, emptyScoreboards, parseScores, type ScoreEntry } from './scores';

const entry = (score: number, date = '2026-10-25T12:00:00.000Z'): ScoreEntry =>
  ({ score, highest: 27, moves: 50, date, won: false });

describe('addScore', () => {
  it('keeps the best first and reports the place', () => {
    let list: ScoreEntry[] = [];
    let r = addScore(list, entry(50));
    expect(r.rank).toBe(1);
    list = r.list;
    r = addScore(list, entry(80));
    expect(r.rank).toBe(1);
    list = r.list;
    r = addScore(list, entry(60));
    expect(r.rank).toBe(2);
    expect(r.list.map(e => e.score)).toEqual([80, 60, 50]);
  });

  it('on a tie, the earlier game stays ahead', () => {
    const first = entry(50, 'first');
    const { list, rank } = addScore([first], entry(50, 'second'));
    expect(rank).toBe(2);
    expect(list.map(e => e.date)).toEqual(['first', 'second']);
  });

  it(`keeps only the top ${TOP_SCORES}`, () => {
    let list: ScoreEntry[] = [];
    for (let s = 10; s <= 100; s += 10) list = addScore(list, entry(s)).list;
    expect(list).toHaveLength(TOP_SCORES);
    // Too low to make it: nothing changes
    const low = addScore(list, entry(5));
    expect(low.rank).toBeNull();
    expect(low.list).toBe(list);
    // A tie with the last place doesn't make it either
    expect(addScore(list, entry(10)).rank).toBeNull();
    // A better one pushes the lowest off
    const high = addScore(list, entry(55));
    expect(high.rank).toBe(6);
    expect(high.list).toHaveLength(TOP_SCORES);
    expect(high.list.map(e => e.score)).not.toContain(10);
  });

  it('does not change the list it was given', () => {
    const list = [entry(50)];
    addScore(list, entry(60));
    expect(list.map(e => e.score)).toEqual([50]);
  });
});

describe('parseScores', () => {
  it('starts empty for every board size', () => {
    expect(parseScores(null)).toEqual({ small: [], medium: [], large: [] });
    expect(emptyScoreboards()).toEqual({ small: [], medium: [], large: [] });
  });

  it('reads saved scoreboards back', () => {
    const boards = { small: [entry(30)], medium: [entry(90), entry(40)], large: [] };
    expect(parseScores(JSON.stringify(boards))).toEqual(boards);
  });

  it('drops entries that make no sense, and unknown sizes', () => {
    const saved = {
      medium: [entry(40), { score: 'lots' }, null, { ...entry(20), moves: -1 }, { ...entry(20), won: 'no' }],
      huge: [entry(500)],
    };
    expect(parseScores(JSON.stringify(saved))).toEqual({ small: [], medium: [entry(40)], large: [] });
  });

  it('puts a list back in order and cuts it to the top', () => {
    const saved = { small: Array.from({ length: 12 }, (_, i) => entry(i)) };
    const { small } = parseScores(JSON.stringify(saved));
    expect(small).toHaveLength(TOP_SCORES);
    expect(small[0].score).toBe(11);
    expect(small[TOP_SCORES - 1].score).toBe(2);
  });

  it('survives damaged storage', () => {
    for (const raw of ['{not json', 'null', '42', '{"small": 3}']) {
      expect(parseScores(raw)).toEqual({ small: [], medium: [], large: [] });
    }
  });
});
