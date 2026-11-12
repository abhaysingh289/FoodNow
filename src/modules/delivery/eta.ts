/** Travel time at an average 20 km/h, rounded up to whole minutes. */
export function travelMinutes(km: number): number {
  return Math.ceil((km / 20) * 60);
}

/** Pre-order ETA quote: prep + travel + 5 min handover buffer. */
export function etaQuote(prepMinutes: number, distanceKm: number): number {
  return prepMinutes + travelMinutes(distanceKm) + 5;
}

const RIDER_TO_RESTAURANT_MINUTES = 5;

/** Live ETA by order stage (spec §10.4). */
export function computeEta(
  stage: "ACCEPTED" | "RIDER_ASSIGNED" | "PICKED_UP",
  prepMinutes: number,
  distanceKm: number,
): number {
  const travel = travelMinutes(distanceKm);
  if (stage === "PICKED_UP") return travel + 5;
  return prepMinutes + RIDER_TO_RESTAURANT_MINUTES + travel + 5;
}
