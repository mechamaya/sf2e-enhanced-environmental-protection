import { MODULE_ID } from "../constants.ts";
import { ENVIRONMENT_KEY_PATTERN, type EnvironmentKey, type Hazard } from "../rules/types.ts";
import { ENVIRONMENT_BEHAVIOR_TYPE, type RegionMode } from "./region-behavior.ts";

export interface EnvironmentSettings {
    environments?: Iterable<EnvironmentKey>;
    /** Hours per charge under limited protection, for every environment listed here. */
    limitedDuration?: number | null;
    /** Region behaviors only: how it combines with the scene's environments. */
    mode?: RegionMode;
}

export function getSceneSettings(scene: SceneSf2e): EnvironmentSettings {
    return (scene.flags[MODULE_ID] as EnvironmentSettings | undefined) ?? {};
}

/** Unlinked: its own token. Otherwise its token on the active scene, else its only token. */
export function primaryToken(actor: ActorSf2e): TokenDocumentSf2e | null {
    if (actor.token) return actor.token;
    const tokens = game.scenes.contents.flatMap((s) =>
        s.tokens.contents.filter((t) => t.actorLink && t.actorId === actor.id),
    );
    return tokens.find((t) => t.parent?.active) ?? (tokens.length === 1 ? tokens[0]! : null);
}

// Override, then Add, then Remove, so overlapping regions give the same result in any order.
export function getPlaceHazards(actor: ActorSf2e): Hazard[] {
    const token = primaryToken(actor);
    const scene = token?.parent;
    if (!token || !scene) return [];

    const hazards = new Map<EnvironmentKey, Hazard>();
    const apply = (settings: EnvironmentSettings) => {
        for (const environment of validKeys(settings)) {
            hazards.set(environment, { environment, limitedDuration: settings.limitedDuration ?? null });
        }
    };

    const behaviors = [...token.regions].flatMap((region) =>
        [...region.behaviors]
            .filter((b) => b.type === ENVIRONMENT_BEHAVIOR_TYPE && !b.disabled)
            .map((b) => b.system as EnvironmentSettings),
    );
    const byMode = (mode: RegionMode) => behaviors.filter((settings) => (settings.mode ?? "add") === mode);

    const overrides = byMode("override");
    if (overrides.length > 0) {
        for (const settings of overrides) apply(settings);
    } else {
        apply(getSceneSettings(scene));
    }
    for (const settings of byMode("add")) apply(settings);
    for (const settings of byMode("remove")) {
        for (const key of validKeys(settings)) hazards.delete(key);
    }
    return [...hazards.values()];
}

function validKeys(settings: EnvironmentSettings): EnvironmentKey[] {
    return [...(settings.environments ?? [])].filter((k) => typeof k === "string" && ENVIRONMENT_KEY_PATTERN.test(k));
}
