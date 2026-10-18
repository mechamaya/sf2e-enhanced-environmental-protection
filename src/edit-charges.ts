import { armorProblem, resolveActor } from "./api.ts";
import { getActivePreset } from "./rules/presets.ts";
import { formatCharges, maxCharges, serialized, settledState, writeState } from "./state/armor-state.ts";
import { totalCharges, withTotal } from "./state/charges.ts";
import { syncEffects } from "./state/effects.ts";
import { localize } from "./i18n.ts";

function editableArmor(actor: ActorSf2e): ArmorSf2e | null {
    const problem = armorProblem(actor) ?? (actor.wornArmor!.isOwner ? null : localize("EditCharges.NotOwner", { actor: actor.name }));
    if (problem) ui.notifications.warn(problem);
    return problem ? null : actor.wornArmor;
}

/** A fraction is the part of a charge in use, or kept while off. 0 while on switches protection off. */
export async function setCharges(total: number, actorArg?: ActorSf2e): Promise<void> {
    const actor = resolveActor(actorArg);
    const armor = actor && editableArmor(actor);
    if (!actor || !armor || !Number.isFinite(total)) return;

    await serialized(actor, async () => {
        const preset = getActivePreset();
        const next = withTotal(settledState(armor, preset), total, maxCharges(armor, preset));
        await writeState(armor, next);
        await syncEffects(actor, preset);
        ui.notifications.info(localize("EditCharges.Set", { actor: actor.name, armor: armor.name, charges: formatCharges(totalCharges(next)) }));
    });
}

export async function openChargesDialog(actorArg?: ActorSf2e): Promise<void> {
    const actor = resolveActor(actorArg);
    const armor = actor && editableArmor(actor);
    if (!actor || !armor) return;

    const preset = getActivePreset();
    const max = maxCharges(armor, preset);
    const current = formatCharges(totalCharges(settledState(armor, preset)));
    const content = `
        <div class="form-group">
            <label>${localize("EditCharges.Charges", { max })}</label>
            <input type="number" name="charges" value="${current}" min="0" max="${max}" step="any">
            <p class="hint">${localize("EditCharges.Hint")}</p>
        </div>`;

    await foundry.applications.api.DialogV2.wait({
        window: { title: localize("EditCharges.Title", { actor: actor.name }) },
        content,
        rejectClose: false,
        buttons: [
            {
                action: "save",
                label: localize("EditCharges.Save"),
                default: true,
                callback: (_e: Event, button: HTMLButtonElement) => {
                    const input = (button.form!.elements as unknown as Record<string, HTMLInputElement>).charges!;
                    if (input.value !== "") return setCharges(Number(input.value), actor);
                },
            },
        ],
    });
}
