// Protection from ancestry traits and features: always on, and never uses charges.
import type { EnvironmentKey, Protection, RulesPreset } from "./types.ts";
import { localize } from "../i18n.ts";

const THIN = ["thin", "thin:severe"];
const THICK = ["thick", "thick:severe"];
const TEMPERATURE = ["cold:mild", "cold:severe", "cold:extreme", "heat:mild", "heat:severe", "heat:extreme"];

type Tier = "cosmic" | "vacuumOnly" | "basic" | "nonBreather";

const TIERS: Record<Tier, { official: EnvironmentKey[]; enhanced: EnvironmentKey[] }> = {
    cosmic: { official: ["vacuum"], enhanced: ["vacuum", ...THIN] },
    // Cosmic only while in a vacuum.
    vacuumOnly: { official: ["vacuum"], enhanced: ["vacuum"] },
    // "Always have basic environmental protections"
    basic: { official: ["thin", "thick", "vacuum", "underwater"], enhanced: ["vacuum", ...THIN, ...THICK] },
    // Severe toxic and smoke stay separate, for balance.
    nonBreather: { official: [...THIN, ...THICK, "underwater"], enhanced: ["vacuum", ...THIN, ...THICK, "toxic", "underwater"] },
};

const FEATURES: Record<string, { tier: Tier; extra?: EnvironmentKey[] }> = {
    astrowanderer: { tier: "cosmic" }, // Gfolian: breathes in a vacuum
    "suspended-respiration": { tier: "vacuumOnly" }, // Sarcesian; its 1-hour limit is left to the table
    "voidborn-pahtra": { tier: "vacuumOnly" },
    constructed: { tier: "basic" }, // Android
    techentu: { tier: "basic", extra: TEMPERATURE },
};

function protections(tier: Tier, label: string, preset: RulesPreset, extra: EnvironmentKey[] = []): Protection[] {
    const keys = [...TIERS[tier][preset.enhancedAncestries ? "enhanced" : "official"], ...extra];
    return keys.map((environment) => ({ environment, level: "full", hoursPerCharge: null, source: "innate", label }));
}

export function getInnateProtections(actor: ActorSf2e, preset: RulesPreset): Protection[] {
    const traits = actor.traits;
    const result: Protection[] = [];

    if (traits.has("cosmic")) result.push(...protections("cosmic", localize("Innate.cosmic"), preset));
    if (traits.has("construct")) result.push(...protections("nonBreather", localize("Innate.construct"), preset));
    // Borai have the undead trait but are still partly living, and breathe.
    if (traits.has("undead") && !traits.has("borai")) result.push(...protections("nonBreather", localize("Innate.undead"), preset));

    for (const item of [...actor.itemTypes.feat, ...actor.itemTypes.heritage]) {
        // Like the system: an item without a slug is identified by its name.
        const feature = FEATURES[item.slug ?? game.pf2e.system.sluggify(item.name)];
        if (feature) result.push(...protections(feature.tier, item.name, preset, feature.extra));
    }
    return result;
}
