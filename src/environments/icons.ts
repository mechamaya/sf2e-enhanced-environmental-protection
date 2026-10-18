import type { EnvironmentKey } from "../rules/types.ts";

// Qualified keys like cold:severe fall back to their base key's icon.
const ICONS: Record<EnvironmentKey, string> = {
    vacuum: "fa-solid fa-user-astronaut",
    underwater: "fa-solid fa-water",
    thin: "fa-solid fa-wind",
    thick: "fa-solid fa-cloud",
    toxic: "fa-solid fa-biohazard",
    smoke: "fa-solid fa-smog",
    corrosive: "fa-solid fa-flask",
    radiation: "fa-solid fa-radiation",
    cold: "fa-solid fa-snowflake",
    heat: "fa-solid fa-fire",
};

const FALLBACK = "fa-solid fa-triangle-exclamation";

export function environmentIcon(key: EnvironmentKey): string {
    return ICONS[key] ?? ICONS[key.split(":")[0]!] ?? FALLBACK;
}
