/** Travel time at an average 20 km/h, rounded up to whole minutes. */
export function travelMinutes(km: number): number {
  return Math.ceil((km / 20) * 60);
}

/** Pre-order ETA quote: prep + travel + 5 min handover buffer. */
export function etaQuote(prepMinutes: number, distanceKm: number): number {
  return prepMinutes + travelMinutes(distanceKm) + 5;
}
