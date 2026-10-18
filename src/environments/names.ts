import { I18N } from "../constants.ts";
import type { EnvironmentKey } from "../rules/types.ts";

/** Built-in keys are named in the language file; anything else is title-cased. */
export function environmentName(key: EnvironmentKey): string {
    const path = `${I18N}.Environment.${key}`;
    if (game.i18n.has(path)) return game.i18n.localize(path);

    const [base = key, ...qualifiers] = key.split(":").map(titleCase);
    return qualifiers.length > 0 ? `${base} (${qualifiers.join(", ")})` : base;
}

export function environmentNames(keys: Iterable<EnvironmentKey>): string {
    return [...new Set(keys)].map(environmentName).join(", ");
}

function titleCase(slug: string): string {
    return slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
