import { profileArmor } from "./rules/coverage.ts";
import { getActivePreset } from "./rules/presets.ts";
import {
    announceDepleted,
    formatCharges,
    getActorCoverage,
    maxCharges,
    readState,
    serialized,
    settledState,
    writeState,
} from "./state/armor-state.ts";
import { activate, advance, deactivate, recharge, totalCharges } from "./state/charges.ts";
import { syncEffects } from "./state/effects.ts";
import { localize } from "./i18n.ts";

/** The given actor, else the first controlled token's actor, else the user's character. */
export function resolveActor(actor?: ActorSf2e): ActorSf2e | null {
    const resolved = actor ?? canvas.tokens?.controlled[0]?.actor ?? game.user.character;
    if (!resolved) ui.notifications.warn(localize("Notifications.NoActor"));
    return resolved ?? null;
}

export function armorProblem(actor: ActorSf2e): string | null {
    const armor = actor.wornArmor;
    if (!armor) return localize("Notifications.NoArmor", { actor: actor.name });
    if (!profileArmor(armor).protective) return localize("Notifications.NotProtective", { armor: armor.name });
    return null;
}

function protectiveArmor(actor: ActorSf2e): ArmorSf2e | null {
    const problem = armorProblem(actor);
    if (problem) ui.notifications.warn(problem);
    return problem ? null : actor.wornArmor;
}

export function getStatus(actorArg?: ActorSf2e) {
    const actor = resolveActor(actorArg);
    const armor = actor?.wornArmor;
    if (!actor || !armor) return null;

    const preset = getActivePreset();
    const state = settledState(armor, preset);
    return {
        armor: armor.name,
        protective: profileArmor(armor).protective,
        active: state.active,
        charges: totalCharges(state),
        maxCharges: maxCharges(armor, preset),
        coverage: getActorCoverage(actor, preset, state.active),
    };
}

export async function activateProtection(actorArg?: ActorSf2e): Promise<void> {
    const actor = resolveActor(actorArg);
    const armor = actor && protectiveArmor(actor);
    if (!actor || !armor) return;

    await serialized(actor, async () => {
        const preset = getActivePreset();
        const state = readState(armor, preset);
        if (state.active) return;
        const hours = getActorCoverage(actor, preset, true).hoursPerCharge;
        const next = activate(state, game.time.worldTime, hours);
        if (!next) {
            ui.notifications.warn(localize("Notifications.NoCharges", { armor: armor.name }));
            return;
        }
        await writeState(armor, next);
        await syncEffects(actor, preset);
        ui.notifications.info(localize("Notifications.Activated", { armor: armor.name, charges: formatCharges(totalCharges(next)) }));
    });
}

export async function deactivateProtection(actorArg?: ActorSf2e): Promise<void> {
    const actor = resolveActor(actorArg);
    const armor = actor?.wornArmor;
    if (!actor || !armor) return;

    await serialized(actor, async () => {
        const preset = getActivePreset();
        const stored = readState(armor, preset);
        if (!stored.active) return;
        const result = advance(stored, game.time.worldTime, stored.hoursPerCharge, maxCharges(armor, preset));
        if (result.depleted) {
            await writeState(armor, result.state, "depleted");
            await syncEffects(actor, preset);
            return announceDepleted(actor, armor, preset);
        }
        const next = deactivate(result.state, preset.keepPartialCharge);
        await writeState(armor, next);
        await syncEffects(actor, preset);
        ui.notifications.info(localize("Notifications.Deactivated", { armor: armor.name, charges: formatCharges(totalCharges(next)) }));
    });
}

export async function toggleProtection(actorArg?: ActorSf2e): Promise<void> {
    const actor = resolveActor(actorArg);
    if (!actor) return;
    return getStatus(actor)?.active ? deactivateProtection(actor) : activateProtection(actor);
}

export async function rechargeProtection(actorArg?: ActorSf2e): Promise<void> {
    const actor = resolveActor(actorArg);
    const armor = actor && protectiveArmor(actor);
    if (!actor || !armor) return;

    await serialized(actor, async () => {
        const preset = getActivePreset();
        const now = game.time.worldTime;
        const max = maxCharges(armor, preset);
        await writeState(armor, recharge(settledState(armor, preset), max, now));
        await syncEffects(actor, preset);
        ui.notifications.info(localize("Notifications.Recharged", { armor: armor.name, charges: formatCharges(max) }));
    });
}
