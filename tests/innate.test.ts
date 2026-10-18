import { beforeEach, describe, expect, it } from "vitest";
import { getActorCoverage } from "../src/state/armor-state.ts";
import { getActivePreset } from "../src/rules/presets.ts";
import { fakeActor, hazardRule, installGame } from "./support/fakes.ts";

function coverage(data: Parameters<typeof fakeActor>[0], environments: string[]) {
    const actor = fakeActor({ ...data, rules: environments.map((e) => hazardRule(e)) });
    const { perHazard } = getActorCoverage(actor, getActivePreset(), false);
    return Object.fromEntries(perHazard.map(({ hazard, coverage: c }) => [hazard.environment, c.level]));
}

const BREATHING = ["vacuum", "thin:severe", "thick:severe", "underwater", "toxic", "toxic:severe", "smoke", "cold:extreme"];

describe("innate", () => {
    describe("Player Core", () => {
        beforeEach(() => installGame());

        it("cosmic", () => {
            expect(coverage({ traits: ["cosmic"] }, ["vacuum", "thin"])).toEqual({ vacuum: "full", thin: "none" });
            expect(coverage({ features: [["feat", "Astrowanderer"]] }, ["vacuum"])).toEqual({ vacuum: "full" });
        });

        it("Constructed", () => {
            expect(coverage({ features: [["feat", "Constructed"]] }, ["thin", "vacuum", "underwater", "toxic"])).toEqual({
                thin: "full",
                vacuum: "full",
                underwater: "full",
                toxic: "none",
            });
        });

        it("Techentu", () => {
            const c = coverage({ features: [["feat", "Techentu"]] }, ["heat:extreme", "cold:incredible"]);
            expect(c).toEqual({ "heat:extreme": "full", "cold:incredible": "none" });
        });

        it("undead and borai", () => {
            expect(coverage({ traits: ["undead", "borai"] }, ["thin"])).toEqual({ thin: "none" });
            expect(coverage({ traits: ["undead"] }, ["thin"])).toEqual({ thin: "full" });
        });
    });

    describe("Enhanced Rules", () => {
        beforeEach(() => installGame({ settings: { ancestryProtection: true } }));

        it("non-breathers", () => {
            expect(coverage({ traits: ["construct"] }, BREATHING)).toEqual({
                vacuum: "full",
                "thin:severe": "full",
                "thick:severe": "full",
                underwater: "full",
                toxic: "full",
                "toxic:severe": "none",
                smoke: "none",
                "cold:extreme": "none",
            });
        });

        it("Constructed", () => {
            const c = coverage({ features: [["feat", "Constructed"]] }, ["vacuum", "thick:severe", "underwater"]);
            expect(c).toEqual({ vacuum: "full", "thick:severe": "full", underwater: "none" });
        });

        it("cosmic", () => {
            expect(coverage({ traits: ["cosmic"] }, ["thin:severe"])).toEqual({ "thin:severe": "full" });
        });
    });
});
