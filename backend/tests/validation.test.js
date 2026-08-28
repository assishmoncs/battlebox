'use strict';

const { sanitizeName, normalizeRoom, intInRange, payloadSizeOk } = require('../validation');

describe('validation helpers', () => {
  test('accepts safe gamertags and rejects unsafe ones', () => {
    expect(sanitizeName('Assish_01')).toBe('Assish_01');
    expect(sanitizeName('a'.repeat(30))).toBe('aaaaaaaaaaaaaaaaaaaa');
    expect(sanitizeName('<script>')).toBeNull();
    expect(sanitizeName('')).toBeNull();
  });

  test('normalizes and validates room codes', () => {
    expect(normalizeRoom(' ab12 ')).toBe('AB12');
    expect(normalizeRoom('ABC')).toBeNull();
    expect(normalizeRoom('ABCD!')).toBeNull();
  });

  test('validates bounded integers and payload size', () => {
    expect(intInRange(3, 0, 6)).toBe(true);
    expect(intInRange(7, 0, 6)).toBe(false);
    expect(intInRange(3.2, 0, 6)).toBe(false);
    expect(payloadSizeOk({ ok: true })).toBe(true);
    expect(payloadSizeOk({ data: 'x'.repeat(5000) }, 100)).toBe(false);
  });
});
