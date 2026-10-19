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

type Badge = NonNullable<EffectSf2e["system"]["badge"]>;

// Within the badge's min (1 by default, as in the system) and max.
function badgeLevel(badge: Badge, level: number): number {
    return Math.min(Math.max(Math.round(level), badge.min ?? 1), badge.max ?? Number.POSITIVE_INFINITY);
}

/** With a `level`, actors already in the environment change to it. Returns how many were applied or changed. */
export async function applyEnvironment(
    key: EnvironmentKey,
    actors: ActorSf2e[] = selectedActors(),
    level?: number,
): Promise<number> {
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

    const badge = (source.system as { badge?: Badge | null }).badge;
    if (level !== undefined && badge?.type === "counter") badge.value = badgeLevel(badge, level);

    const existing = (a: ActorSf2e) => a.itemTypes.effect.filter((e) => declaredEnvironments(e).includes(key));
    const targets = actors.filter((a) => existing(a).length === 0);
    await Promise.all(targets.map((a) => a.createEmbeddedDocuments("Item", [structuredClone(source)])));
    if (level === undefined) return targets.length;

    let changed = 0;
    for (const effect of actors.flatMap(existing)) {
        const current = effect.system.badge;
        if (current?.type !== "counter" || current.value === badgeLevel(current, level)) continue;
        await effect.update({ system: { badge: { ...current, value: badgeLevel(current, level) } } });
        changed++;
    }
    return targets.length + changed;
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
        </div>
        <div class="form-group">
            <label>${localize("EnvironmentTool.Level")}</label>
            <input type="number" name="level" min="1" step="1">
            <p class="hint">${localize("EnvironmentTool.LevelHint")}</p>
        </div>`;

    const elements = (button: HTMLButtonElement) => button.form!.elements as unknown as Record<string, HTMLInputElement>;
    const chosen = (button: HTMLButtonElement): EnvironmentKey =>
        elements(button).custom!.value.trim().toLowerCase() || elements(button).environment!.value;
    const level = (button: HTMLButtonElement): number | undefined => {
        const value = elements(button).level!.value;
        return value === "" ? undefined : Number(value);
    };
    const run = async (action: "apply" | "remove", key: EnvironmentKey, at?: number) => {
        const count = action === "apply" ? await applyEnvironment(key, undefined, at) : await removeEnvironment(key);
        ui.notifications.info(localize(action === "apply" ? "EnvironmentTool.Applied" : "EnvironmentTool.Removed", { name: environmentName(key), count }));
    };

    await foundry.applications.api.DialogV2.wait({
        window: { title: localize("EnvironmentTool.Title") },
        content,
        rejectClose: false,
        buttons: [
            { action: "apply", label: localize("EnvironmentTool.Apply"), default: true, callback: (_e: Event, b: HTMLButtonElement) => run("apply", chosen(b), level(b)) },
            { action: "remove", label: localize("EnvironmentTool.Remove"), callback: (_e: Event, b: HTMLButtonElement) => run("remove", chosen(b)) },
        ],
    });
}
