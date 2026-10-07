export function calculateRemainingClaim({
  viewCount,
  baselineViews,
  cpm,
  maxPayoutPerVideo,
  totalPaid,
}) {
  const eligibleViews =
    BigInt(viewCount) > BigInt(baselineViews)
      ? BigInt(viewCount) - BigInt(baselineViews)
      : 0n;
  const entitlement = (eligibleViews * BigInt(cpm)) / 1000n;
  const capped =
    entitlement < BigInt(maxPayoutPerVideo)
      ? entitlement
      : BigInt(maxPayoutPerVideo);
  const remaining =
    capped > BigInt(totalPaid) ? capped - BigInt(totalPaid) : 0n;
  return {
    eligibleViews: eligibleViews.toString(),
    entitlement: capped.toString(),
    remaining: remaining.toString(),
  };
}
