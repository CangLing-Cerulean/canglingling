const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function secureEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(a);
  const rightBytes = new Uint8Array(b);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

function base64UrlEncode(value) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

export function validateNewPassword(value) {
  if (typeof value !== "string") {
    return { ok: false, error: "新密码格式无效" };
  }
  if (!value.length) {
    return { ok: false, error: "新密码不能为空" };
  }
  return { ok: true, value };
}

export async function hashAdminPassword(secret, salt, password) {
  return bytesToHex(await hmac(secret, `${salt}:${password}`));
}

export async function passwordMatches(secret, salt, password, expectedHash) {
  const actualHash = await hashAdminPassword(secret, salt, password);
  return secureEqual(actualHash, expectedHash);
}

export async function createAdminSession(
  secret,
  version,
  now = Date.now(),
) {
  const payload = base64UrlEncode(
    JSON.stringify({
      exp: now + 12 * 60 * 60 * 1000,
      version,
      nonce: crypto.randomUUID(),
    }),
  );
  const signature = bytesToHex(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

export async function verifyAdminSession(
  secret,
  token,
  expectedVersion,
  now = Date.now(),
) {
  try {
    const [payload, signature, extra] = String(token || "").split(".");
    if (!payload || !signature || extra) return false;
    const expectedSignature = bytesToHex(await hmac(secret, payload));
    if (!(await secureEqual(signature, expectedSignature))) return false;
    const data = JSON.parse(base64UrlDecode(payload));
    return (
      Number.isFinite(data.exp) &&
      data.exp > now &&
      Number.isInteger(data.version) &&
      data.version === expectedVersion &&
      typeof data.nonce === "string"
    );
  } catch {
    return false;
  }
}

export { secureEqual };
