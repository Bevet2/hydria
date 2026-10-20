// Shared across service instances. Single-process deployment only.
const locks = new Map();
export async function withKeyedLock(key, operation) {
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const turn = new Promise(resolve => { release = resolve; });
  locks.set(key, turn);
  await previous;
  try { return await operation(); }
  finally {
    release();
    if (locks.get(key) === turn) locks.delete(key);
  }
}
