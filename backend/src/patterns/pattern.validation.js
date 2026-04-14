export function validatePatternItem(item = {}) {
  return Boolean(item.description && item.category && item.type);
}

export default {
  validatePatternItem
};
