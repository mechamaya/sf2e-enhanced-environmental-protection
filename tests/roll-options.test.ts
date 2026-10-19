import { beforeEach, describe, expect, it } from "vitest";
import { getHazards, getProtections, HAZARD_PREFIX, parseOption } from "../src/rules/roll-options.ts";
import { fakeActor, hazardRule, installGame, protectionRule } from "./support/fakes.ts";

describe("roll options", () => {
    beforeEach(() => installGame());

    it("parses keys, qualifiers and limited hours", () => {
        expect(parseOption("environment:vacuum", HAZARD_PREFIX)).toEqual({ environment: "vacuum", hours: null });
        expect(parseOption("environment:thick:severe:limited:4", HAZARD_PREFIX)).toEqual({ environment: "thick:severe", hours: 4 });
        expect(parseOption("environment:vacuum:limited:0", HAZARD_PREFIX)).toBeNull();
        expect(parseOption("environment:Vacuum", HAZARD_PREFIX)).toBeNull();
        expect(parseOption("terrain:vacuum", HAZARD_PREFIX)).toBeNull();
    });

    it("hazards: a limited option also counts as the environment", () => {
        const actor = fakeActor({ rules: [hazardRule("vacuum"), hazardRule("vacuum", 4), hazardRule("toxic")] });
        expect(getHazards(actor)).toEqual([
            { environment: "vacuum", limitedDuration: 4 },
            { environment: "toxic", limitedDuration: null },
        ]);
    });

    it("protections: source from the item, label from its name, ignored rules skipped", () => {
        const upgrade = { type: "upgrade", name: "Filtered Air Supply", parentItem: { type: "armor" } };
        const feat = { type: "feat", name: "Gill Breather" };
        const ignored = { ...protectionRule("smoke"), ignored: true };
        const actor = fakeActor({ rules: [protectionRule("vacuum", 4, upgrade), protectionRule("underwater", null, feat), ignored] });
        expect(getProtections(actor)).toEqual([
            { environment: "vacuum", level: "limited", hoursPerCharge: 4, source: "armor", label: "Filtered Air Supply" },
            { environment: "underwater", level: "full", hoursPerCharge: null, source: "innate", label: "Gill Breather" },
        ]);
    });
});
