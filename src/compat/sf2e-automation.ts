import { MODULE_ID } from "../constants.ts";
import { localize } from "../i18n.ts";

// SF2e Automation has its own environmental protection and no way to turn it off. Its scripts are globals looked
// up by name, so swapping its protection functions for no-ops turns off just that feature.
export const SF2E_AUTOMATION_ID = "sf2e-anachronism-automation";

const PROTECTION_FUNCTIONS = [
    "getProtectionState",
    "setProtectionState",
    "updateProtectionDisplay",
    "getRemainingCharges",
    "resetSingleEnvironmentalProtection",
] as const;

export function isSf2eAutomationActive(): boolean {
    return game.modules.get(SF2E_AUTOMATION_ID)?.active ?? false;
}

/** Call during init: after its scripts load, before its ready hook. Returns any functions it couldn't find. */
export function disableSf2eAutomationProtection(macros: { toggle: () => unknown; recharge: () => unknown }): string[] {
    const global = globalThis as unknown as Record<string, unknown>;
    const missing = PROTECTION_FUNCTIONS.filter((name) => typeof global[name] !== "function");
    for (const name of PROTECTION_FUNCTIONS) {
        if (!missing.includes(name)) global[name] = async () => null;
    }

    // Accessors that ignore its ready hook's assignment, so the redirect sticks whichever hook runs first.
    const module = game.modules.get(SF2E_AUTOMATION_ID);
    if (module) {
        module.macros ??= {};
        const redirect = (key: string, fn: () => unknown) =>
            Object.defineProperty(module.macros, key, { get: () => fn, set: () => {}, configurable: true });
        redirect("toggleEnvironmentalProtection", macros.toggle);
        redirect("resetEnvironmentalProtection", macros.recharge);
    }
    return missing;
}

export function warnIncompleteCompat(missing: string[]): void {
    if (missing.length === 0 || !game.user.isGM) return;
    const message = localize("Compat.Sf2eAutomationIncomplete", { functions: missing.join(", ") });
    ui.notifications.warn(message);
    console.warn(MODULE_ID, message);
}
