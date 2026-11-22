// Element/document id generation.
//
// ULID format (Crockford base32, 26 characters: 48-bit millisecond timestamp
// then 80 bits of randomness) so ids sort roughly by creation time in a diff
// while staying collision-safe across peers. No dependency: the format is a
// dozen lines and the collab layer will need the same one on the server side.

/** Injection seam: tests pass a deterministic generator. */
export type IdSource = () => string;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encodeTime(milliseconds: number): string {
  let remaining = Math.floor(milliseconds);
  let out = "";
  for (let i = 0; i < TIME_LENGTH; i += 1) {
    out = CROCKFORD[remaining % 32] + out;
    remaining = Math.floor(remaining / 32);
  }
  return out;
}

function encodeRandom(fillRandom: (bytes: Uint8Array) => void): string {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  fillRandom(bytes);
  let out = "";
  for (const byte of bytes) {
    // One character per byte, so only 5 of the 8 bits are used. That still
    // leaves 80 bits of entropy, which is the ULID guarantee.
    out += CROCKFORD[byte % 32];
  }
  return out;
}

/** A fresh ULID-format identifier. Fixtures can supply deterministic entropy. */
export function newElementId(
  now: number = Date.now(),
  fillRandom: (bytes: Uint8Array) => void = (bytes) =>
    crypto.getRandomValues(bytes),
): string {
  return encodeTime(now) + encodeRandom(fillRandom);
}

/** True for strings shaped like {@link newElementId} output. */
export function isElementIdFormat(value: string): boolean {
  if (value.length !== TIME_LENGTH + RANDOM_LENGTH) {
    return false;
  }
  for (const character of value) {
    if (!CROCKFORD.includes(character)) {
      return false;
    }
  }
  return true;
}
