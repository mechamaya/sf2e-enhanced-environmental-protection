import { MODULE_ID, SECONDS_PER_HOUR } from "../constants.ts";
import { profileArmor, type CoverageSummary } from "../rules/coverage.ts";
import type { RulesPreset } from "../rules/types.ts";
import { getActorCoverage, getStoredState, live, maxCharges, readState } from "./armor-state.ts";
import type { ChargeState } from "./charges.ts";
import { environmentName, environmentNames } from "../environments/names.ts";
import { internalOptions } from "./options.ts";
import { localize } from "../i18n.ts";

type EffectRole = "protection-on" | "protection-off" | "unprotected";

// Fixed IDs: Foundry rejects a duplicate ID, so racing creates can't make two copies.
const EFFECT_IDS: Record<EffectRole, string> = {
    "protection-on": "sf2eepProtOnEffx",
    "protection-off": "sf2eepProtOffEff",
    unprotected: "sf2eepUnprotectd",
};

// Only applies when created; after that it's up to the user.
const SHOW_TOKEN_ICON: Record<EffectRole, boolean> = {
    "protection-on": true,
    "protection-off": false,
    unprotected: true,
};

const ICONS = {
    on: "systems/sf2e/icons/abilities/blue-event-horizon.webp",
    off: `modules/${MODULE_ID}/artwork/environmental_protection_off.png`,
    unprotected: "icons/svg/hazard.svg",
};

const SECONDS_PER_ROUND = 6;

// Prefixed so SF2e Automation, which finds its own effects by slug, leaves ours alone.
const SLUGS: Record<EffectRole, string> = {
    "protection-on": "sf2eep-protection-on",
    "protection-off": "sf2eep-protection-off",
    unprotected: "sf2eep-unprotected",
};

interface EffectView {
    name: string;
    img: string;
    system: {
        slug: string;
        description: { value: string };
        duration: { value: number; unit: string; expiry: null; sustained: false };
        start: { value: number; initiative: null };
        badge: { type: "counter"; value: number; min: number; max: number } | null;
    };
}

function getManagedEffects(actor: ActorSf2e, role: EffectRole): EffectSf2e[] {
    return actor.itemTypes.effect.filter((e) => e.getFlag(MODULE_ID, "role") === role);
}

export function hasManagedEffects(actor: ActorSf2e): boolean {
    return actor.itemTypes.effect.some((e) => !!e.getFlag(MODULE_ID, "role"));
}

export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts = [
        days ? localize("Effect.Days", { n: days }) : "",
        hours ? localize("Effect.Hours", { n: hours }) : "",
        mins && !days ? localize("Effect.Minutes", { n: mins }) : "",
    ].filter(Boolean);
    return parts.join(" ") || localize("Effect.Minutes", { n: 0 });
}

function coverageList(coverage: CoverageSummary): string {
    if (coverage.perHazard.length === 0) return `<p>${localize("Effect.NoHazards")}</p>`;
    const items = coverage.perHazard.map(({ hazard, coverage: c }) => {
        const level =
            c.level === "limited"
                ? localize("Effect.Limited", { hours: c.hoursPerCharge ?? 0 })
                : c.level === "full"
                  ? localize("Effect.Full")
                  : localize("Effect.None");
        const source = c.label ? ` (${c.label})` : "";
        return `<li><strong>${environmentName(hazard.environment)}</strong>: ${level}${source}</li>`;
    });
    return `<ul>${items.join("")}</ul>`;
}

function wouldProtect(actor: ActorSf2e, preset: RulesPreset): boolean {
    return getActorCoverage(actor, preset, true).perHazard.some(({ coverage }) => coverage.source === "armor");
}

const UNLIMITED = { value: -1, unit: "unlimited", expiry: null, sustained: false } as const;

