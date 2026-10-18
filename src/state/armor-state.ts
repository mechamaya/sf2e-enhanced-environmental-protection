import { MODULE_ID } from "../constants.ts";
import { getActorHazards } from "../environments/hazards.ts";
import { getProtections } from "../rule-elements/environmental-protection.ts";
import { getInnateProtections } from "../rules/innate.ts";
import { profileArmor, summarizeCoverage, type CoverageSummary } from "../rules/coverage.ts";
import type { RulesPreset } from "../rules/types.ts";
import { advance, initialState, type ChargeState } from "./charges.ts";
import { environmentNames } from "../environments/names.ts";
import { internalOptions, type ProtectionEvent } from "./options.ts";
import { localize } from "../i18n.ts";

const FLAG = "charges";

export function maxCharges(armor: ArmorSf2e, preset: RulesPreset): number {
    return Math.max(preset.minCharges, armor.level * preset.chargesPerLevel);
}

export function formatCharges(charges: number): string {
    return Number.isInteger(charges) ? String(charges) : charges.toFixed(2);
}

/** @param armorActive armor only protects while switched on */
export function getActorCoverage(actor: ActorSf2e, preset: RulesPreset, armorActive: boolean): CoverageSummary {
    const profile = armorActive && actor.wornArmor ? profileArmor(actor.wornArmor) : null;
    const protections = [...getProtections(actor), ...getInnateProtections(actor, preset)];
    return summarizeCoverage(getActorHazards(actor), profile, protections, preset);
}

/** Null for armor that's never been used. */
export function getStoredState(armor: ArmorSf2e): ChargeState | null {
    return (armor.getFlag(MODULE_ID, FLAG) as ChargeState | undefined) ?? null;
}

/** Armor that's never been used starts full. */
export function readState(armor: ArmorSf2e, preset: RulesPreset): ChargeState {
    return getStoredState(armor) ?? initialState(maxCharges(armor, preset), game.time.worldTime, preset.chargeHours);
}

export function settledState(armor: ArmorSf2e, preset: RulesPreset): ChargeState {
    const stored = readState(armor, preset);
    return advance(stored, game.time.worldTime, stored.hoursPerCharge, maxCharges(armor, preset)).state;
}

export async function writeState(armor: ArmorSf2e, state: ChargeState, event?: ProtectionEvent): Promise<void> {
    await armor.update({ [`flags.${MODULE_ID}.${FLAG}`]: state }, internalOptions(event));
}

export function hasActiveArmor(actor: ActorSf2e): boolean {
    return actor.itemTypes.armor.some((a) => getStoredState(a)?.active);
}

/** Runs tasks for one actor one at a time. */
const queues = new Map<string, Promise<void>>();
export function serialized(actor: ActorSf2e, task: () => Promise<void>): Promise<void> {
    const key = actor.uuid;
    const next = (queues.get(key) ?? Promise.resolve())
        .then(task)
        .catch((error) => console.error(MODULE_ID, `${actor.name} (${key})`, error));
    queues.set(key, next);
    
    next.then(() => queues.get(key) === next && queues.delete(key));
    return next;
}

/** The current copy of the actor, in case the reference is stale. */
export function live(actor: ActorSf2e): ActorSf2e {
    return (fromUuidSync(actor.uuid) as ActorSf2e | null) ?? actor;
}

export async function announceDepleted(actor: ActorSf2e, armor: ArmorSf2e, preset: RulesPreset): Promise<void> {
    const exposed = getActorCoverage(actor, preset, false).exposedTo;
    let content = `<p>${localize("Chat.Depleted", { armor: armor.name })}</p>`;
    if (exposed.length > 0) {
        const environments = environmentNames(exposed.map((h) => h.environment));
        content += `<p>${localize("Chat.Exposed", { actor: actor.name, environments })}</p>`;
    }
    await ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    });
}

/** World actors, plus unlinked token actors on every scene. */
export function allActors(): ActorSf2e[] {
    const tokenActors = game.scenes.contents.flatMap((s) =>
        s.tokens.contents.flatMap((t) => (!t.actorLink && t.actor ? [t.actor] : [])),
    );
    return [...game.actors.contents, ...tokenActors];
}
