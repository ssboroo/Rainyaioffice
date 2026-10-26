import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const value = process.env.WORKSPACE_SECRET_KEY;
  if (!value) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32)
    throw Error("WORKSPACE_SECRET_KEY must be 32 bytes encoded as base64");
  return bytes;
}
export const canStoreSecrets = () => !!key();
export function seal(value, workspace) {
  const k = key();
  if (!k) throw Error("Workspace secret storage is not configured");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", k, iv);
  cipher.setAAD(Buffer.from(workspace));
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function unseal(value, workspace) {
  const [iv, tag, body] = value.split(".").map((b) => Buffer.from(b, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(workspace));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}
