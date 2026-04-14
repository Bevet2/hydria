import { db } from "../../db/sqlite.js";
import { AppError } from "../../utils/errors.js";
import { nowIso } from "../../utils/time.js";
import { getUserById } from "./historyService.js";

function normalizePreferenceValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}

export function getUserPreferences(userId) {
  if (!getUserById(userId)) {
    throw new AppError("User not found", 404);
  }

  const rows = db
    .prepare(
      `
      SELECT key, value, updated_at
      FROM user_preferences
      WHERE user_id = ?
      ORDER BY key ASC
      `
    )
    .all(userId);

  return rows.reduce((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});
}

export function updateUserPreferences(userId, preferences) {
  if (!getUserById(userId)) {
    throw new AppError("User not found", 404);
  }

  const cleanEntries = Object.entries(preferences || {}).filter(
    ([key, value]) => key && normalizePreferenceValue(value)
  );

  const timestamp = nowIso();
  const statement = db.prepare(
    `
    INSERT INTO user_preferences (user_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, key)
    DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `
  );

  const transaction = db.transaction((entries) => {
    for (const [key, value] of entries) {
      statement.run(userId, key, normalizePreferenceValue(value), timestamp);
    }
  });

  transaction(cleanEntries);

  return getUserPreferences(userId);
}

