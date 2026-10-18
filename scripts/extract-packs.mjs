// Extract the Foundry LevelDB compendiums in packs/<pack> (or another packs folder given as an argument) back into
// JSON sources in packs-src/<pack>, after editing them in Foundry. The reverse of build-packs.mjs.
// Foundry locks a world's compendiums while it runs: return to setup before extracting.
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { readdirSync } from "node:fs";
import path from "node:path";

const from = process.argv[2] ?? "packs";

const sluggify = (text) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

/** Drop `_stats` (edit times, versions) from a document and its embedded documents, so diffs show only real changes. */
function stripStats(doc) {
    if (Array.isArray(doc)) return doc.forEach(stripStats);
    if (!doc || typeof doc !== "object") return;
    delete doc._stats;
    for (const value of Object.values(doc)) if (Array.isArray(value)) stripStats(value);
}

for (const pack of readdirSync(from)) {
    // A name used twice in one pack gets its id appended, so neither file overwrites the other.
    const used = new Set();
    await extractPack(path.join(from, pack), `packs-src/${pack}`, {
        clean: true,
        log: true,
        jsonOptions: { space: 4 },
        transformEntry: (doc) => stripStats(doc),
        transformName: (doc) => {
            let name = sluggify(doc.name ?? doc._id);
            if (used.has(name)) name = `${name}-${doc._id}`;
            used.add(name);
            return `${name}.json`;
        },
        // Keep `_key` next to `_id`, where the hand-written sources have it.
        transformSerialized: (content) => {
            const { _id, _key, ...rest } = JSON.parse(content);
            return `${JSON.stringify({ _id, _key, ...rest }, null, 4)}\n`;
        },
    });
}
