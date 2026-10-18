import { describe, expect, it } from "vitest";
import { activate, advance, deactivate, initialState, recharge, totalCharges } from "../src/state/charges.ts";

const H = 3600;

describe("charges", () => {
    it("activate", () => {
        const state = activate(initialState(3, 0, 24), 0, 24)!;
        expect(state).toMatchObject({ active: true, reserve: 2, current: 1 });
    });

    it("drains", () => {
        const state = activate(initialState(3, 0, 24), 0, 24)!;
        const result = advance(state, 12 * H, 24, 3);
        expect(result.state.current).toBeCloseTo(0.5);
        expect(result.changed).toBe(false);
    });

    it("rate change mid-charge", () => {
        let state = activate(initialState(3, 0, 24), 0, 24)!;
        const atTwelve = advance(state, 12 * H, 4, 3); // into a vacuum after 12h
        expect(atTwelve.changed).toBe(true);
        state = atTwelve.state;
        // The half charge left lasts 2h at 4h per charge.
        const after = advance(state, 14 * H, 4, 3).state;
        expect(after.reserve).toBe(1);
        expect(after.current).toBeCloseTo(1);
    });

    it("long time skip", () => {
        const state = activate(initialState(3, 0, 24), 0, 24)!;
        const result = advance(state, 100 * H, 24, 3);
        expect(result.depleted).toBe(true);
        expect(result.state).toMatchObject({ active: false, reserve: 0, current: 0 });
    });

    it("rewind refunds", () => {
        const state = advance(activate(initialState(3, 0, 24), 0, 24)!, 36 * H, 24, 3).state; // reserve 1, half a charge left
        const back = advance(state, 6 * H, 24, 3);
        expect(back.changed).toBe(true);
        expect(back.state).toMatchObject({ active: true, reserve: 2, settledAt: 6 * H });
        expect(back.state.current).toBeCloseTo(0.75);
    });

    it("rewind limits", () => {
        const state = activate(initialState(3, 100 * H, 24), 100 * H, 24)!;
        expect(totalCharges(advance(state, 0, 24, 3).state)).toBe(3);
        const off = initialState(1, 100 * H, 24);
        expect(advance(off, 0, 24, 3).state).toBe(off);
    });

    it("no drain while off", () => {
        const off = initialState(3, 0, 24);
        expect(advance(off, 1000 * H, 24, 3)).toMatchObject({ changed: false, state: off });
    });

    describe("deactivate mid-charge", () => {
        const sixHoursIn = advance(activate(initialState(2, 0, 24), 0, 24)!, 6 * H, 24, 2).state;

        it("Player Core", () => {
            expect(deactivate(sixHoursIn, false)).toMatchObject({ active: false, reserve: 1, current: 0 });
        });

        it("keep partial charges", () => {
            const kept = deactivate(sixHoursIn, true);
            expect(kept.current).toBeCloseTo(0.75);
            const back = activate(kept, 100 * H, 24)!;
            expect(back.reserve).toBe(1);
            expect(back.current).toBeCloseTo(0.75);
        });
    });

    it("no charges", () => {
        expect(activate(initialState(0, 0, 24), 0, 24)).toBeNull();
    });

    it("recharge", () => {
        const on = activate(initialState(2, 0, 24), 0, 24)!;
        expect(recharge(on, 2, H)).toMatchObject({ reserve: 1, current: 1 });
        expect(recharge(initialState(0, 0, 24), 2, H)).toMatchObject({ reserve: 2, current: 0 });
        expect(totalCharges(recharge(on, 2, H))).toBe(2);
    });
});
