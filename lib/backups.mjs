import { backup, DatabaseSync } from "node:sqlite";
import { mkdir, readdir, rm, chmod, stat, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
export async function createBackup(db, dbPath, { refresh = false } = {}) {
  const folder = join(dirname(dbPath), "backups");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const filename =
    "office-" + new Date().toISOString().slice(0, 10) + ".sqlite";
  const path = join(folder, filename);
  if (!refresh)
    try {
      await stat(path);
      return path;
    } catch {}
  const pending = path + ".pending";
  await rm(pending, { force: true });
  await backup(db, pending);
  await chmod(pending, 0o600);
  const check = new DatabaseSync(pending, { readOnly: true });
  try {
    if (check.prepare("PRAGMA quick_check").get().quick_check !== "ok")
      throw Error("Backup integrity check failed");
  } finally {
    check.close();
  }
  await rename(pending, path);
  const files = (await readdir(folder))
    .filter((f) => /^office-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f))
    .sort()
    .reverse();
  for (const old of files.slice(3)) await rm(join(folder, old));
  return path;
}
