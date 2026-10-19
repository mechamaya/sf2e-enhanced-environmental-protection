import { SECONDS_PER_HOUR } from "../constants.ts";

/**
 * The charge in use drains continuously, but the state is only saved when something changes (a charge runs out,
 * the rate changes, protection is toggled). In between, it's worked out from `settledAt`.
 */
export interface ChargeState {
    reserve: number;
    /** 0 to 1 */
    current: number;
    active: boolean;
    /** The rate since `settledAt`. */
    hoursPerCharge: number;
    /** World time in seconds. */
    settledAt: number;
}

interface AdvanceResult {
    state: ChargeState;
    depleted: boolean;
    changed: boolean;
}

const EPSILON = 1e-9;

export function initialState(maxCharges: number, now: number, hoursPerCharge: number): ChargeState {
    return { reserve: maxCharges, current: 0, active: false, hoursPerCharge, settledAt: now };
}

export function totalCharges(state: ChargeState): number {
    return state.reserve + state.current;
}

// Rewinding the clock refunds the time at the stored rate, up to the maximum.
export function advance(state: ChargeState, now: number, hoursPerCharge: number, maxCharges: number): AdvanceResult {
    if (!state.active) return { state, depleted: false, changed: false };

    const secondsPerCharge = state.hoursPerCharge * SECONDS_PER_HOUR;
    let elapsed = now - state.settledAt;
    if (elapsed < 0) {
        const refunded = withTotal(state, totalCharges(state) - elapsed / secondsPerCharge, maxCharges);
        return { state: { ...refunded, hoursPerCharge, settledAt: now }, depleted: false, changed: true };
    }

    const next = { ...state };
    let depleted = false;

    while (elapsed > 0) {
        const left = next.current * secondsPerCharge;
        if (elapsed < left) {
            next.current -= elapsed / secondsPerCharge;
            break;
        }
        elapsed -= left;
        next.current = 0;
        if (next.reserve >= 1) {
            next.reserve -= 1;
            next.current = 1;
        } else {
            next.active = false;
            depleted = true;
            break;
        }
    }
    if (next.current < EPSILON) next.current = 0;

    const changed = depleted || next.reserve !== state.reserve || hoursPerCharge !== state.hoursPerCharge;
    next.hoursPerCharge = hoursPerCharge;
    next.settledAt = now;
    return { state: next, depleted, changed };
}

/** Null if there are no charges. */
export function activate(state: ChargeState, now: number, hoursPerCharge: number): ChargeState | null {
    if (state.active) return state;
    const next = { ...state, active: true, hoursPerCharge, settledAt: now };
    if (next.current <= 0) {
        if (next.reserve < 1) return null;
        next.reserve -= 1;
        next.current = 1;
    }
    return next;
}

export function deactivate(state: ChargeState, keepPartialCharge: boolean): ChargeState {
    return { ...state, active: false, current: keepPartialCharge ? state.current : 0 };
}

/** The charge in use can't be given away. */
export function spareCharges(state: ChargeState): number {
    return Math.floor(state.reserve);
}

export function roomForCharges(state: ChargeState, maxCharges: number): number {
    return Math.max(0, Math.floor(maxCharges - state.reserve));
}

/** While on, the fraction is the charge in use; while off, a kept partial charge. 0 switches protection off. */
export function withTotal(state: ChargeState, total: number, maxCharges: number): ChargeState {
    const clamped = Math.min(Math.max(total, 0), maxCharges);
    if (!state.active) {
        const reserve = Math.floor(clamped);
        return { ...state, reserve, current: clamped - reserve };
    }
    if (clamped === 0) return { ...state, active: false, reserve: 0, current: 0 };
    const reserve = Math.ceil(clamped) - 1;
    return { ...state, reserve, current: clamped - reserve };
}

export function addReserve(state: ChargeState, charges: number): ChargeState {
    return { ...state, reserve: state.reserve + charges };
}

/** If protection is on, one of the refilled charges goes straight into use. */
export function recharge(state: ChargeState, maxCharges: number, now: number): ChargeState {
    if (!state.active) return { ...state, reserve: maxCharges, current: 0, settledAt: now };
    return { ...state, reserve: maxCharges - 1, current: 1, settledAt: now };
}
