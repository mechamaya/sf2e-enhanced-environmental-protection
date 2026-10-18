import {
    activateProtection,
    deactivateProtection,
    getStatus,
    rechargeProtection,
    toggleProtection,
} from "./api.ts";
import {
    disableSf2eAutomationProtection,
    isSf2eAutomationActive,
    warnIncompleteCompat,
} from "./compat/sf2e-automation.ts";
import { MODULE_ID } from "./constants.ts";
import { getActorHazards } from "./environments/hazards.ts";
import { applyEnvironment, openEnvironmentDialog, removeEnvironment } from "./gm/environment-tool.ts";
import { registerPlaceHooks } from "./environments/place-hooks.ts";
import { registerHazardRuleElement } from "./rule-elements/environmental-hazard.ts";
import { getProtections, registerProtectionRuleElement } from "./rule-elements/environmental-protection.ts";
import { getActivePreset } from "./rules/presets.ts";
import { getSetting, registerSettings } from "./settings.ts";
import { registerSceneConfig } from "./ui/place-config.ts";
import { registerEnvironmentBehavior } from "./environments/region-behavior.ts";
import { allActors, hasActiveArmor, serialized } from "./state/armor-state.ts";
import { syncEffects } from "./state/effects.ts";
import { readOptions } from "./state/options.ts";
import { registerSocket } from "./socket.ts";
import { registerTransfer, transferCharge } from "./transfer.ts";
import { openChargesDialog, setCharges } from "./edit-charges.ts";
import { StatusPanel } from "./panel/status-panel.ts";
import { needsReconcile, reconcile } from "./state/reconcile.ts";
import { localize } from "./i18n.ts";

let panel: StatusPanel | null = null;

const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

function reconcileAll(filter: (actor: ActorSf2e) => boolean = needsReconcile): void {
    if (!isActiveGM()) return;
    for (const actor of allActors()) {
        if (filter(actor)) reconcile(actor);
    }
}

function onItemChange(item: ItemSf2e, options: Record<string, unknown>): void {
    if (!isActiveGM() || !item.actor || readOptions(options)?.internal) return;
    if (needsReconcile(item.actor)) reconcile(item.actor);
}

/** Expired: reconcile to start the next charge. Deleted by someone: switch protection off. */
function onProtectionEffectDeleted(effect: EffectSf2e, userId: string): void {
    const actor = effect.actor;
    if (!actor) return;
    if (effect.isExpired) {
        if (isActiveGM()) reconcile(actor);
    } else if (userId === game.user.id) {
        deactivateProtection(actor);
    }
}

/** Deleting the "off" effect switches protection on. */
async function onProtectionOffEffectDeleted(effect: EffectSf2e, userId: string): Promise<void> {
    const actor = effect.actor;
    if (!actor || userId !== game.user.id) return;
    await activateProtection(actor);
    await serialized(actor, () => syncEffects(actor, getActivePreset()));
}

Hooks.once("init", () => {
    if (game.system.id !== "sf2e") return;
    registerSettings(
        () => reconcileAll(),
        () => panel?.refresh(),
    );
    registerHazardRuleElement();
    registerProtectionRuleElement();
    registerEnvironmentBehavior();

    let compatMissing: string[] = [];
    if (isSf2eAutomationActive() && getSetting("disableSf2eAutomation")) {
        compatMissing = disableSf2eAutomationProtection({ toggle: () => toggleProtection(), recharge: () => rechargeProtection() });
    }

    // Only active armor depends on time; managed effects count themselves down.
    Hooks.on("updateWorldTime", () => reconcileAll(hasActiveArmor));
    Hooks.on("createItem", (item: ItemSf2e, options: Record<string, unknown>) => onItemChange(item, options));
    Hooks.on("updateItem", (item: ItemSf2e, _changed: unknown, options: Record<string, unknown>) => {
        onItemChange(item, options);
        if (readOptions(options)?.event === "depleted" && item.isOwner) {
            ui.notifications.warn(localize("Notifications.Depleted", { armor: item.name }));
        }
    });
    Hooks.on("deleteItem", (item: ItemSf2e, options: Record<string, unknown>, userId: string) => {
        const role = readOptions(options)?.internal ? null : item.getFlag(MODULE_ID, "role");
        if (role === "protection-on") onProtectionEffectDeleted(item as EffectSf2e, userId);
        else if (role === "protection-off") onProtectionOffEffectDeleted(item as EffectSf2e, userId);
        else onItemChange(item, options);
    });
    registerPlaceHooks(
        (actor) => isActiveGM() && needsReconcile(actor) && reconcile(actor),
        () => reconcileAll(),
    );
    registerSceneConfig();

    Hooks.once("ready", () => {
        const module = game.modules.get(MODULE_ID);
        if (!module) return;
        module.api = {
            getStatus,
            activate: activateProtection,
            deactivate: deactivateProtection,
            toggle: toggleProtection,
            recharge: rechargeProtection,
            transferCharge,
            setCharges,
            openChargesDialog,
            applyEnvironment,
            removeEnvironment,
            openEnvironmentDialog,
            getHazards: getActorHazards,
            getProtections,
            getActivePreset,
        };
        panel = new StatusPanel();
        panel.render();
        registerSocket();
        registerTransfer();
        warnIncompleteCompat(compatMissing);
        // Catch up on anything that changed while no GM was connected.
        reconcileAll();
    });
});
