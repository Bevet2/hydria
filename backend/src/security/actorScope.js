// null/undefined deliberately preserve private-pilot internal unscoped calls.
// Any *supplied* actor identifier must be a positive, safe integer; 0, NaN,
// empty strings and arbitrary values must never widen the query to "all".
export function invalidExplicitActorId(actorId) {
  if (actorId == null) return false;
  if (typeof actorId === "number") return !Number.isSafeInteger(actorId) || actorId <= 0;
  if (typeof actorId !== "string" || !/^[1-9]\d*$/.test(actorId)) return true;
  return !Number.isSafeInteger(Number(actorId));
}
