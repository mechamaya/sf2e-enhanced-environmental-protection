import { SECONDS_PER_HOUR } from "../constants.ts";
import { environmentIcon } from "../environments/icons.ts";
import { environmentName } from "../environments/names.ts";
import { profileArmor } from "../rules/coverage.ts";
import type { CoverageLevel, EnvironmentKey, RulesPreset } from "../rules/types.ts";
import { formatCharges, getActorCoverage, maxCharges, settledState } from "../state/armor-state.ts";
import { totalCharges } from "../state/charges.ts";
import { formatDuration } from "../state/effects.ts";
import { localize } from "../i18n.ts";

const SECONDS_PER_ROUND = 6;

export interface EnvironmentChip {
    key: EnvironmentKey;
    name: string;
    icon: string;
    level: CoverageLevel;
    hours: number | null;
    tooltip: string;
}

export interface ChargeView {
    active: boolean;
    /** On: the charge in use. Off: all charges against the maximum. */
    bar: number;
    /** On: time left on this charge. Off: how long all charges would last. */
    time: string;
    timeTooltip: string;
    /** On: reserve charges. Off: charges out of the maximum. */
    charges: string;
    chargesTooltip: string;
}

export interface CharacterCard {
    uuid: string;
    name: string;
    img: string;
    armor: string | null;
    /** Null without protective armor. */
    charges: ChargeView | null;
    environments: EnvironmentChip[];
}

function formatTimeLeft(seconds: number): string {
    return seconds < 60 ? localize("Panel.Rounds", { n: Math.ceil(seconds / SECONDS_PER_ROUND) }) : formatDuration(seconds);
}

function chargeView(actor: ActorSf2e, armor: ArmorSf2e, preset: RulesPreset): ChargeView {
    const state = settledState(armor, preset);
    const max = maxCharges(armor, preset);
    if (state.active) {
        const time = formatTimeLeft(state.current * state.hoursPerCharge * SECONDS_PER_HOUR);
        return {
            active: true,
            bar: state.current,
            time,
            timeTooltip: localize("Panel.TimeOn", { time }),
            charges: formatCharges(state.reserve),
            chargesTooltip: localize("Panel.ChargesOn", { charges: formatCharges(state.reserve) }),
        };
    }
    const total = totalCharges(state);
    // The rate it would drain at if switched on here.
    const hours = getActorCoverage(actor, preset, true).hoursPerCharge;
    const time = formatDuration(total * hours * SECONDS_PER_HOUR);
    const charges = `${formatCharges(total)}/${max}`;
    return {
        active: false,
        bar: max > 0 ? total / max : 0,
        time,
        timeTooltip: localize("Panel.TimeOff", { time }),
        charges,
        chargesTooltip: localize("Panel.ChargesOff", { charges: formatCharges(total), max }),
    };
}

function levelText(level: CoverageLevel, hours: number | null): string {
    if (level === "limited") return localize("Effect.Limited", { hours: hours ?? 0 });
    return localize(level === "full" ? "Effect.Full" : "Effect.None");
}

export function buildCard(actor: ActorSf2e, preset: RulesPreset): CharacterCard {
    const armor = actor.wornArmor && profileArmor(actor.wornArmor).protective ? actor.wornArmor : null;
    const charges = armor ? chargeView(actor, armor, preset) : null;
    const coverage = getActorCoverage(actor, preset, !!charges?.active);
    return {
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        armor: armor?.name ?? null,
        charges,
        environments: coverage.perHazard.map(({ hazard, coverage: c }) => ({
            key: hazard.environment,
            icon: environmentIcon(hazard.environment),
            level: c.level,
            hours: c.level === "limited" ? c.hoursPerCharge : null,
            name: environmentName(hazard.environment),
            tooltip: `${environmentName(hazard.environment)}: ${levelText(c.level, c.hoursPerCharge)}`,
        })),
    };
}

export function isRelevant(card: CharacterCard): boolean {
    return !!card.charges?.active || card.environments.length > 0;
}

export const SUMMARY_CHIPS = 3;

/** Folds fully protected chips into one when a row has too many. Never folds limited or unprotected ones. */
export function foldCovered(chips: EnvironmentChip[]): { shown: EnvironmentChip[]; covered: EnvironmentChip[] } {
    const covered = chips.filter((c) => c.level === "full");
    if (chips.length <= SUMMARY_CHIPS || covered.length < 2) return { shown: chips, covered: [] };
    return { shown: chips.filter((c) => c.level !== "full"), covered };
}

export function isExposed(card: CharacterCard): boolean {
    return card.environments.some((e) => e.level === "none");
}

export interface PartySummary {
    /** Exposed first. */
    members: CharacterCard[];
    exposed: number;
}

export function buildSummary(actors: ActorSf2e[], preset: RulesPreset): PartySummary {
    const members = actors.map((a) => buildCard(a, preset)).sort((a, b) => Number(isExposed(b)) - Number(isExposed(a)));
    return { members, exposed: members.filter(isExposed).length };
}

/** Changes when the card's situation does, so a closed card comes back. */
export function relevanceKey(card: CharacterCard): string {
    return [card.uuid, card.charges?.active ?? "", ...card.environments.map((e) => `${e.key}=${e.level}`)].join("|");
}
