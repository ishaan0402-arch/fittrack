// US Navy method — a widely-used estimate from simple tape measurements,
// not a substitute for clinical body-fat measurement (DEXA, calipers, etc).
export function estimateBodyFatPct(
  gender: 'male' | 'female',
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number
): number | null {
  if (gender === 'male') {
    if (waistCm <= neckCm) return null
    const pct = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450
    return pct > 0 ? pct : null
  }
  if (hipCm == null || waistCm + hipCm <= neckCm) return null
  const pct =
    495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450
  return pct > 0 ? pct : null
}
