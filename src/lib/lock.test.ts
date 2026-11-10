import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256 } from '../components/LockScreen';

describe('PIN-Hash', () => {
  it('stimmt mit Node-SHA-256 überein', () => {
    for (const s of ['', '0000', '1234', 'Finanzen äöü €', 'x'.repeat(100)]) {
      expect(sha256(s)).toBe(createHash('sha256').update(s).digest('hex'));
    }
  });
});
