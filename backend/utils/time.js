export function nowIso() {
  return new Date().toISOString();
}

export function durationMs(startedAt) {
  return Date.now() - startedAt;
}

