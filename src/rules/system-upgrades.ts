import type { EnvironmentKey, Protection } from "./types.ts";

interface SystemUpgrade {
    counters: EnvironmentKey[];
    removesExposed?: boolean;
}

// System upgrades don't carry our roll options, so they're matched by slug (or name, for compendium copies).
const SYSTEM_UPGRADES: Record<string, SystemUpgrade> = {
    "basic-environmental-protection": {
        counters: [], removesExposed: true
    },
    "filtered-rebreather-commercial": {
        counters: ["toxic"]
    },
    "filtered-rebreather-tactical": {
        counters: ["toxic"]
    },
    "filtered-rebreather-advanced": {
        counters: ["toxic"]
    },
    "filtered-rebreather-superior": {
        counters: ["toxic"]
    },
    "filtered-rebreather-elite": {
        counters: ["toxic"]
    },
    "thermal-capacitor-commercial": {
        counters: ["cold:mild", "heat:mild"]
    },
    "thermal-capacitor-tactical": {
        counters: ["cold:mild", "cold:severe", "heat:mild", "heat:severe"]
    },
    "thermal-capacitor-advanced": {
        counters: ["cold:mild", "cold:severe", "cold:extreme", "heat:mild", "heat:severe", "heat:extreme"]
    },
    "thermal-capacitor-superior": {
        counters: ["cold:mild", "cold:severe", "cold:extreme", "cold:incredible", "heat:mild", "heat:severe", "heat:extreme", "heat:incredible"],
    },
};

function lookup(item: PhysicalItemSf2e): SystemUpgrade | undefined {
    return SYSTEM_UPGRADES[item.slug ?? game.pf2e.system.sluggify(item.name)];
}

export function hasExposedRemover(armor: ArmorSf2e): boolean {
    return [...armor.subitems].some((i) => lookup(i)?.removesExposed);
}

export function getSystemUpgradeProtections(armor: ArmorSf2e): Protection[] {
    return [...armor.subitems].flatMap((item) =>
        (lookup(item)?.counters ?? []).map((environment) => ({
            environment,
            level: "full" as const,
            hoursPerCharge: null,
            source: "armor" as const,
            label: item.name,
        })),
    );
}
