const BASE = '0123456789abcdefghijklmnopqrstuvwxyz';
const SMALLEST = BASE[0];
const LARGEST = BASE[BASE.length - 1];
const MID_CHAR = BASE[Math.floor(BASE.length / 2)]; // 'i'

/**
 * Generates a key lexicographically strictly between `low` and `high`.
 * If low is null/undefined, generates a key before high.
 * If high is null/undefined, generates a key after low.
 * If both are null/undefined, generates a default midpoint key.
 */
export function generateFractionalKey(low?: string | null, high?: string | null): string {
  if (!low && !high) {
    return 'a0';
  }

  if (!low && high) {
    // Generate something smaller than high
    const firstHigh = high[0];
    const highIdx = BASE.indexOf(firstHigh);
    if (highIdx > 0) {
      const midIdx = Math.floor(highIdx / 2);
      return BASE[midIdx];
    }
    // High starts with '0'
    return '0' + generateFractionalKey(null, high.slice(1));
  }

  if (low && !high) {
    // Generate something larger than low
    const lastLow = low[low.length - 1];
    const lowIdx = BASE.indexOf(lastLow);
    if (lowIdx < BASE.length - 1) {
      const nextChar = BASE[lowIdx + 1];
      return low.slice(0, -1) + nextChar;
    }
    return low + MID_CHAR;
  }

  // Both low and high exist, low must be < high
  if (low && high) {
    let prefix = '';
    let i = 0;
    while (i < low.length && i < high.length && low[i] === high[i]) {
      prefix += low[i];
      i++;
    }

    const lowChar = i < low.length ? low[i] : SMALLEST;
    const highChar = i < high.length ? high[i] : LARGEST;

    const lowIdx = BASE.indexOf(lowChar);
    const highIdx = BASE.indexOf(highChar);

    if (highIdx - lowIdx > 1) {
      const midIdx = Math.floor((lowIdx + highIdx) / 2);
      return prefix + BASE[midIdx];
    }

    // Characters are consecutive (e.g. 'a' and 'b')
    if (i < low.length) {
      return prefix + lowChar + generateFractionalKey(low.slice(i + 1), null);
    } else {
      return prefix + SMALLEST + generateFractionalKey(null, high.slice(i + 1));
    }
  }

  return 'a0';
}
