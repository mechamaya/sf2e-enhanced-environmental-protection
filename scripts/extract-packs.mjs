// Reverse of build-packs.mjs: packs/ (or the folder given) back into packs-src/. Run from setup, not in a world.
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { readdirSync } from "node:fs";
import path from "node:path";

const from = process.argv[2] ?? "packs";

const sluggify = (text) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

// Edit times and versions only add noise to diffs.
function stripStats(doc) {
    if (Array.isArray(doc)) return doc.forEach(stripStats);
    if (!doc || typeof doc !== "object") return;
    delete doc._stats;
    for (const value of Object.values(doc)) if (Array.isArray(value)) stripStats(value);
}

for (const pack of readdirSync(from)) {
    // Duplicate names get the id appended.
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
        // `_key` next to `_id`, as in the hand-written sources.
        transformSerialized: (content) => {
            const { _id, _key, ...rest } = JSON.parse(content);
            return `${JSON.stringify({ _id, _key, ...rest }, null, 4)}\n`;
        },
    });
}
