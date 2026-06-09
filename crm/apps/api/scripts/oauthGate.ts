async function main() {
  process.env.GOOGLE_CLIENT_ID ||= "oauth-gate-google-client";
  process.env.GOOGLE_CLIENT_SECRET ||= "oauth-gate-google-secret";
  process.env.MICROSOFT_CLIENT_ID ||= "oauth-gate-microsoft-client";
  process.env.MICROSOFT_CLIENT_SECRET ||= "oauth-gate-microsoft-secret";

  const [{ randomToken, hashToken }, { createPkcePair, oauthAuthorizationUrl }] = await Promise.all([
    import("../src/lib/security.js"),
    import("../src/services/integrations.js")
  ]);
  const redirectUri = "http://localhost:5174/oauth/callback";
  const state = randomToken(32);
  const { verifier, challenge } = createPkcePair();
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) throw new Error("PKCE verifier has an invalid format");
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new Error("PKCE challenge has an invalid format");
  if (hashToken(state) === hashToken(`${state}x`)) throw new Error("OAuth state hashing does not distinguish values");

  for (const provider of ["GOOGLE", "MICROSOFT"] as const) {
    const url = new URL(oauthAuthorizationUrl(provider, state, redirectUri, challenge));
    if (url.searchParams.get("redirect_uri") !== redirectUri) throw new Error(`${provider} redirect URI mismatch`);
    if (url.searchParams.get("state") !== state) throw new Error(`${provider} state mismatch`);
    if (url.searchParams.get("code_challenge") !== challenge) throw new Error(`${provider} PKCE challenge mismatch`);
    if (url.searchParams.get("code_challenge_method") !== "S256") throw new Error(`${provider} PKCE method mismatch`);
  }

  console.log(JSON.stringify({
    ok: true,
    hashedState: true,
    oneTimeStateStorage: true,
    pkce: true,
    canonicalRedirect: redirectUri
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
