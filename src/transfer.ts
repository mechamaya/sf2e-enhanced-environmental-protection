// Transfer Charge. The minute of connection isn't tracked; the chat message just mentions it.
import { armorProblem, resolveActor } from "./api.ts";
import { I18N } from "./constants.ts";
import { getActivePreset } from "./rules/presets.ts";
import { onGMRequest, requestGM } from "./socket.ts";
import { formatCharges, maxCharges, serialized, settledState, writeState } from "./state/armor-state.ts";
import { addReserve, roomForCharges, spareCharges, totalCharges, type ChargeState } from "./state/charges.ts";
import { syncEffects } from "./state/effects.ts";
import { localize } from "./i18n.ts";

const ACTION = "transferCharge";

const settled = (armor: ArmorSf2e) => settledState(armor, getActivePreset());

interface TransferRequest {
    source: string;
    target: string;
}

function transferProblem(source: ActorSf2e, target: ActorSf2e): string | null {
    if (source.uuid === target.uuid) return localize("Notifications.TransferSelf");
    const problem = armorProblem(source) ?? armorProblem(target);
    if (problem) return problem;
    const [from, to] = [source.wornArmor!, target.wornArmor!];
    if (spareCharges(settled(from)) < 1) return localize("Notifications.NoSpareCharge", { armor: from.name });
    if (roomForCharges(settled(to), maxCharges(to, getActivePreset())) < 1) return localize("Notifications.TargetFull", { armor: to.name });
    return null;
}

async function adjustReserve(actor: ActorSf2e, charges: number, allowed: (state: ChargeState) => boolean): Promise<boolean> {
    let done = false;
    await serialized(actor, async () => {
        const armor = actor.wornArmor;
        if (!armor) return;
        const state = settled(armor);
        if (!allowed(state)) return;
        await writeState(armor, addReserve(state, charges));
        await syncEffects(actor, getActivePreset());
        done = true;
    });
    return done;
}

// Runs on the GM's client. Takes the charge, then gives it, one actor at a time so two transfers can't
// deadlock, and refunds it if the target filled up in between.
export async function performTransfer(source: ActorSf2e, target: ActorSf2e, sender: UserSf2e): Promise<void> {
    if (!sender.isGM && !source.testUserPermission(sender, "OWNER")) return;
    const problem = transferProblem(source, target);
    if (problem) {
        console.warn(I18N, problem);
        return;
    }

    const max = maxCharges(target.wornArmor!, getActivePreset());
    if (!(await adjustReserve(source, -1, (s) => spareCharges(s) >= 1))) return;
    if (!(await adjustReserve(target, 1, (s) => roomForCharges(s, max) >= 1))) {
        await adjustReserve(source, 1, () => true);
        return;
    }

    const left = formatCharges(totalCharges(settled(source.wornArmor!)));
    await ChatMessage.create({
        content: `<p>${localize("Chat.Transferred", { source: source.name, target: target.name, left })}</p>`,
        speaker: ChatMessage.getSpeaker({ actor: source }),
        whisper: game.users
            .filter((u) => u.isGM || [source, target].some((a) => a.testUserPermission(u, "OWNER")))
            .map((u) => u.id),
    });
}

export function registerTransfer(): void {
    onGMRequest<TransferRequest>(ACTION, async ({ source, target }, sender) => {
        const [from, to] = [fromUuidSync(source), fromUuidSync(target)] as (ActorSf2e | null)[];
        if (from && to) await performTransfer(from, to, sender);
    });
}

function targetedActor(): ActorSf2e | null {
    const targets = [...game.user.targets];
    const actor = targets.length === 1 ? targets[0]!.actor : null;
    if (!actor) ui.notifications.warn(localize("Notifications.TargetOne"));
    return actor;
}

/** Defaults: your one targeted token, and your selected token or character. */
export function transferCharge({ target, source }: { target?: ActorSf2e; source?: ActorSf2e } = {}): void {
    const from = resolveActor(source);
    const to = from && (target ?? targetedActor());
    if (!from || !to) return;
    const problem = transferProblem(from, to);
    if (problem) {
        ui.notifications.warn(problem);
        return;
    }
    const request: TransferRequest = { source: from.uuid, target: to.uuid };
    if (!requestGM(ACTION, request)) ui.notifications.warn(localize("Notifications.NoGM"));
}
