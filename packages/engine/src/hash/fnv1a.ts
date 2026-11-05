/**
 * Incremental 32-bit FNV-1a, the state hash of ADR-0009. The simulation feeds it a canonical
 * sequence of integers and the raw IEEE 754 bits of floats, so two runs hash alike exactly when
 * their states are bit for bit the same. FNV-1a is not a cryptographic hash: it detects
 * divergence, it does not stop forgery (the server re-simulates for that).
 *
 * Only integer operations are used (`Math.imul` and bit operations), which every JavaScript
 * engine computes identically.
 */
export interface Fnv1a {
  /** Mixes in the low 8 bits of `value`. */
  byte(value: number): Fnv1a;
  /** Mixes in `value` as a 32-bit integer, little-endian. Negative integers use two's complement. */
  uint32(value: number): Fnv1a;
  /** Mixes in the 8 bytes of `value` as a float64, little-endian. `0` and `-0` differ. */
  float64(value: number): Fnv1a;
  /** The hash so far, an unsigned 32-bit integer. Mixing in more data afterwards is allowed. */
  digest(): number;
  /** The hash so far as 8 lowercase hex digits, for storage and comparison. */
  hex(): string;
}

const OFFSET_BASIS = 0x81_1c_9d_c5;
const PRIME = 0x01_00_01_93;

export function createFnv1a(): Fnv1a {
  let hash = OFFSET_BASIS;
  // One scratch buffer per hasher: hashing a float allocates nothing.
  const view = new DataView(new ArrayBuffer(8));

  const hasher: Fnv1a = {
    byte(value) {
      hash = Math.imul(hash ^ (value & 0xff), PRIME) >>> 0;
      return hasher;
    },
    uint32(value) {
      hasher.byte(value);
      hasher.byte(value >>> 8);
      hasher.byte(value >>> 16);
      return hasher.byte(value >>> 24);
    },
    float64(value) {
      view.setFloat64(0, value, true);
      hasher.uint32(view.getUint32(0, true));
      return hasher.uint32(view.getUint32(4, true));
    },
    digest() {
      return hash;
    },
    hex() {
      return hash.toString(16).padStart(8, '0');
    },
  };
  return hasher;
}
