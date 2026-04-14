export const GITHUB_DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "Hydria-Agentic-V2"
};

export function normalizeRepoRef(repo) {
  if (typeof repo === "string") {
    const clean = repo
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/^\/+|\/+$/g, "");
    const [owner, name] = clean.split("/");
    return {
      owner,
      name,
      fullName: owner && name ? `${owner}/${name}` : clean
    };
  }

  if (repo?.owner && repo?.name) {
    return {
      owner: repo.owner,
      name: repo.name,
      fullName: `${repo.owner}/${repo.name}`
    };
  }

  return {
    owner: "",
    name: "",
    fullName: ""
  };
}

export function normalizeRepository(item = {}) {
  return {
    id: item.id,
    fullName: item.full_name,
    name: item.name,
    owner: item.owner?.login || "",
    private: Boolean(item.private),
    htmlUrl: item.html_url,
    description: item.description || "",
    language: item.language || "",
    stars: Number(item.stargazers_count || 0),
    forks: Number(item.forks_count || 0),
    openIssues: Number(item.open_issues_count || 0),
    defaultBranch: item.default_branch || "main",
    updatedAt: item.updated_at || null,
    pushedAt: item.pushed_at || item.updated_at || null,
    archived: Boolean(item.archived),
    topics: item.topics || [],
    license: item.license?.spdx_id || item.license?.name || "",
    size: Number(item.size || 0),
    hasIssues: Boolean(item.has_issues),
    visibility: item.visibility || (item.private ? "private" : "public")
  };
}

export function normalizeCodeResult(item = {}) {
  return {
    name: item.name,
    path: item.path,
    sha: item.sha,
    htmlUrl: item.html_url,
    repository: normalizeRepository(item.repository || {})
  };
}
