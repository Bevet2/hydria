import legacyHydriaBrain from "../../services/hydria/HydriaBrain.js";

export function fallbackToLegacyChat(payload) {
  return legacyHydriaBrain.processChat(payload);
}

export default {
  fallbackToLegacyChat
};

