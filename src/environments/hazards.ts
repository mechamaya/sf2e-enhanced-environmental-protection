import { getHazards } from "../rule-elements/environmental-hazard.ts";
import type { EnvironmentKey, Hazard } from "../rules/types.ts";
import { getPlaceHazards } from "./places.ts";

/** An effect on the actor wins over the scene or a region for the same environment. */
export function getActorHazards(actor: ActorSf2e): Hazard[] {
    const hazards = new Map<EnvironmentKey, Hazard>();
    for (const hazard of getPlaceHazards(actor)) hazards.set(hazard.environment, hazard);
    for (const hazard of getHazards(actor)) hazards.set(hazard.environment, hazard);
    return [...hazards.values()];
}
