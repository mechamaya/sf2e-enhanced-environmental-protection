import { beforeEach, describe, expect, it } from "vitest";
import { applyEnvironment, removeEnvironment } from "../src/gm/environment-tool.ts";
import { compendiumEffect, fakeActor, installGame } from "./support/fakes.ts";

const PACK = "sf2e-enhanced-environmental-protection.environments";
const hazard = (environment: string) => ({ key: "EnvironmentalHazard", environment });

const environmentsOf = (actor: any): string[] =>
    actor.itemTypes.effect.flatMap((e: any) =>
        (e.system.rules ?? []).filter((r: any) => r.key === "EnvironmentalHazard").map((r: any) => r.environment),
    );

describe("environment tool", () => {
    beforeEach(() => {
        installGame({
            packs: {
                [PACK]: [
                    compendiumEffect("vacuumEffect0001", "Environment: Vacuum", [
                        hazard("vacuum"),
                        { key: "RollOption", option: "terrain:vacuum" },
                    ]),
                ],
            },
        });
    });

    it("compendium effect", async () => {
        const actor = fakeActor();
        expect(await applyEnvironment("vacuum", [actor])).toBe(1);
        const [effect] = actor.itemTypes.effect;
        expect(effect.name).toBe("Environment: Vacuum");
        expect(effect.system.rules).toContainEqual({ key: "RollOption", option: "terrain:vacuum" });
        expect(effect.id).not.toBe("vacuumEffect0001");
    });

    it("custom key", async () => {
        const actor = fakeActor();
        await applyEnvironment("spore-cloud:dense", [actor]);
        const [effect] = actor.itemTypes.effect;
        expect(effect.name).toBe("Environment: Spore Cloud (Dense)");
        expect(environmentsOf(actor)).toEqual(["spore-cloud:dense"]);
    });

    it("skips and rejects", async () => {
        const [inVacuum, fresh] = [fakeActor(), fakeActor()];
        await applyEnvironment("vacuum", [inVacuum]);
        expect(await applyEnvironment("vacuum", [inVacuum, fresh])).toBe(1);
        expect(environmentsOf(inVacuum)).toEqual(["vacuum"]);
        expect(await applyEnvironment("Not Valid!", [fresh])).toBe(0);
        expect((globalThis as any).game.notices.at(-1)).toMatchObject({ level: "warn" });
    });

    it("remove", async () => {
        const actors = [fakeActor(), fakeActor(), fakeActor()];
        await applyEnvironment("vacuum", actors);
        await applyEnvironment("toxic", actors);
        expect(await removeEnvironment("vacuum", actors)).toBe(3);
        for (const actor of actors) expect(environmentsOf(actor)).toEqual(["toxic"]);
        expect(await removeEnvironment("vacuum", actors)).toBe(0);
    });
});
