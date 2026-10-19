/** e.g. "vacuum", "thick:severe", "cold:incredible" */
export type EnvironmentKey = string;

export const ENVIRONMENT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export interface Hazard {
    environment: EnvironmentKey;
    /** Hours per charge when the armor can only partially counter this hazard. */
    limitedDuration: number | null;
}

/** Limited drains charges faster. Resistances and save bonuses don't count as protection. */
export type CoverageLevel = "full" | "limited" | "none";

/** Armor protection only works while switched on, and drains charges; innate is always on. */
export type ProtectionSource = "armor" | "innate";

type ProtectionLevel = "full" | "limited";

export interface Protection {
    environment: EnvironmentKey;
    level: ProtectionLevel;
    hoursPerCharge: number | null;
    source: ProtectionSource;
    label: string;
}

export interface Coverage {
    level: CoverageLevel;
    hoursPerCharge: number | null;
    source: ProtectionSource | null;
    label: string | null;
}

export interface ArmorCoverage {
    level: ProtectionLevel;
    /** Required for limited. */
    hoursPerCharge?: number;
}

export interface RulesPreset {
    /** Charges = max(minCharges, item level * chargesPerLevel). */
    chargesPerLevel: number;
    minCharges: number;
    chargeHours: number;
    keepPartialCharge: boolean;
    /** Unlisted keys: no coverage. */
    armor: Record<EnvironmentKey, ArmorCoverage>;
    /** Allow a hazard's limited hours (environment:<key>:limited:<hours>) to grant limited protection where coverage would be none. */
    customLimitedProtection: boolean;
    enhancedAncestries: boolean;
}
