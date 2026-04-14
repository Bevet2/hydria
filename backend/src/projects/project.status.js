export function deriveProjectStatus({
  criticScore = 0,
  buildStatus = "",
  testStatus = "",
  delivery = null
} = {}) {
  const deliveryStatus = delivery?.status || "";
  if (deliveryStatus) {
    if (deliveryStatus === "delivered") {
      return "delivered";
    }
    if (deliveryStatus === "exported") {
      return "exported";
    }
    if (deliveryStatus === "validated") {
      return "validated";
    }
    if (deliveryStatus === "run_failed") {
      return "run_failed";
    }
    if (deliveryStatus === "installed") {
      return "installed";
    }
    if (deliveryStatus === "scaffolded") {
      return "scaffolded";
    }
  }

  if (buildStatus === "failed" || testStatus === "failed") {
    return "needs_fix";
  }
  if (criticScore >= 80 && buildStatus === "passed" && testStatus === "passed") {
    return "healthy";
  }
  if (criticScore >= 60) {
    return "in_progress";
  }
  return "draft";
}

export default {
  deriveProjectStatus
};
