import { beforeEach, describe, expect, it } from "vitest";
import { getPlaceHazards, primaryToken } from "../src/environments/places.ts";
import { installGame } from "./support/fakes.ts";

const MODULE_ID = "sf2e-enhanced-environmental-protection";
const BEHAVIOR = `${MODULE_ID}.environment`;

let scenes: any[];

function scene(name: string, active: boolean, environments?: string[]) {
    const s = { name, active, flags: environments ? { [MODULE_ID]: { environments } } : {}, tokens: { contents: [] as any[] } };
    scenes.push(s);
    return s;
}

const behavior = (system: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    name: "",
    type: BEHAVIOR,
    disabled: false,
    system: { ...system, environments: new Set(system.environments as string[]) },
    ...extra,
});

const region = (...behaviors: unknown[]) => ({ name: "Region", flags: {}, tokens: new Set(), behaviors });

function token(s: any, actorId: string, regions: unknown[] = [], actorLink = true) {
    const t = { actorId, actorLink, actor: null, parent: s, regions: new Set(regions) };
    s.tokens.contents.push(t);
    return t;
}

const actor = (id: string, ownToken: unknown = null) => ({ id, token: ownToken }) as any;

// "key" or "key(Nh)", sorted.
const keys = (a: any) =>
    getPlaceHazards(a)
        .map((h) => h.environment + (h.limitedDuration ? `(${h.limitedDuration}h)` : ""))
        .sort();

describe("places", () => {
    beforeEach(() => {
        scenes = [];
        installGame({ scenes });
    });

    it("scene", () => {
        token(scene("Station", true, ["thin"]), "a");
        expect(keys(actor("a"))).toEqual(["thin"]);
    });

    it("region modes", () => {
        const station = scene("Station", true, ["thin"]);
        token(station, "add", [region(behavior({ environments: ["vacuum"], mode: "add", limitedDuration: 2 }))]);
        token(station, "remove", [region(behavior({ environments: ["thin"], mode: "remove" }))]);
        token(station, "all", [
            region(behavior({ environments: ["vacuum"], mode: "add" })),
            region(behavior({ environments: ["thin", "vacuum"], mode: "remove" })),
            region(behavior({ environments: ["underwater"], mode: "override" })),
        ]);
        expect(keys(actor("add"))).toEqual(["thin", "vacuum(2h)"]);
        expect(keys(actor("remove"))).toEqual([]);
        // Override replaces the scene's thin, then add vacuum, then remove thin and vacuum.
        expect(keys(actor("all"))).toEqual(["underwater"]);
    });

    it("ignored behaviors", () => {
        token(scene("Station", true, ["thin"]), "a", [
            region(
                behavior({ environments: ["vacuum"], mode: "add" }, { disabled: true }),
                { name: "", type: "pauseGame", disabled: false, system: {} },
                behavior({ environments: ["Not Valid!", "toxic"], mode: "add" }),
            ),
        ]);
        expect(keys(actor("a"))).toEqual(["thin", "toxic"]);
    });

    describe("primaryToken", () => {
        it("active scene", () => {
            token(scene("Ship", false, ["vacuum"]), "a");
            const station = scene("Station", true, ["thin"]);
            token(station, "a");
            expect(primaryToken(actor("a"))?.parent).toBe(station);
        });

        it("only token", () => {
            token(scene("Ship", false, ["vacuum"]), "a");
            expect(keys(actor("a"))).toEqual(["vacuum"]);
        });

        it("ambiguous", () => {
            token(scene("Ship", false), "a");
            token(scene("Planet", false), "a");
            expect(primaryToken(actor("a"))).toBeNull();
        });

        it("unlinked", () => {
            const planet = scene("Planet", false, ["heat:mild"]);
            const own = token(planet, "npc", [], false);
            expect(keys(actor("npc", own))).toEqual(["heat:mild"]);
        });
    });
});
