/** Spec §8.1: trim float noise to 12 significant digits, then round halves away from zero. */
export function roundCents(value: number): number {
  const cents = Number((value * 100).toPrecision(12))
  return (Math.sign(cents) * Math.floor(Math.abs(cents) + 0.5)) / 100 + 0
}
