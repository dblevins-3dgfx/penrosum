import { describe, expect, it } from 'vitest';
import { TOP_SCORES, addScore, emptyScoreboards, parseScores, recordScore, scoreList, type ScoreEntry } from './scores';

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

describe('recordScore', () => {
  it('keeps a top 10 for each skin on each board size', () => {
    let boards = emptyScoreboards();
    ({ boards } = recordScore(boards, 'medium', 'alphabet', entry(50)));
    const star = recordScore(boards, 'medium', 'star-forge', entry(20));
    expect(star.rank).toBe(1);
    expect(scoreList(star.boards, 'medium', 'alphabet')).toEqual([entry(50)]);
    expect(scoreList(star.boards, 'medium', 'star-forge')).toEqual([entry(20)]);
    expect(scoreList(star.boards, 'small', 'star-forge')).toEqual([]);
  });

  it('leaves the scoreboards alone when a game doesn\'t make the list', () => {
    let boards = emptyScoreboards();
    for (let i = 0; i < TOP_SCORES; i++) ({ boards } = recordScore(boards, 'small', 'evolution', entry(100 + i)));
    const late = recordScore(boards, 'small', 'evolution', entry(1));
    expect(late.rank).toBeNull();
    expect(late.boards).toBe(boards);
  });

  it('does not change the scoreboards it was given', () => {
    const boards = emptyScoreboards();
    recordScore(boards, 'large', 'alphabet', entry(5));
    expect(boards).toEqual(emptyScoreboards());
  });
});

describe('parseScores', () => {
  const empty = { small: {}, medium: {}, large: {} };

  it('starts empty for every board size', () => {
    expect(parseScores(null)).toEqual(empty);
    expect(emptyScoreboards()).toEqual(empty);
  });

  it('reads saved scoreboards back', () => {
    const boards = { small: { alphabet: [entry(30)] }, medium: { alphabet: [entry(90), entry(40)], evolution: [entry(7)] }, large: {} };
    expect(parseScores(JSON.stringify(boards))).toEqual(boards);
  });

  it('moves a top 10 saved before skins had their own to Alphabet', () => {
    const old = { small: [entry(30)], medium: [entry(90), entry(40)], large: [] };
    expect(parseScores(JSON.stringify(old))).toEqual({
      small: { alphabet: [entry(30)] }, medium: { alphabet: [entry(90), entry(40)] }, large: {},
    });
  });

  it('drops entries that make no sense, unknown sizes and odd skin names', () => {
    const saved = {
      medium: { alphabet: [entry(40), { score: 'lots' }, null, { ...entry(20), moves: -1 }, { ...entry(20), won: 'no' }], 'Bad Name!': [entry(9)] },
      huge: { alphabet: [entry(500)] },
    };
    expect(parseScores(JSON.stringify(saved))).toEqual({ small: {}, medium: { alphabet: [entry(40)] }, large: {} });
  });

  it('puts a list back in order and cuts it to the top', () => {
    const saved = { small: { alphabet: Array.from({ length: 12 }, (_, i) => entry(i)) } };
    const small = scoreList(parseScores(JSON.stringify(saved)), 'small', 'alphabet');
    expect(small).toHaveLength(TOP_SCORES);
    expect(small[0].score).toBe(11);
    expect(small[TOP_SCORES - 1].score).toBe(2);
  });

  it('survives damaged storage', () => {
    for (const raw of ['{not json', 'null', '42', '{"small": 3}', '{"small": {"alphabet": 3}}']) {
      expect(parseScores(raw)).toEqual(empty);
    }
  });
});
