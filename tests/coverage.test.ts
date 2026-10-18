import { beforeEach, describe, expect, it } from "vitest";
import { profileArmor, summarizeCoverage } from "../src/rules/coverage.ts";
import { getActivePreset } from "../src/rules/presets.ts";
import type { Hazard, Protection } from "../src/rules/types.ts";
import { fakeArmor, installGame } from "./support/fakes.ts";

const hazard = (environment: string, limitedDuration: number | null = null): Hazard => ({ environment, limitedDuration });

// "level" or "limited:<hours>" per environment.
function cover(options: { settings?: Record<string, boolean>; armor?: any; hazards: Hazard[]; protections?: Protection[] }) {
    installGame({ settings: options.settings });
    const preset = getActivePreset();
    const profile = options.armor ? profileArmor(options.armor) : null;
    const summary = summarizeCoverage(options.hazards, profile, options.protections ?? [], preset);
    const levels = Object.fromEntries(
        summary.perHazard.map(({ hazard: h, coverage: c }) => [
            h.environment,
            c.level === "limited" ? `limited:${c.hoursPerCharge}` : c.level,
        ]),
    );
    return { levels, hoursPerCharge: summary.hoursPerCharge, exposedTo: summary.exposedTo.map((h) => h.environment) };
}

const LIMITED = { limitedProtection: true };

describe("coverage", () => {
    beforeEach(() => installGame());

    describe("base armor", () => {
        it("Player Core", () => {
            const { levels } = cover({
                armor: fakeArmor(),
                hazards: ["thin", "thick", "vacuum", "underwater"].map((e) => hazard(e)),
            });
            expect(levels).toEqual({ thin: "full", thick: "full", vacuum: "full", underwater: "full" });
        });

        it("needs upgrades", () => {
            const { exposedTo } = cover({
                armor: fakeArmor(),
                hazards: ["toxic", "radiation", "cold:mild"].map((e) => hazard(e)),
            });
            expect(exposedTo).toEqual(["toxic", "radiation", "cold:mild"]);
        });

        it("limited protection", () => {
            const result = cover({
                settings: LIMITED,
                armor: fakeArmor(),
                hazards: ["thin", "vacuum", "underwater", "thin:severe"].map((e) => hazard(e)),
            });
            expect(result.levels).toEqual({
                thin: "full",
                vacuum: "limited:4",
                underwater: "limited:1",
                "thin:severe": "limited:4",
            });
            expect(result.hoursPerCharge).toBe(1);
        });

        it("limitedDuration override", () => {
            const { levels } = cover({ settings: LIMITED, armor: fakeArmor(), hazards: [hazard("vacuum", 2)] });
            expect(levels.vacuum).toBe("limited:2");
        });

        it("limitedDuration ignored", () => {
            const { exposedTo } = cover({ armor: fakeArmor(), hazards: [hazard("spore-cloud", 6)] });
            expect(exposedTo).toEqual(["spore-cloud"]);
        });
    });

    describe("Exposed armor", () => {
        it("no protection", () => {
            const { exposedTo } = cover({
                armor: fakeArmor({ traits: ["tech", "exposed"], upgrades: ["Thermal Capacitor (Tactical)"] }),
                hazards: [hazard("vacuum"), hazard("cold:severe")],
            });
            expect(exposedTo).toEqual(["vacuum", "cold:severe"]);
        });

        it("with Basic Environmental Protection", () => {
            const { levels } = cover({
                armor: fakeArmor({
                    traits: ["tech", "exposed"],
                    upgrades: ["Basic Environmental Protection", "Thermal Capacitor (Tactical)"],
                }),
                hazards: [hazard("vacuum"), hazard("cold:severe")],
            });
            expect(levels).toEqual({ vacuum: "full", "cold:severe": "full" });
        });

        it("Pathfinder armor", () => {
            const { exposedTo } = cover({ armor: fakeArmor({ traits: [] }), hazards: [hazard("thin")] });
            expect(exposedTo).toEqual(["thin"]);
        });
    });

    describe("system upgrades", () => {
        it("by grade", () => {
            const { levels } = cover({
                armor: fakeArmor({ upgrades: ["Filtered Rebreather (Tactical)", "Thermal Capacitor (Advanced)"] }),
                hazards: ["toxic", "toxic:severe", "cold:extreme", "cold:incredible", "heat:extreme", "heat:incredible"].map(
                    (e) => hazard(e),
                ),
            });
            expect(levels).toEqual({
                toxic: "full",
                "toxic:severe": "none",
                "cold:extreme": "full",
                "cold:incredible": "none",
                "heat:extreme": "full",
                "heat:incredible": "none",
            });
        });

        it("resistance only", () => {
            const { exposedTo } = cover({
                armor: fakeArmor({ upgrades: ["Radiation Buffer (Tactical)", "Energy Shielding (Commercial)"] }),
                hazards: [hazard("radiation"), hazard("corrosive")],
            });
            expect(exposedTo).toEqual(["radiation", "corrosive"]);
        });
    });

    describe("EnvironmentalProtection rule elements", () => {
        const fas: Protection = { environment: "vacuum", level: "full", hoursPerCharge: null, source: "armor", label: "FAS" };

        it("full beats limited", () => {
            const { levels, hoursPerCharge } = cover({
                settings: LIMITED,
                armor: fakeArmor(),
                hazards: [hazard("vacuum")],
                protections: [fas],
            });
            expect(levels.vacuum).toBe("full");
            expect(hoursPerCharge).toBe(24);
        });

        it("armor source", () => {
            const { exposedTo } = cover({
                armor: fakeArmor({ traits: ["tech", "exposed"] }),
                hazards: [hazard("vacuum")],
                protections: [fas],
            });
            expect(exposedTo).toEqual(["vacuum"]);
        });

        it("innate source", () => {
            const innate: Protection = { ...fas, environment: "spore-cloud", level: "limited", hoursPerCharge: 2, source: "innate" };
            const { levels, hoursPerCharge } = cover({ armor: fakeArmor(), hazards: [hazard("spore-cloud")], protections: [innate] });
            expect(levels["spore-cloud"]).toBe("limited:2");
            expect(hoursPerCharge).toBe(24);
            expect(cover({ hazards: [hazard("vacuum")], protections: [{ ...fas, source: "innate" }] }).levels.vacuum).toBe("full");
        });

        it("longer limited wins", () => {
            const tank: Protection = { ...fas, level: "limited", hoursPerCharge: 8 };
            const { levels } = cover({ settings: LIMITED, armor: fakeArmor(), hazards: [hazard("vacuum")], protections: [tank] });
            expect(levels.vacuum).toBe("limited:8");
        });
    });
});
