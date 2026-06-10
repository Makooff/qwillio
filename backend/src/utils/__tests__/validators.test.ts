import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail, extractEmailFromText } from '../validators';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  John@Example.COM  ')).toBe('john@example.com');
  });

  it('strips surrounding angle brackets, quotes and parens', () => {
    expect(normalizeEmail('<john@example.com>')).toBe('john@example.com');
    expect(normalizeEmail('(john@example.com)')).toBe('john@example.com');
    expect(normalizeEmail('"john@example.com".')).toBe('john@example.com');
  });

  it('strips surrounding square brackets (regression: unescaped [ in char class)', () => {
    // Guards the regex change `[<"'\[({]` -> `[<"'[({]`: leading `[` must still strip.
    expect(normalizeEmail('[john@example.com]')).toBe('john@example.com');
  });

  it('fixes common domain typos', () => {
    expect(normalizeEmail('john@gmial.com')).toBe('john@gmail.com');
    expect(normalizeEmail('a@gmail.co')).toBe('a@gmail.com');
    expect(normalizeEmail('"sara@hotmial.com".')).toBe('sara@hotmail.com');
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('john@example.com')).toBe(true);
    expect(isValidEmail('john.doe@sub.example.co.uk')).toBe(true);
  });

  it('rejects malformed or out-of-range addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('john@example')).toBe(false); // no dot in domain
    expect(isValidEmail('a@b.c')).toBe(false);        // TLD too short
    expect(isValidEmail(`${'x'.repeat(250)}@example.com`)).toBe(false); // too long
  });
});

describe('extractEmailFromText', () => {
  it('pulls an email out of surrounding prose', () => {
    expect(extractEmailFromText('my email is john@example.com thanks')).toBe('john@example.com');
  });

  it('normalizes the extracted email (case + typo fix)', () => {
    expect(extractEmailFromText('contact: JOHN@GMIAL.COM!')).toBe('john@gmail.com');
  });

  it('returns null when no email is present', () => {
    expect(extractEmailFromText('no email here')).toBeNull();
  });
});
