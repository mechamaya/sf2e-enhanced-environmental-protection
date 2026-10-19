// Environments and protections use RollOption rule elements:
//   environment:<key>
//   environment:<key>:limited:<hours>
//   environmental-protection:<key>
//   environmental-protection:<key>:limited:<hours>
import { ENVIRONMENT_KEY_PATTERN, type EnvironmentKey, type Hazard, type Protection, type ProtectionSource } from "./types.ts";

export const HAZARD_PREFIX = "environment:";
const PROTECTION_PREFIX = "environmental-protection:";

export function parseOption(option: string, prefix: string): { environment: EnvironmentKey; hours: number | null } | null {
    if (!option.startsWith(prefix)) return null;
    const [environment = "", limited] = option.slice(prefix.length).split(":limited:");
    const hours = limited === undefined ? null : Number(limited);
    if (!ENVIRONMENT_KEY_PATTERN.test(environment) || (hours !== null && !(hours > 0))) return null;
    return { environment, hours };
}

export function hazardOption(environment: EnvironmentKey, hours: number | null = null): string {
    return `${HAZARD_PREFIX}${environment}${hours ? `:limited:${hours}` : ""}`;
}

export function getHazards(actor: ActorSf2e): Hazard[] {
    const hazards = new Map<EnvironmentKey, Hazard>();
    for (const [option, on] of Object.entries(actor.rollOptions.all)) {
        const parsed = on ? parseOption(option, HAZARD_PREFIX) : null;
        if (!parsed) continue;
        const limitedDuration = parsed.hours ?? hazards.get(parsed.environment)?.limitedDuration ?? null;
        hazards.set(parsed.environment, { environment: parsed.environment, limitedDuration });
    }
    return [...hazards.values()];
}

// On armor or its upgrades, protection only works while switched on; anywhere else it's innate.
function sourceOf(item: ItemSf2e): ProtectionSource {
    const physical = item as PhysicalItemSf2e;
    return item.type === "armor" || physical.parentItem?.type === "armor" ? "armor" : "innate";
}

export function getProtections(actor: ActorSf2e): Protection[] {
    return actor.rules.flatMap((rule) => {
        const option = rule.key === "RollOption" && !rule.ignored ? rule.option : undefined;
        const parsed = option && actor.rollOptions.all[option] ? parseOption(option, PROTECTION_PREFIX) : null;
        if (!parsed) return [];
        return {
            environment: parsed.environment,
            level: parsed.hours ? "limited" : "full",
            hoursPerCharge: parsed.hours,
            source: sourceOf(rule.item),
            label: rule.item.name,
        };
    });
}
