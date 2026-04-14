export class CredentialVault {
  has(key) {
    return Boolean(process.env[key]);
  }

  get(key, fallback = "") {
    return process.env[key] || fallback;
  }

  describe(keys = []) {
    return keys.map((key) => ({
      key,
      configured: this.has(key)
    }));
  }
}

export default CredentialVault;
