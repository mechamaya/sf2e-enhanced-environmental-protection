import { MODULE_ID } from "../constants.ts";
import { ENVIRONMENT_BEHAVIOR_TYPE } from "./region-behavior.ts";

type Reconcile = (actor: ActorSf2e) => void;

function changedOurFlags(changed: Record<string, unknown>): boolean {
    const flags = changed.flags as Record<string, unknown> | undefined;
    return !!flags && Object.keys(flags).some((k) => k === MODULE_ID || k === `-=${MODULE_ID}`);
}

function actorsOn(tokens: Iterable<TokenDocumentSf2e>): ActorSf2e[] {
    return [...new Set([...tokens].flatMap((t) => t.actor ?? []))];
}

// Token region membership is stored in _regions, so a change there means it entered or left a region.
export function registerPlaceHooks(reconcileActor: Reconcile, reconcileAll: () => void): void {
    Hooks.on("createToken", (token: TokenDocumentSf2e) => token.actor && reconcileActor(token.actor));
    Hooks.on("deleteToken", (token: TokenDocumentSf2e) => {
        // Only reconcile the actor if it was linked to the token.
        if (token.actorLink && token.actor) reconcileActor(token.actor);
    });
    Hooks.on("updateToken", (token: TokenDocumentSf2e, changed: Record<string, unknown>) => {
        const relevant = ["_regions", "actorId", "actorLink"].some((k) => k in changed);
        if (relevant && token.actor) reconcileActor(token.actor);
    });

    Hooks.on("updateScene", (scene: SceneSf2e, changed: Record<string, unknown>) => {
        if ("active" in changed) return reconcileAll();
        if (changedOurFlags(changed)) actorsOn(scene.tokens.contents).forEach(reconcileActor);
    });
    // Any change to an Environmental Hazard behavior affects the tokens already inside its region.
    const onBehavior = (behavior: RegionBehaviorSf2e) => {
        if (behavior.type === ENVIRONMENT_BEHAVIOR_TYPE && behavior.parent) actorsOn(behavior.parent.tokens).forEach(reconcileActor);
    };
    Hooks.on("createRegionBehavior", onBehavior);
    Hooks.on("updateRegionBehavior", onBehavior);
    Hooks.on("deleteRegionBehavior", onBehavior);
}
