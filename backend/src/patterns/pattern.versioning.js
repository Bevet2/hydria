export function bumpPatternVersion(version = "1.0.0", level = "patch") {
  const [major, minor, patch] = String(version)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

  if (level === "major") {
    return `${major + 1}.0.0`;
  }
  if (level === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

export default {
  bumpPatternVersion
};
