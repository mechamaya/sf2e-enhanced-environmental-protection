import { beforeEach, describe, expect, it } from "vitest";
import { MODULE_ID } from "../src/constants.ts";
import { getStoredState } from "../src/state/armor-state.ts";
import { performTransfer } from "../src/transfer.ts";
import { fakeActor, fakeArmor, installGame } from "./support/fakes.ts";

const users = () => (globalThis as any).game.users;
const reserveOf = (actor: any) => getStoredState(actor.wornArmor)?.reserve;

function wearer(reserve: number | null, owners: string[] = []) {
    const armor = fakeArmor({ level: 4 });
    if (reserve !== null) {
        armor.flags[MODULE_ID] = { charges: { reserve, current: 0, active: false, hoursPerCharge: 24, settledAt: 0 } };
    }
    return fakeActor({ armor, owners });
}

describe("transfer", () => {
    beforeEach(() => installGame());

    it("moves a charge", async () => {
        const [source, target] = [wearer(3, ["player"]), wearer(1)];
        await performTransfer(source, target, users().get("player"));
        expect([reserveOf(source), reserveOf(target)]).toEqual([2, 2]);
        expect((globalThis as any).game.messages).toHaveLength(1);
    });

    it("one per activation", async () => {
        const [source, target] = [wearer(4), wearer(2)];
        await performTransfer(source, target, users().activeGM);
        await performTransfer(source, target, users().activeGM);
        expect([reserveOf(source), reserveOf(target)]).toEqual([2, 4]);
        expect((globalThis as any).game.messages[0].content).toContain("1 minute of connection");

        await performTransfer(source, target, users().activeGM);
        expect([reserveOf(source), reserveOf(target)]).toEqual([2, 4]);
    });

    it("whole charges only", async () => {
        const [source, target] = [wearer(0), wearer(1)];
        source.wornArmor.flags[MODULE_ID].charges.current = 0.5;
        await performTransfer(source, target, users().activeGM);
        expect([reserveOf(source), reserveOf(target)]).toEqual([0, 1]);
    });

    it("target full", async () => {
        const [source, target] = [wearer(3), wearer(null)];
        await performTransfer(source, target, users().activeGM);
        expect(reserveOf(source)).toBe(3);
        expect(getStoredState(target.wornArmor)).toBeNull();
    });

    it("not owner", async () => {
        const [source, target] = [wearer(3), wearer(1, ["player"])];
        await performTransfer(source, target, users().get("player"));
        expect([reserveOf(source), reserveOf(target)]).toEqual([3, 1]);
    });

    it("self", async () => {
        const source = wearer(3);
        await performTransfer(source, source, users().activeGM);
        expect(reserveOf(source)).toBe(3);
    });
});
