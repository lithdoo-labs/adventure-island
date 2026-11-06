import { openFsdb, listFsdbEntries } from "../../loom-realm/packages/fsdb/dist/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "[FSDB]cms");
const db = await openFsdb({ root });
const entries = listFsdbEntries(db);
const counts = new Map();
for (const entry of entries) {
  const id = entry.identity;
  const label = `${id.kind}.${id.table}`;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}
const summary = Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
console.log(JSON.stringify({ name: db.name, entries: entries.length, tablesWithRows: summary }, null, 2));
await db.close();
console.log("OPEN_FSDB_OK");
