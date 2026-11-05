import { describe, expect, it } from 'vitest';
import { type KeyValueStore, previewNumber, seedPreview, storageKey } from './preview';

const memory = (entries: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...entries };
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('previewNumber', () => {
  it('reads a pull request number, and nothing else', () => {
    expect(previewNumber('82')).toBe('82');
    expect(previewNumber(undefined)).toBeNull();
    expect(previewNumber('')).toBeNull();
    expect(previewNumber('82; drop')).toBeNull();
    expect(previewNumber('../x')).toBeNull();
  });
});

describe('storageKey', () => {
  it('keeps the live game\'s keys, and gives a preview keys of its own', () => {
    expect(storageKey('penrosum.topTen', null)).toBe('penrosum.topTen');
    expect(storageKey('penrosum.topTen', '82')).toBe('penrosum.pr82.topTen');
    expect(storageKey('penrosum.options', '7')).toBe('penrosum.pr7.options');
  });
});

describe('seedPreview', () => {
  const keys = ['penrosum.topTen', 'penrosum.options', 'penrosum.rules'];

  it('copies the live game\'s data to the preview\'s keys, leaving the live data alone', () => {
    const store = memory({ 'penrosum.topTen': '{"small":[]}', 'penrosum.options': '{"skin":"evolution"}' });
    seedPreview(store, keys, '82');
    expect(store.data['penrosum.pr82.topTen']).toBe('{"small":[]}');
    expect(store.data['penrosum.pr82.options']).toBe('{"skin":"evolution"}');
    expect(store.data['penrosum.pr82.rules']).toBeUndefined();
    expect(store.data['penrosum.topTen']).toBe('{"small":[]}');
  });

  it('copies only once, so later play in either stays apart', () => {
    const store = memory({ 'penrosum.topTen': 'live' });
    seedPreview(store, keys, '82');
    store.setItem('penrosum.pr82.topTen', 'preview');
    store.setItem('penrosum.topTen', 'live 2');
    seedPreview(store, keys, '82');
    expect(store.data['penrosum.pr82.topTen']).toBe('preview');
  });

  it('keeps data a preview already has', () => {
    const store = memory({ 'penrosum.topTen': 'live', 'penrosum.pr82.topTen': 'mine' });
    seedPreview(store, keys, '82');
    expect(store.data['penrosum.pr82.topTen']).toBe('mine');
  });

  it('keeps each preview apart from the others', () => {
    const store = memory({ 'penrosum.topTen': 'live' });
    seedPreview(store, keys, '82');
    store.setItem('penrosum.pr82.topTen', 'changed');
    seedPreview(store, keys, '83');
    expect(store.data['penrosum.pr83.topTen']).toBe('live');
  });
});
