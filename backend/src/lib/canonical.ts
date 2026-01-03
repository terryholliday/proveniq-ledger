import { createHash } from 'crypto';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function toCanonicalValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const c = toCanonicalValue(item);
      // In arrays, undefined becomes null to keep positional determinism.
      out.push(c === undefined ? null : c);
    }
    return out;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const c = toCanonicalValue(value[k]);
      // Omit undefined fields in objects.
      if (c !== undefined) out[k] = c;
    }
    return out;
  }

  // For other object types, fall back to JSON serialization semantics.
  return value;
}

/**
 * Deep key-sorted canonical JSON.
 *
 * Canon rules:
 * - Object keys are sorted lexicographically.
 * - undefined object properties are omitted.
 * - undefined array elements are serialized as null.
 * - Date -> ISO string
 * - Buffer/Uint8Array -> base64
 * - BigInt -> string
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

export function sha256Hex(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

export function canonicalHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export function computeEvidenceSetHash(contentHashes: string[]): string {
  const sorted = [...contentHashes].filter(Boolean).sort();
  return sha256Hex(sorted.join('|'));
}

export function computeAssetStateHash(params: {
  claim_json: unknown;
  evidence_hashes: string[];
  ruleset_version: string;
}): string {
  const evidence_set_hash = computeEvidenceSetHash(params.evidence_hashes);
  return canonicalHash({
    ruleset_version: params.ruleset_version,
    claim_json: params.claim_json,
    evidence_set_hash,
  });
}
