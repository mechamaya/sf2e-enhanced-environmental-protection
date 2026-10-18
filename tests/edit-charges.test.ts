import { beforeEach, describe, expect, it } from "vitest";
import { MODULE_ID } from "../src/constants.ts";
import { setCharges } from "../src/edit-charges.ts";
import { getStoredState } from "../src/state/armor-state.ts";
import { withTotal, type ChargeState } from "../src/state/charges.ts";
import { fakeActor, fakeArmor, installGame } from "./support/fakes.ts";

const state = (reserve: number, current: number, active: boolean): ChargeState => ({
    reserve,
    current,
    active,
    hoursPerCharge: 24,
    settledAt: 0,
});

describe("edit charges", () => {
    beforeEach(() => installGame());

    it("while off", () => {
        expect(withTotal(state(1, 0, false), 2.5, 10)).toMatchObject({ reserve: 2, current: 0.5, active: false });
        expect(withTotal(state(1, 0, false), 99, 10)).toMatchObject({ reserve: 10, current: 0 });
    });

    it("while on", () => {
        expect(withTotal(state(1, 0.2, true), 2.5, 10)).toMatchObject({ reserve: 2, current: 0.5, active: true });
        expect(withTotal(state(1, 0.2, true), 3, 10)).toMatchObject({ reserve: 2, current: 1, active: true });
        expect(withTotal(state(1, 0.2, true), 0, 10)).toMatchObject({ reserve: 0, current: 0, active: false });
    });

    it("setCharges", async () => {
        const actor = fakeActor({ armor: fakeArmor({ level: 4 }) });
        await setCharges(2, actor);
        expect(getStoredState(actor.wornArmor)).toMatchObject({ reserve: 2, current: 0 });

        actor.wornArmor.isOwner = false;
        await setCharges(1, actor);
        expect(actor.wornArmor.flags[MODULE_ID].charges.reserve).toBe(2);
    });
});
