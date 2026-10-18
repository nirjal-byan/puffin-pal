import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 32768);
  return `scrypt:32768:8:1:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split(":");
  // Accept the original local seed format as well as the explicitly parameterized format.
  const legacy = parts.length === 3;
  if (
    parts[0] !== "scrypt" ||
    (!legacy &&
      (parts.length !== 6 || parts[1] !== "32768" || parts[2] !== "8" || parts[3] !== "1"))
  )
    return false;
  const salt = legacy ? parts[1] : parts[4];
  const hash = legacy ? parts[2] : parts[5];
  if (!salt || !hash || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const key = await derive(password, salt, legacy ? 16384 : 32768);
  return timingSafeEqual(key, Buffer.from(hash, "hex"));
}
