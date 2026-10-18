import { getActorHazards } from "../environments/hazards.ts";
import { getActivePreset } from "../rules/presets.ts";
import {
    announceDepleted,
    getActorCoverage,
    getStoredState,
    hasActiveArmor,
    live,
    maxCharges,
    serialized,
    writeState,
} from "./armor-state.ts";
import { advance, deactivate } from "./charges.ts";
import { hasManagedEffects, syncEffects } from "./effects.ts";

/** Party and loot actors can't hold effects. */
export function canHaveEffects(actor: ActorSf2e): boolean {
    return actor.allowedItemTypes.includes("effect");
}

export function needsReconcile(actor: ActorSf2e): boolean {
    if (!canHaveEffects(actor)) return false;
    return hasActiveArmor(actor) || hasManagedEffects(actor) || getActorHazards(actor).length > 0;
}

export function reconcile(actor: ActorSf2e): Promise<void> {
    return serialized(actor, async () => {
        const preset = getActivePreset();
        const now = game.time.worldTime;
        
        for (const armorId of actor.itemTypes.armor.map((a) => a.id)) {
            actor = live(actor);
            const armor = actor.itemTypes.armor.find((a) => a.id === armorId);
            const stored = armor && getStoredState(armor);
            if (!armor || !stored?.active) continue;

            const worn = actor.wornArmor?.id === armor.id;
            const hours = worn ? getActorCoverage(actor, preset, true).hoursPerCharge : stored.hoursPerCharge;
            const result = advance(stored, now, hours, maxCharges(armor, preset));

            if (!worn) {
                // Armor taken off while protection was on: it switches off.
                await writeState(armor, deactivate(result.state, preset.keepPartialCharge));
            } else if (result.depleted) {
                await writeState(armor, result.state, "depleted");
                await announceDepleted(actor, armor, preset);
            } else if (result.changed) {
                await writeState(armor, result.state);
            }
        }
        await syncEffects(live(actor), preset);
    });
}
