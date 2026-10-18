import { beforeEach, describe, expect, it } from "vitest";
import { MODULE_ID } from "../src/constants.ts";
import { buildCard, buildSummary, foldCovered, isRelevant, relevanceKey } from "../src/panel/card.ts";
import { getActivePreset } from "../src/rules/presets.ts";
import { fakeActor, fakeArmor, hazardRule, installGame } from "./support/fakes.ts";

const H = 3600;
const card = (actor: any) => buildCard(actor, getActivePreset());

// state null: never used, so full.
function wearer(state: Record<string, unknown> | null, hazards: string[] = []) {
    const armor = fakeArmor({ level: 4 });
    if (state) armor.flags[MODULE_ID] = { charges: { hoursPerCharge: 24, settledAt: 0, ...state } };
    return fakeActor({ armor, rules: hazards.map((h) => hazardRule(h)) });
}

describe("card", () => {
    beforeEach(() => installGame({ worldTime: 0 }));

    it("while on", () => {
        const view = card(wearer({ reserve: 2, current: 0.5, active: true }, ["vacuum"]));
        expect(view.charges).toMatchObject({ active: true, bar: 0.5, time: "12h", charges: "2" });
        expect(view.environments).toEqual([
            expect.objectContaining({ key: "vacuum", level: "full", icon: "fa-solid fa-user-astronaut", tooltip: "Vacuum: protected" }),
        ]);
        expect(isRelevant(view)).toBe(true);
    });

    it("rounds under a minute", () => {
        const view = card(wearer({ reserve: 0, current: 30 / (24 * H), active: true }));
        expect(view.charges?.time).toBe("5 rnd");
    });

    it("while off", () => {
        const view = card(wearer({ reserve: 3, current: 0, active: false }, ["vacuum", "spore-cloud:dense"]));
        expect(view.charges).toMatchObject({ active: false, bar: 0.75, time: "3d", charges: "3/4" });
        expect(view.environments.map((e) => [e.level, e.icon])).toEqual([
            ["none", "fa-solid fa-user-astronaut"],
            ["none", "fa-solid fa-triangle-exclamation"],
        ]);
    });

    it("limited coverage", () => {
        installGame({ worldTime: 0, settings: { limitedProtection: true } });
        const view = card(wearer({ reserve: 3, current: 1, active: true }, ["vacuum"]));
        expect(view.environments[0]).toMatchObject({ level: "limited", hours: 4 });
    });

    it("no protective armor", () => {
        const view = card(fakeActor({ rules: [hazardRule("toxic")] }));
        expect(view.charges).toBeNull();
        expect(view.environments[0]).toMatchObject({ key: "toxic", level: "none", icon: "fa-solid fa-biohazard" });
    });

    it("relevance", () => {
        const actor = wearer(null);
        const quiet = card(actor);
        expect(isRelevant(quiet)).toBe(false);
        actor.rules = [hazardRule("vacuum")];
        expect(relevanceKey(card(actor))).not.toBe(relevanceKey(quiet));
    });

    it("party summary order", () => {
        const safe = wearer({ reserve: 2, current: 1, active: true }, ["vacuum"]);
        const quiet = wearer(null);
        const exposed = fakeActor({ name: "Exposed", rules: [hazardRule("toxic")] });
        const summary = buildSummary([safe, quiet, exposed], getActivePreset());
        expect(summary.members.map((m) => m.uuid)).toEqual([exposed.uuid, safe.uuid, quiet.uuid]);
        expect(summary.exposed).toBe(1);
    });

    describe("foldCovered", () => {
        const chip = (key: string, level: string) => ({ key, name: key, icon: "", level, hours: null, tooltip: "" }) as any;
        const keys = (chips: any[]) => chips.map((c) => c.key);

        it("keeps all when they fit", () => {
            const chips = [chip("a", "full"), chip("b", "full"), chip("c", "none")];
            expect(foldCovered(chips)).toEqual({ shown: chips, covered: [] });
        });

        it("folds full ones", () => {
            const chips = [chip("a", "full"), chip("b", "none"), chip("c", "full"), chip("d", "limited"), chip("e", "none")];
            const { shown, covered } = foldCovered(chips);
            expect([keys(shown), keys(covered)]).toEqual([["b", "d", "e"], ["a", "c"]]);
        });

        it("skips a single full one", () => {
            const chips = [chip("a", "full"), chip("b", "none"), chip("c", "none"), chip("d", "none")];
            expect(foldCovered(chips).covered).toEqual([]);
        });
    });
});
