// Compile the JSON sources in packs-src/<pack> into Foundry LevelDB compendiums in packs/<pack>.
// Foundry locks a world's compendiums while it runs: return to setup before building.
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { readdirSync, rmSync } from "node:fs";

for (const pack of readdirSync("packs-src")) {
    rmSync(`packs/${pack}`, { recursive: true, force: true });
    await compilePack(`packs-src/${pack}`, `packs/${pack}`, { log: true });
}
