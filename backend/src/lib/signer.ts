import { createHash, createPrivateKey, createPublicKey, sign } from 'crypto';

export interface Signer {
  sign(data: Uint8Array): Promise<string>; // base64
  keyId(): string;
}

/**
 * DevSigner
 *
 * Launch-safe default signer for local/dev/test environments.
 * - Generates an ephemeral Ed25519 keypair at process start.
 * - Does NOT embed any real secrets.
 * - KMS-compatible shape: keyId + sign(bytes) => signature
 */
export class DevSigner implements Signer {
  private readonly _keyId: string;
  private readonly privateKeyDer: Buffer;

  constructor() {
    const seedInput = process.env.DEV_SIGNING_SEED;
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

    const effectiveSeed = seedInput ?? (isTest ? 'test-seed' : null);
    if (!effectiveSeed) {
      throw new Error('DEV_SIGNING_SEED is required for DevSigner (non-test env)');
    }

    const seed32 = createHash('sha256').update(effectiveSeed).digest().subarray(0, 32);
    this.privateKeyDer = pkcs8FromEd25519Seed(seed32);

    const priv = createPrivateKey({ key: this.privateKeyDer, format: 'der', type: 'pkcs8' });
    const pub = createPublicKey(priv);
    const pubDer = pub.export({ format: 'der', type: 'spki' }) as Buffer;
    const pubHash = createHash('sha256').update(pubDer).digest('hex');
    this._keyId = `dev-ed25519:${pubHash}`;
  }

  keyId(): string {
    return this._keyId;
  }

  async sign(data: Uint8Array): Promise<string> {
    const key = createPrivateKey({ key: this.privateKeyDer, format: 'der', type: 'pkcs8' });
    // Ed25519 signing (Node crypto): algorithm is null.
    const sig = sign(null, Buffer.from(data), key);
    return sig.toString('base64');
  }
}

function derLen(n: number): Buffer {
  if (n < 128) return Buffer.from([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLen(value.length), value]);
}

function seq(items: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(items));
}

/**
 * Deterministic PKCS8 DER wrapper for Ed25519 seed.
 *
 * Structure:
 *   PrivateKeyInfo ::= SEQUENCE {
 *     version                   INTEGER,
 *     privateKeyAlgorithm       AlgorithmIdentifier,
 *     privateKey                OCTET STRING
 *   }
 *
 * For Ed25519, algorithm OID is 1.3.101.112 (2B 65 70).
 * privateKey is OCTET STRING containing OCTET STRING(seed32).
 */
function pkcs8FromEd25519Seed(seed32: Buffer): Buffer {
  if (seed32.length !== 32) {
    throw new Error('Ed25519 seed must be 32 bytes');
  }
  const version = tlv(0x02, Buffer.from([0x00]));
  const oidEd25519 = tlv(0x06, Buffer.from([0x2b, 0x65, 0x70]));
  const algId = seq([oidEd25519]);
  const inner = tlv(0x04, seed32);
  const privKey = tlv(0x04, inner);
  return seq([version, algId, privKey]);
}

let defaultSigner: Signer | null = null;

export function getDefaultSigner(): Signer {
  if (!defaultSigner) defaultSigner = new DevSigner();
  return defaultSigner;
}
