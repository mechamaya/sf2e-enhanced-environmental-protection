import { getSetting } from "../settings.ts";
import type { ArmorCoverage, EnvironmentKey, RulesPreset } from "./types.ts";

/** Player Core. */
const OFFICIAL: RulesPreset = {
    chargesPerLevel: 1,
    minCharges: 1,
    chargeHours: 24,
    keepPartialCharge: false,
    armor: {
        thin: { level: "full" },
        thick: { level: "full" },
        vacuum: { level: "full" },
        underwater: { level: "full" },
    },
    customLimitedProtection: false,
    enhancedAncestries: false,
};

/** Enhanced Rules: basic protection only buys time in these. */
const LIMITED_PROTECTION_ARMOR: Record<EnvironmentKey, ArmorCoverage> = {
    "thin:severe": { level: "limited", hoursPerCharge: 4 },
    vacuum: { level: "limited", hoursPerCharge: 4 },
    underwater: { level: "limited", hoursPerCharge: 1 },
};

export function getActivePreset(): RulesPreset {
    const preset: RulesPreset = structuredClone(OFFICIAL);
    if (getSetting("limitedProtection")) {
        Object.assign(preset.armor, LIMITED_PROTECTION_ARMOR);
        preset.customLimitedProtection = true;
    }
    preset.keepPartialCharge = getSetting("keepPartialCharges");
    preset.enhancedAncestries = getSetting("ancestryProtection");
    return preset;
}
