// Download, authenticate and validate into a NEW path. Never touches the live database.
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { downloadOffsite, decryptBackup } from "../lib/offsite.mjs";
const [objectKey, destination] = process.argv.slice(2);
if (!objectKey || !destination)
  throw Error(
    "Usage: node scripts/restore-backup.mjs <object-key> <new-output.sqlite>",
  );
const output = resolve(destination),
  encrypted = output + ".download.enc";
if (output === resolve(process.env.DB_PATH || "data/office.sqlite"))
  throw Error("Refusing to overwrite live database");
let downloaded = false,
  decrypted = false;
try {
  await downloadOffsite(objectKey, encrypted);
  downloaded = true;
  await decryptBackup(encrypted, output);
  decrypted = true;
  const db = new DatabaseSync(output, { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Restore integrity check failed");
    console.log(
      "Backup authenticated, restored and SQLite integrity verified:",
      output,
    );
  } finally {
    db.close();
  }
} catch (e) {
  if (decrypted) await rm(output, { force: true });
  throw e;
} finally {
  if (downloaded) await rm(encrypted, { force: true });
}
