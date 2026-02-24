/**
 * @file Tests for the Magic Words inline tokenizer.
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenizer';

describe('tokenize', () => {
  it('returns a single text token for plain text', () => {
    expect(tokenize('Hello world')).toEqual([
      { kind: 'text', value: 'Hello world' },
    ]);
  });

  it('parses a single emoji token', () => {
    expect(tokenize('{happy}')).toEqual([{ kind: 'emoji', name: 'happy' }]);
  });

  it('parses text before and after an emoji', () => {
    expect(tokenize('Hi {happy} there')).toEqual([
      { kind: 'text', value: 'Hi ' },
      { kind: 'emoji', name: 'happy' },
      { kind: 'text', value: ' there' },
    ]);
  });

  it('parses multiple emoji tokens with text gaps', () => {
    const result = tokenize('A {b} C {d} E');
    expect(result).toEqual([
      { kind: 'text', value: 'A ' },
      { kind: 'emoji', name: 'b' },
      { kind: 'text', value: ' C ' },
      { kind: 'emoji', name: 'd' },
      { kind: 'text', value: ' E' },
    ]);
  });

  it('parses adjacent emoji tokens without text in between', () => {
    const result = tokenize('{a}{b}');
    expect(result).toEqual([
      { kind: 'emoji', name: 'a' },
      { kind: 'emoji', name: 'b' },
    ]);
  });

  it('handles emoji at the very start', () => {
    const result = tokenize('{win} great!');
    expect(result).toEqual([
      { kind: 'emoji', name: 'win' },
      { kind: 'text', value: ' great!' },
    ]);
  });

  it('handles emoji at the very end', () => {
    const result = tokenize('Good {win}');
    expect(result).toEqual([
      { kind: 'text', value: 'Good ' },
      { kind: 'emoji', name: 'win' },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('treats empty braces as literal text (regex requires at least one char inside {})', () => {
    // /\{([^}]+)\}/ requires [^}]+ so {} is not matched — passes through as-is
    const result = tokenize('hi {} there');
    expect(result).toEqual([{ kind: 'text', value: 'hi {} there' }]);
  });

  it('handles multi-word emoji names', () => {
    expect(tokenize('{very happy}')).toEqual([
      { kind: 'emoji', name: 'very happy' },
    ]);
  });
});
