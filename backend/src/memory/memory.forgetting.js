export function applyMemoryForgetting(records = [], { limit = 100 } = {}) {
  return [...records]
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
    .slice(0, limit);
}

export default {
  applyMemoryForgetting
};
