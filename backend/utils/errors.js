export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ExternalServiceError extends AppError {
  constructor(message, provider, statusCode = 502, details = null) {
    super(message, statusCode, details);
    this.name = "ExternalServiceError";
    this.provider = provider;
  }
}

export class ConfigurationError extends AppError {
  constructor(message, details = null) {
    super(message, 500, details);
    this.name = "ConfigurationError";
  }
}

export function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  // body-parser annotates invalid JSON with status=400 and
  // type=entity.parse.failed. Do not leak parser internals as HTTP 500.
  if (error?.type === "entity.parse.failed" || (error?.status === 400 && error?.body !== undefined)) {
    return new AppError("Malformed JSON request body", 400);
  }

  return new AppError(error?.message || "Unexpected error", 500);
}

