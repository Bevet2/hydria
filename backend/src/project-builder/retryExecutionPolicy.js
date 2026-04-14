export function createRetryExecutionPolicy({
  maxFixAttempts = 2
} = {}) {
  return {
    maxFixAttempts,
    canRetry(attempt = 0, analysis = null) {
      return (
        attempt < maxFixAttempts &&
        Boolean(analysis?.retryable) &&
        Boolean(analysis?.fixable)
      );
    }
  };
}

export default {
  createRetryExecutionPolicy
};
