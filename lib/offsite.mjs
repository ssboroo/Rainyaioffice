import { DatabaseSync } from "node:sqlite";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat, appendFile, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
const MAGIC = Buffer.from("RAINYB1\n");
export const offsiteConfigured = () =>
  [
    "BACKUP_S3_ENDPOINT",
    "BACKUP_S3_BUCKET",
    "BACKUP_S3_ACCESS_KEY_ID",
    "BACKUP_S3_SECRET_ACCESS_KEY",
    "BACKUP_ENCRYPTION_KEY",
  ].every((k) => !!process.env[k]);
function key() {
  const k = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32)
    throw Error("BACKUP_ENCRYPTION_KEY requires 32-byte base64");
  return k;
}
export function backupClient() {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  if (!endpoint?.startsWith("https://"))
    throw Error("Backup endpoint requires HTTPS");
  return new S3Client({
    endpoint,
    region: process.env.BACKUP_S3_REGION || "auto",
    forcePathStyle: process.env.BACKUP_S3_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
    },
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: { requestTimeout: 60000, connectionTimeout: 10000 },
  });
}
export async function encryptBackup(source, target) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(MAGIC);
  const file = await open(target, "wx", 0o600);
  await file.write(Buffer.concat([MAGIC, iv]));
  await file.close();
  try {
    await pipeline(
      createReadStream(source),
      cipher,
      createWriteStream(target, { flags: "a", mode: 0o600 }),
    );
    await appendFile(target, cipher.getAuthTag());
  } catch (e) {
    await rm(target, { force: true });
    throw e;
  }
  return target;
}
export async function decryptBackup(source, target) {
  const size = (await stat(source)).size;
  if (size < 36) throw Error("Invalid backup");
  const f = await open(source, "r"),
    header = Buffer.alloc(20),
    tag = Buffer.alloc(16);
  try {
    await f.read(header, 0, 20, 0);
    await f.read(tag, 0, 16, size - 16);
  } finally {
    await f.close();
  }
  if (!header.subarray(0, 8).equals(MAGIC))
    throw Error("Unknown backup format");
  const decipher = createDecipheriv("aes-256-gcm", key(), header.subarray(8));
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  const out = await open(target, "wx", 0o600);
  await out.close();
  try {
    await pipeline(
      createReadStream(source, { start: 20, end: size - 17 }),
      decipher,
      createWriteStream(target, { flags: "a", mode: 0o600 }),
    );
  } catch (e) {
    await rm(target, { force: true });
    throw e;
  }
  return target;
}
export const backupState = {
  configured: false,
  lastSuccess: null,
  lastAttempt: null,
  error: null,
  key: null,
};
export async function uploadOffsite(source) {
  backupState.configured = offsiteConfigured();
  if (!backupState.configured) return;
  backupState.lastAttempt = new Date().toISOString();
  const objectKey =
    (process.env.BACKUP_S3_PREFIX || "rainy-office").replace(/^\/+|\/+$/g, "") +
    "/" +
    source.split("/").pop() +
    ".enc";
  if (backupState.key === objectKey && backupState.lastSuccess) return;
  const temp = source + "." + randomBytes(6).toString("hex") + ".enc",
    client = backupClient();
  try {
    await encryptBackup(source, temp);
    const sha = createHash("sha256");
    for await (const chunk of createReadStream(temp)) sha.update(chunk);
    const checksum = sha.digest("hex"),
      size = (await stat(temp)).size;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: objectKey,
        Body: createReadStream(temp),
        ContentLength: size,
        ContentType: "application/octet-stream",
        Metadata: { sha256: checksum, format: "rainyb1-aes256gcm" },
      }),
    );
    const check = await client.send(
      new HeadObjectCommand({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: objectKey,
      }),
    );
    if (check.ContentLength !== size || check.Metadata?.sha256 !== checksum)
      throw Error("Offsite verification failed");
    // Verify a real remote download and authenticated restore before reporting success.
    const remote = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: objectKey,
      }),
    );
    await pipeline(
      remote.Body,
      createWriteStream(temp + ".verify", { flags: "wx", mode: 0o600 }),
    );
    await decryptBackup(temp + ".verify", temp + ".restore");
    const restored = new DatabaseSync(temp + ".restore", { readOnly: true });
    try {
      if (restored.prepare("PRAGMA quick_check").get().quick_check !== "ok")
        throw Error("Remote restore integrity failed");
    } finally {
      restored.close();
    }
    Object.assign(backupState, {
      lastSuccess: new Date().toISOString(),
      error: null,
      key: objectKey,
    });
    console.log(
      "Encrypted offsite backup uploaded, downloaded and restore verified",
    );
  } catch (e) {
    backupState.error = "Тусдаа backup илгээж чадсангүй";
    throw e;
  } finally {
    client.destroy();
    await rm(temp, { force: true });
    await rm(temp + ".verify", { force: true });
    await rm(temp + ".restore", { force: true });
  }
}
export async function downloadOffsite(objectKey, target) {
  if (
    !objectKey.startsWith(
      (process.env.BACKUP_S3_PREFIX || "rainy-office") + "/",
    )
  )
    throw Error("Backup key outside configured prefix");
  const client = backupClient();
  try {
    const data = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: objectKey,
      }),
    );
    await pipeline(
      data.Body,
      createWriteStream(target, { flags: "wx", mode: 0o600 }),
    );
  } finally {
    client.destroy();
  }
}
