export function toE164SwedishPhoneNumber(raw: string) {
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('0046')) {
    digits = digits.slice(2);
  }

  if (!digits.startsWith('46') && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!digits.startsWith('46')) {
    digits = `46${digits}`;
  }

  return `+${digits}`;
}
