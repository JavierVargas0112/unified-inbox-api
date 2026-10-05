/**
 * Normalises a phone number to E.164 so that the same guest writing by SMS
 * ("+33 6 12 34 56 78") and by WhatsApp ("33612345678") is one customer.
 * Returns null when the input cannot be an international number.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/^whatsapp:/, '').replace(/[\s().-]/g, '');
  const withoutPlus = digits.startsWith('+') ? digits.slice(1) : digits.replace(/^00/, '');
  if (!/^[1-9]\d{6,14}$/.test(withoutPlus)) {
    return null;
  }
  return `+${withoutPlus}`;
}
