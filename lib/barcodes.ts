/**
 * Validate common retail GTIN formats using the GS1 modulo-10 check digit.
 * Supported lengths: EAN-8, UPC-A (12), EAN-13 and GTIN-14.
 * UPC-E is intentionally not accepted here because it needs expansion to UPC-A
 * before validating; callers should ask for the printed UPC-A/EAN code instead.
 */
export function normalizeGtin(value: string): string | null {
  const code = value.trim();
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return null;

  const body = code.slice(0, -1);
  let sum = 0;
  for (let index = body.length - 1, weight = 3; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  return expectedCheckDigit === Number(code[code.length - 1]) ? code : null;
}

export function isValidGtin(value: string): boolean {
  return normalizeGtin(value) !== null;
}

/** Compare GTINs after left-padding to the common GTIN-14 representation. */
export function sameGtin(left: string, right: string): boolean {
  const a = normalizeGtin(left);
  const b = normalizeGtin(right);
  return Boolean(a && b && a.padStart(14, "0") === b.padStart(14, "0"));
}
