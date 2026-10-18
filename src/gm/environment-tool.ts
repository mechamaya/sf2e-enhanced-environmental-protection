import { HAZARD_RULE_KEY, MODULE_ID } from "../constants.ts";
import { environmentName } from "../environments/names.ts";
import { ENVIRONMENT_KEY_PATTERN, type EnvironmentKey } from "../rules/types.ts";
import { localize } from "../i18n.ts";

const ENVIRONMENTS_PACK = `${MODULE_ID}.environments`;

function declaredEnvironments(effect: EffectSf2e): EnvironmentKey[] {
    return (effect.system.rules ?? []).flatMap((r) => (r.key === HAZARD_RULE_KEY && r.environment ? [r.environment] : []));
}

function selectedActors(): ActorSf2e[] {
    const actors = (canvas.tokens?.controlled ?? []).flatMap((t) => t.actor ?? []);
    return [...new Set(actors)].filter((a) => a.allowedItemTypes.includes("effect"));
}

async function compendiumEnvironments(): Promise<Map<EnvironmentKey, EffectSf2e>> {
    const docs = (await game.packs.get(ENVIRONMENTS_PACK)?.getDocuments()) ?? [];
    const byKey = new Map<EnvironmentKey, EffectSf2e>();
    for (const doc of docs as EffectSf2e[]) {
        for (const key of declaredEnvironments(doc)) byKey.set(key, doc);
    }
    return byKey;
}

/** Skips actors already in that environment. Returns how many it was applied to. */
export async function applyEnvironment(key: EnvironmentKey, actors: ActorSf2e[] = selectedActors()): Promise<number> {
    if (!ENVIRONMENT_KEY_PATTERN.test(key)) {
        ui.notifications.warn(localize("EnvironmentTool.InvalidKey", { key }));
        return 0;
    }
    const fromCompendium = (await compendiumEnvironments()).get(key);
    const source = (fromCompendium && game.items.fromCompendium(fromCompendium)) ?? {
        name: localize("EnvironmentTool.EffectName", { name: environmentName(key) }),
        type: "effect",
        img: "icons/svg/hazard.svg",
        system: {
            rules: [{ key: HAZARD_RULE_KEY, environment: key }],
            duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
            tokenIcon: { show: false },
        },
    };

    const targets = actors.filter((a) => !a.itemTypes.effect.some((e) => declaredEnvironments(e).includes(key)));
    await Promise.all(targets.map((a) => a.createEmbeddedDocuments("Item", [structuredClone(source)])));
    return targets.length;
}

/** Returns how many actors it was removed from. */
export async function removeEnvironment(key: EnvironmentKey, actors: ActorSf2e[] = selectedActors()): Promise<number> {
    let count = 0;
    await Promise.all(
        actors.map(async (actor) => {
            const ids = actor.itemTypes.effect.filter((e) => declaredEnvironments(e).includes(key)).map((e) => e.id);
            if (ids.length === 0) return;
            count++;
            await actor.deleteEmbeddedDocuments("Item", ids);
        }),
    );
    return count;
}

export async function openEnvironmentDialog(): Promise<void> {
    if (!game.user.isGM) {
        ui.notifications.warn(localize("EnvironmentTool.GMOnly"));
        return;
    }
    if (selectedActors().length === 0) {
        ui.notifications.warn(localize("EnvironmentTool.NoSelection"));
        return;
    }

    const keys = [...(await compendiumEnvironments()).keys()];
    const options = keys
        .map((k) => ({ k, name: environmentName(k) }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ k, name }) => `<option value="${k}">${name}</option>`)
        .join("");
    const content = `
        <div class="form-group">
            <label>${localize("EnvironmentTool.Environment")}</label>
            <select name="environment">${options}</select>
        </div>
        <div class="form-group">
            <label>${localize("EnvironmentTool.CustomKey")}</label>
            <input type="text" name="custom" placeholder="spore-cloud">
            <p class="hint">${localize("EnvironmentTool.CustomKeyHint")}</p>
        </div>`;

    const chosen = (button: HTMLButtonElement): EnvironmentKey => {
        const elements = button.form!.elements as unknown as Record<string, HTMLInputElement>;
        return elements.custom!.value.trim().toLowerCase() || elements.environment!.value;
    };
    const run = async (action: "apply" | "remove", key: EnvironmentKey) => {
        const count = action === "apply" ? await applyEnvironment(key) : await removeEnvironment(key);
        ui.notifications.info(localize(action === "apply" ? "EnvironmentTool.Applied" : "EnvironmentTool.Removed", { name: environmentName(key), count }));
    };

    await foundry.applications.api.DialogV2.wait({
        window: { title: localize("EnvironmentTool.Title") },
        content,
        rejectClose: false,
        buttons: [
            { action: "apply", label: localize("EnvironmentTool.Apply"), default: true, callback: (_e: Event, b: HTMLButtonElement) => run("apply", chosen(b)) },
            { action: "remove", label: localize("EnvironmentTool.Remove"), callback: (_e: Event, b: HTMLButtonElement) => run("remove", chosen(b)) },
        ],
    });
}
