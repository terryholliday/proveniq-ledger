import { describe, it, expect } from 'vitest';
import {
  stableStringify,
  sha256Hex,
  canonicalHash,
  computeEvidenceSetHash,
  computeAssetStateHash,
} from './canonical.js';

describe('canonical hashing helpers', () => {
  describe('stableStringify', () => {
    it('sorts object keys deeply', () => {
      const v = {
        b: 2,
        a: {
          d: 4,
          c: 3,
        },
      };

      expect(stableStringify(v)).toBe('{"a":{"c":3,"d":4},"b":2}');
    });

    it('omits undefined object properties', () => {
      const v = { a: 1, b: undefined, c: null };
      expect(stableStringify(v)).toBe('{"a":1,"c":null}');
    });

    it('serializes undefined array elements as null (positional determinism)', () => {
      const v = [1, undefined, 3];
      expect(stableStringify(v)).toBe('[1,null,3]');
    });

    it('serializes Date to ISO string', () => {
      const d = new Date('2026-01-03T00:00:00.000Z');
      expect(stableStringify({ t: d })).toBe('{"t":"2026-01-03T00:00:00.000Z"}');
    });

    it('serializes Buffer to base64', () => {
      const buf = Buffer.from('hello', 'utf8');
      expect(stableStringify({ b: buf })).toBe('{"b":"aGVsbG8="}');
    });

    it('serializes Uint8Array to base64', () => {
      const u8 = new Uint8Array([1, 2, 3]);
      expect(stableStringify({ u: u8 })).toBe('{"u":"AQID"}');
    });

    it('serializes BigInt as string', () => {
      const v = { n: BigInt('9007199254740993') };
      expect(stableStringify(v)).toBe('{"n":"9007199254740993"}');
    });
  });

  describe('sha256Hex', () => {
    it('hashes deterministically', () => {
      expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
      expect(sha256Hex('abc')).not.toBe(sha256Hex('abcd'));
    });
  });

  describe('canonicalHash', () => {
    it('is stable across key order changes', () => {
      const a = { x: 1, y: 2 };
      const b = { y: 2, x: 1 };
      expect(canonicalHash(a)).toBe(canonicalHash(b));
    });

    it('changes when values change', () => {
      expect(canonicalHash({ x: 1 })).not.toBe(canonicalHash({ x: 2 }));
    });
  });

  describe('computeEvidenceSetHash', () => {
    it('sorts content hashes deterministically', () => {
      const h1 = computeEvidenceSetHash(['b', 'a', 'c']);
      const h2 = computeEvidenceSetHash(['c', 'b', 'a']);
      expect(h1).toBe(h2);
    });

    it('ignores empty strings', () => {
      const h1 = computeEvidenceSetHash(['a', '', 'b']);
      const h2 = computeEvidenceSetHash(['b', 'a']);
      expect(h1).toBe(h2);
    });
  });

  describe('computeAssetStateHash', () => {
    it('includes ruleset_version and claim_json and evidence set hash', () => {
      const h1 = computeAssetStateHash({
        claim_json: { name: 'Watch', brand: 'Rolex' },
        evidence_hashes: ['e1', 'e2'],
        ruleset_version: 'v1.0.0',
      });

      const h2 = computeAssetStateHash({
        claim_json: { brand: 'Rolex', name: 'Watch' },
        evidence_hashes: ['e2', 'e1'],
        ruleset_version: 'v1.0.0',
      });

      expect(h1).toBe(h2);
    });

    it('changes when claim_json changes', () => {
      const h1 = computeAssetStateHash({
        claim_json: { name: 'A' },
        evidence_hashes: ['e1'],
        ruleset_version: 'v1.0.0',
      });
      const h2 = computeAssetStateHash({
        claim_json: { name: 'B' },
        evidence_hashes: ['e1'],
        ruleset_version: 'v1.0.0',
      });
      expect(h1).not.toBe(h2);
    });

    it('changes when evidence changes', () => {
      const h1 = computeAssetStateHash({
        claim_json: { name: 'A' },
        evidence_hashes: ['e1'],
        ruleset_version: 'v1.0.0',
      });
      const h2 = computeAssetStateHash({
        claim_json: { name: 'A' },
        evidence_hashes: ['e2'],
        ruleset_version: 'v1.0.0',
      });
      expect(h1).not.toBe(h2);
    });

    it('changes when ruleset_version changes', () => {
      const h1 = computeAssetStateHash({
        claim_json: { name: 'A' },
        evidence_hashes: ['e1'],
        ruleset_version: 'v1.0.0',
      });
      const h2 = computeAssetStateHash({
        claim_json: { name: 'A' },
        evidence_hashes: ['e1'],
        ruleset_version: 'v1.0.1',
      });
      expect(h1).not.toBe(h2);
    });
  });
});
