import path from "node:path";
import { openFsdb, listFsdbEntries } from "../../loom-realm/packages/fsdb/dist/index.js";

function containerDatabase(fsdbDirectory) {
  const base = path.basename(fsdbDirectory);
  const match = /^\[FSDB\](.+)$/i.exec(base);
  if (!match) throw new Error(`expected an [FSDB] directory, got ${fsdbDirectory}`);
  return { root: path.dirname(fsdbDirectory), path: match[1] };
}

const root = process.argv[2];
const db = await openFsdb(containerDatabase(root));
const entries = listFsdbEntries(db);
const counts = new Map();
for (const entry of entries) {
  const label = `${entry.identity.kind}.${entry.identity.table}`;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}
console.log(JSON.stringify({
  name: db.name,
  entries: entries.length,
  tables: Object.fromEntries([...counts.entries()].sort()),
}, null, 2));
await db.close();
console.log("OPEN_FSDB_OK");
