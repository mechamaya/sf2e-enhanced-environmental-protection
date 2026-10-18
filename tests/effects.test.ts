import { beforeEach, describe, expect, it } from "vitest";
import { getActivePreset } from "../src/rules/presets.ts";
import { syncEffects } from "../src/state/effects.ts";
import { effectsWithRole, fakeActor, fakeArmor, hazardRule, installGame } from "./support/fakes.ts";

const MODULE_ID = "sf2e-enhanced-environmental-protection";
const sync = (actor: any) => syncEffects(actor, getActivePreset());

describe("effects", () => {
    beforeEach(() => installGame({ worldTime: 1000 }));

    describe("unprotected", () => {
        it("added and removed", async () => {
            const actor = fakeActor({ rules: [hazardRule("vacuum"), hazardRule("cold:extreme")] });
            await sync(actor);
            const [effect] = effectsWithRole(actor, "unprotected");
            expect(effect).toMatchObject({ id: "sf2eepUnprotectd", name: "Unprotected: Vacuum, Extreme Cold" });

            actor.rules = [];
            await sync(actor);
            expect(effectsWithRole(actor, "unprotected")).toHaveLength(0);
        });

        it("removes duplicates", async () => {
            const actor = fakeActor({ rules: [hazardRule("vacuum")] });
            for (const id of ["oldCopy00000001a", "oldCopy00000002a"]) {
                actor._items.set(id, actor._makeEffect({ _id: id, flags: { [MODULE_ID]: { role: "unprotected" } }, system: {} }));
            }
            await sync(actor);
            expect(effectsWithRole(actor, "unprotected")).toHaveLength(1);
        });

        it("party and loot actors", async () => {
            const party = fakeActor({ type: "party", rules: [hazardRule("vacuum")] });
            await sync(party);
            expect(party.operations).toHaveLength(0);
        });
    });

    describe("concurrent syncs", () => {
        // Foundry writes into the options object it's given, so a shared one sent operations to the wrong actor.
        it("one effect per actor", async () => {
            const actors = Array.from({ length: 5 }, (_, i) => fakeActor({ name: `Token ${i}`, rules: [hazardRule("vacuum")] }));

            await Promise.all(actors.map(sync));
            for (const actor of actors) expect(effectsWithRole(actor, "unprotected")).toHaveLength(1);

            for (const actor of actors) actor.rules = [];
            await Promise.all(actors.map(sync));
            for (const actor of actors) expect(effectsWithRole(actor, "unprotected")).toHaveLength(0);
        });

        it("fresh options objects", async () => {
            const actors = Array.from({ length: 3 }, () => fakeActor({ rules: [hazardRule("vacuum")] }));
            await Promise.all(actors.map(sync));
            for (const actor of actors) actor.rules = [];
            await Promise.all(actors.map(sync));

            const all = actors.flatMap((a) => a.operations);
            expect(all.length).toBeGreaterThan(0);
            expect(new Set(all).size).toBe(all.length);
        });
    });

    describe("protection", () => {
        it("off effect", async () => {
            const armor = fakeArmor({ level: 3 });
            const actor = fakeActor({ armor, rules: [hazardRule("vacuum")] });
            await sync(actor);
            expect(effectsWithRole(actor, "protection-off")).toHaveLength(1);
            expect(effectsWithRole(actor, "unprotected")).toHaveLength(1);

            actor.rules = [];
            await sync(actor);
            expect(effectsWithRole(actor, "protection-off")).toHaveLength(0);
        });

        it("countdown and badge", async () => {
            const armor = fakeArmor({ level: 3 });
            armor.flags[MODULE_ID] = {
                charges: { reserve: 2, current: 0.5, active: true, hoursPerCharge: 4, settledAt: 1000 },
            };
            const actor = fakeActor({ armor, rules: [hazardRule("vacuum")] });
            await sync(actor);

            const on = effectsWithRole(actor, "protection-on")[0]!;
            const { duration, start, badge } = on.system;
            expect(duration.unit).toBe("rounds");
            // Half of a 4-hour charge is 2 hours: the effect must end exactly then.
            expect(start.value + duration.value * 6).toBe(1000 + 2 * 3600);
            expect(badge).toMatchObject({ value: 2, min: 2, max: 2 });
            expect(effectsWithRole(actor, "unprotected")).toHaveLength(0);
        });
    });
});
