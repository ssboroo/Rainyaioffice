import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  return bits
    .match(/.{1,5}/g)
    .map((b) => alphabet[parseInt(b.padEnd(5, "0"), 2)])
    .join("");
}
function decode(secret) {
  let bits = "";
  for (const c of secret)
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)));
}
export function totp(secret, time = Date.now()) {
  const step = Buffer.alloc(8);
  step.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const digest = createHmac("sha1", decode(secret)).update(step).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
export function verifyTotp(secret, code, lastStep = -1, time = Date.now()) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  for (const delta of [-1, 0, 1]) {
    const candidate = time + delta * 30000,
      step = Math.floor(candidate / 30000);
    if (
      step > lastStep &&
      timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(code))
    )
      return step;
  }
  return null;
}