// Hidden when off at full charges, unless switching on would protect: then "off" shows, so it can be
// right-clicked to switch on.
function protectionView(actor: ActorSf2e, preset: RulesPreset): { role: EffectRole; view: EffectView } | null {
    const armor = actor.wornArmor;
    if (!armor || !profileArmor(armor).protective) return null;
    const state: ChargeState = readState(armor, preset);
    const full = state.reserve >= maxCharges(armor, preset) && state.current === 0;
    if (!state.active && full && !wouldProtect(actor, preset)) return null;

    // Pinning min and max to the value makes the badge display-only.
    const badge = { type: "counter", value: state.reserve, min: state.reserve, max: state.reserve } as const;
    // While off, show the rate it would drain at if switched on here.
    const hours = state.active ? state.hoursPerCharge : getActorCoverage(actor, preset, true).hoursPerCharge;
    const reserve = localize("Effect.Reserve", {
        charges: state.reserve,
        time: formatDuration(state.reserve * hours * SECONDS_PER_HOUR),
    });

    if (!state.active) {
        const kept = state.current > 0 ? `<p>${localize("Effect.PartialKept", { percent: Math.round(state.current * 100) })}</p>` : "";
        return { role: "protection-off", view: {
            name: localize("Effect.NameOff"),
            img: ICONS.off,
            system: {
                slug: SLUGS["protection-off"],
                description: { value: `<p>${localize("Effect.Off", { armor: armor.name })}</p><p>${reserve}</p>${kept}` },
                duration: UNLIMITED,
                start: { value: state.settledAt, initiative: null },
                badge,
            },
        } };
    }

    // Durations are whole rounds, so shift the start to make the end exact.
    const remaining = state.current * state.hoursPerCharge * SECONDS_PER_HOUR;
    const rounds = Math.max(1, Math.ceil(remaining / SECONDS_PER_ROUND));
    const coverage = getActorCoverage(actor, preset, true);
    return { role: "protection-on", view: {
        name: localize("Effect.NameOn"),
        img: ICONS.on,
        system: {
            slug: SLUGS["protection-on"],
            description: {
                value:
                    `<p>${localize("Effect.On", { armor: armor.name, hours: state.hoursPerCharge })}</p><p>${reserve}</p>` +
                    coverageList(coverage),
            },
            duration: { value: rounds, unit: "rounds", expiry: null, sustained: false },
            start: { value: state.settledAt + remaining - rounds * SECONDS_PER_ROUND, initiative: null },
            badge,
        },
    } };
}

function unprotectedView(actor: ActorSf2e, preset: RulesPreset): EffectView | null {
    const armorActive = !!actor.wornArmor && !!getStoredState(actor.wornArmor)?.active;
    const coverage = getActorCoverage(actor, preset, armorActive);
    if (coverage.exposedTo.length === 0) return null;

    const environments = environmentNames(coverage.exposedTo.map((h) => h.environment));
    return {
        name: localize("Effect.NameUnprotected", { environments }),
        img: ICONS.unprotected,
        system: {
            slug: SLUGS.unprotected,
            description: { value: `<p>${localize("Effect.Unprotected", { environments })}</p>${coverageList(coverage)}` },
            duration: UNLIMITED,
            start: { value: 0, initiative: null },
            badge: null,
        },
    };
}

function matches(effect: EffectSf2e, view: EffectView): boolean {
    const s = effect.system;
    const badgeValue = s.badge?.value ?? null;
    return (
        effect.slug === view.system.slug &&
        effect.name === view.name &&
        effect.img === view.img &&
        s.description.value === view.system.description.value &&
        s.duration.value === view.system.duration.value &&
        s.duration.unit === view.system.duration.unit &&
        (view.system.duration.unit === "unlimited" || s.start.value === view.system.start.value) &&
        badgeValue === (view.system.badge?.value ?? null) &&
        (s.badge?.min ?? null) === (view.system.badge?.min ?? null) &&
        (s.badge?.max ?? null) === (view.system.badge?.max ?? null)
    );
}

async function withEffect(actor: ActorSf2e, id: string, op: (effect: EffectSf2e) => Promise<unknown>): Promise<void> {
    const effect = live(actor).items.get(id);
    if (effect) await op(effect as EffectSf2e);
}

async function apply(staleActor: ActorSf2e, role: EffectRole, view: EffectView | null): Promise<void> {
    const actor = live(staleActor);
    // Remove extra copies.
    const [existing, ...extras] = getManagedEffects(actor, role).map((e) => e.id);
    for (const id of extras) await withEffect(actor, id, (e) => e.delete(internalOptions()));
    if (!view) {
        if (existing) await withEffect(actor, existing, (e) => e.delete(internalOptions()));
        return;
    }
    if (!existing) {
        const data = {
            _id: EFFECT_IDS[role],
            type: "effect",
            ...view,
            system: { ...view.system, tokenIcon: { show: SHOW_TOKEN_ICON[role] } },
            flags: { [MODULE_ID]: { role } },
        };
        await actor.createEmbeddedDocuments("Item", [data], { ...internalOptions(), keepId: true });
    } else {
        await withEffect(actor, existing, async (e) => {
            if (!matches(e, view)) await e.update(view as unknown as Record<string, unknown>, internalOptions());
        });
    }
}

export async function syncEffects(actor: ActorSf2e, preset: RulesPreset): Promise<void> {
    if (!actor.allowedItemTypes.includes("effect")) return;
    const protection = protectionView(actor, preset);
    // Each apply re-resolves the actor, since the previous one awaited database changes.
    await apply(actor, "protection-on", protection?.role === "protection-on" ? protection.view : null);
    await apply(actor, "protection-off", protection?.role === "protection-off" ? protection.view : null);
    await apply(actor, "unprotected", unprotectedView(actor, preset));
}
