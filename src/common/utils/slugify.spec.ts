import { slugify, withRandomSuffix } from './slugify.js';

describe('slugify', () => {
  it('lowercases and hyphenates Latin text', () => {
    expect(slugify('  The Battle of Didgori!  ')).toBe('the-battle-of-didgori');
  });

  it('keeps Georgian letters', () => {
    expect(slugify('დიდგორის ბრძოლა')).toBe('დიდგორის-ბრძოლა');
  });

  it('returns an empty string when there are no letters or numbers', () => {
    expect(slugify('!!! ???')).toBe('');
  });

  it('caps the length without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('appends a 6-character hex suffix', () => {
    expect(withRandomSuffix('post')).toMatch(/^post-[0-9a-f]{6}$/);
  });
});
