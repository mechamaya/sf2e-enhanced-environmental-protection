import { I18N } from "./constants.ts";

/** A string from this module's language file, e.g. localize("Notifications.NoArmor", { actor: actor.name }). */
export function localize(key: string, data?: Record<string, unknown>): string {
    return game.i18n.format(`${I18N}.${key}`, data);
}
