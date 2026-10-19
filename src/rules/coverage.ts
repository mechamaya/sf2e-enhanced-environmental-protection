import { getSystemUpgradeProtections, hasExposedRemover } from "./system-upgrades.ts";
import type { Coverage, Hazard, Protection, RulesPreset } from "./types.ts";

interface ArmorProfile {
    armor: ArmorSf2e;
    protective: boolean;
    upgradeProtections: Protection[];
}

export function profileArmor(armor: ArmorSf2e): ArmorProfile {
    // Pathfinder armor is always exposed.
    const isStarfinder = armor.traits.has("tech") || armor.traits.has("analog");
    const exposed = !isStarfinder || armor.traits.has("exposed");
    return {
        armor,
        protective: !exposed || hasExposedRemover(armor),
        upgradeProtections: getSystemUpgradeProtections(armor),
    };
}

const NO_COVERAGE: Coverage = { level: "none", hoursPerCharge: null, source: null, label: null };

const LEVEL_RANK: Record<Coverage["level"], number> = { none: 0, limited: 1, full: 2 };

/** Prefer higher charge duration if two coverages exist */
function better(a: Coverage, b: Coverage): Coverage {
    if (LEVEL_RANK[a.level] !== LEVEL_RANK[b.level]) return LEVEL_RANK[a.level] > LEVEL_RANK[b.level] ? a : b;
    if (a.level === "limited" && a.hoursPerCharge !== b.hoursPerCharge) {
        return (a.hoursPerCharge ?? 0) > (b.hoursPerCharge ?? 0) ? a : b;
    }
    return b.source === "innate" && a.source !== "innate" ? b : a;
}

// The hazard's limitedDuration overrides the preset's, but not a limited protection's own hours.
function resolveCoverage(
    hazard: Hazard,
    profile: ArmorProfile | null,
    protections: Protection[],
    preset: RulesPreset,
): Coverage {
    const candidates: Coverage[] = [];
    const armor = profile?.protective ? profile : null;

    if (armor) {
        const base = preset.armor[hazard.environment];
        if (base) {
            const hours = base.level === "limited" ? (hazard.limitedDuration ?? base.hoursPerCharge ?? null) : null;
            candidates.push({ level: base.level, hoursPerCharge: hours, source: "armor", label: armor.armor.name });
        }
        if (preset.customLimitedProtection && hazard.limitedDuration) {
            candidates.push({
                level: "limited",
                hoursPerCharge: hazard.limitedDuration,
                source: "armor",
                label: armor.armor.name,
            });
        }
    }

    for (const p of [...(profile?.upgradeProtections ?? []), ...protections]) {
        if (p.environment !== hazard.environment) continue;
        if (p.source === "armor" && !armor) continue;
        candidates.push({ level: p.level, hoursPerCharge: p.hoursPerCharge, source: p.source, label: p.label });
    }

    return candidates.reduce(better, NO_COVERAGE);
}

export interface CoverageSummary {
    perHazard: { hazard: Hazard; coverage: Coverage }[];
    /** The shortest limited duration among the armor's coverages. */
    hoursPerCharge: number;
    exposedTo: Hazard[];
}

export function summarizeCoverage(
    hazards: Hazard[],
    profile: ArmorProfile | null,
    protections: Protection[],
    preset: RulesPreset,
): CoverageSummary {
    const perHazard = hazards.map((hazard) => ({
        hazard,
        coverage: resolveCoverage(hazard, profile, protections, preset),
    }));
    const limitedHours = perHazard.flatMap(({ coverage: c }) =>
        c.level === "limited" && c.source === "armor" && c.hoursPerCharge ? [c.hoursPerCharge] : [],
    );
    return {
        perHazard,
        hoursPerCharge: Math.min(preset.chargeHours, ...limitedHours),
        exposedTo: perHazard.filter((h) => h.coverage.level === "none").map((h) => h.hazard),
    };
}
