function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithRuntimeRetry(
  operation,
  {
    maxAttempts = 1,
    backoffMs = 250,
    shouldRetry = () => false,
    onAttemptFailure = null
  } = {}
) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return {
        success: true,
        value,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;
      if (typeof onAttemptFailure === "function") {
        await onAttemptFailure(error, attempt);
      }

      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        break;
      }

      await sleep(backoffMs * attempt);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts
  };
}

export default {
  executeWithRuntimeRetry
};
