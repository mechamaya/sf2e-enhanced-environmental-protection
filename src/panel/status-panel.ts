import { toggleProtection, rechargeProtection } from "../api.ts";
import { MODULE_ID } from "../constants.ts";
import { openChargesDialog } from "../edit-charges.ts";
import { getActivePreset } from "../rules/presets.ts";
import { getSetting, setSetting, type PanelEdge } from "../settings.ts";
import { transferCharge } from "../transfer.ts";
import {
    buildCard,
    buildSummary,
    foldCovered,
    isRelevant,
    relevanceKey,
    type CharacterCard,
    type ChargeView,
    type EnvironmentChip,
    type PartySummary,
} from "./card.ts";
import { localize } from "../i18n.ts";

// Left goes above the players list, which is wider than its column and would overlap.
const DOCKS: Record<Exclude<PanelEdge, "hidden">, { container: string; before: string | null }> = {
    left: { container: "ui-left-column-1", before: "players" },
    right: { container: "ui-right-column-1", before: null },
    top: { container: "ui-top", before: null },
    bottom: { container: "ui-bottom", before: "hotbar" },
};

const HOOKS = [
    "controlToken",
    "updateActor",
    "createItem",
    "updateItem",
    "deleteItem",
    "updateWorldTime",
    "updateToken",
    "updateScene",
    "createRegionBehavior",
    "updateRegionBehavior",
    "deleteRegionBehavior",
    "canvasReady",
];

const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const button = (action: string, icon: string, label: string, extra = "") =>
    `<button type="button" data-action="${action}" class="${extra}" aria-label="${escapeHtml(label)}" data-tooltip-text="${escapeHtml(label)}"><i class="${icon}"></i></button>`;

const controls = (pinned: boolean) =>
    button("pin", "fa-solid fa-thumbtack", localize(pinned ? "Panel.Unpin" : "Panel.Pin"), pinned ? "minor pinned" : "minor") +
    button("close", "fa-solid fa-xmark", localize("Panel.Close"), "minor");

function chipHtml(chip: EnvironmentChip): string {
    const hours = chip.hours ? `<span>${chip.hours}h</span>` : "";
    return `<span class="env ${chip.level}" data-tooltip-text="${escapeHtml(chip.tooltip)}"><i class="${chip.icon}"></i>${hours}</span>`;
}

const timeHtml = (c: ChargeView) => `<span class="time" data-tooltip-text="${escapeHtml(c.timeTooltip)}">${escapeHtml(c.time)}</span>`;

const reserveHtml = (c: ChargeView) =>
    `<span class="reserve" data-tooltip-text="${escapeHtml(c.chargesTooltip)}"><i class="fa-solid fa-battery-half"></i>${escapeHtml(c.charges)}</span>`;

function cardHtml(card: CharacterCard, headerControls: string): string {
    const c = card.charges;
    const charges = c
        ? `<div class="row actions">
            ${button("toggle", c.active ? "fa-solid fa-shield-halved" : "fa-solid fa-power-off", localize(c.active ? "Panel.SwitchOff" : "Panel.SwitchOn"), c.active ? "on" : "off")}
            ${button("recharge", "fa-solid fa-bolt", localize("Panel.Recharge"))}
            ${button("transfer", "fa-solid fa-right-to-bracket", localize("Panel.Transfer"))}
            ${button("edit", "fa-solid fa-pen", localize("Panel.Edit"))}
            ${timeHtml(c)}
            ${reserveHtml(c)}
        </div>
        <div class="bar ${c.active ? "on" : "off"}"><div style="width: ${Math.round(c.bar * 100)}%"></div></div>`
        : "";
    const environments = card.environments.length
        ? `<div class="row environments">${card.environments.map(chipHtml).join("")}</div>`
        : "";
    return `<section class="card">
        <div class="row header">
            <img src="${escapeHtml(card.img)}" alt="">
            <span class="name" data-tooltip-text="${escapeHtml(card.armor ?? localize("Panel.NoArmor"))}">${escapeHtml(card.name)}</span>
            ${headerControls}
        </div>
        ${charges}
        ${environments}
    </section>`;
}

function summaryChipsHtml(chips: EnvironmentChip[]): string {
    const { shown, covered } = foldCovered(chips);
    const folded = covered.length
        ? `<span class="env full" data-tooltip-text="${escapeHtml(localize("Panel.Covered", { environments: covered.map((c) => c.name).join(", ") }))}"><i class="fa-solid fa-check"></i>${covered.length}</span>`
        : "";
    return shown.map(chipHtml).join("") + folded;
}

function memberHtml(card: CharacterCard): string {
    const c = card.charges;
    const state = c
        ? `<i class="state ${c.active ? "on fa-solid fa-shield-halved" : "off fa-solid fa-power-off"}" data-tooltip-text="${escapeHtml(localize(c.active ? "Panel.On" : "Panel.Off"))}"></i>${timeHtml(c)}${reserveHtml(c)}`
        : `<i class="state off fa-solid fa-ban" data-tooltip-text="${escapeHtml(localize("Panel.NoArmor"))}"></i>`;
    return `<div class="row member" data-action="focus" data-uuid="${escapeHtml(card.uuid)}">
        <img src="${escapeHtml(card.img)}" alt="" data-tooltip-text="${escapeHtml(card.name)}">
        ${state}
        <span class="chips">${summaryChipsHtml(card.environments)}</span>
    </div>`;
}

function summaryHtml(summary: PartySummary, headerControls: string): string {
    const badge = summary.exposed
        ? `<span class="env none" data-tooltip-text="${escapeHtml(localize("Panel.Exposed", { count: summary.exposed }))}"><i class="fa-solid fa-triangle-exclamation"></i>${summary.exposed}</span>`
        : "";
    return `<section class="card summary">
        <div class="row header">
            <i class="fa-solid fa-users"></i>
            <span class="name">${escapeHtml(localize("Panel.Party"))}</span>
            ${badge}
            ${headerControls}
        </div>
        ${summary.members.map(memberHtml).join("")}
    </section>`;
}

/** Without a party: player-owned characters. */
function partyMembers(): ActorSf2e[] {
    return game.actors.party?.members ?? game.actors.contents.filter((a) => a.type === "character" && a.hasPlayerOwner);
}

export class StatusPanel {
    readonly element = document.createElement("aside");
    #timer: number | undefined;
    /** Stays closed until the situation changes. */
    #closedKey: string | null = null;
    #actor: ActorSf2e | null = null;
    /** GM: a party member with no token on the scene, picked from the summary. */
    #focused: ActorSf2e | null = null;
    #key: string | null = null;
    #html = "";

    constructor() {
        this.element.id = `${MODULE_ID}-panel`;
        this.element.addEventListener("click", (event) => this.#onClick(event));
        for (const hook of HOOKS) Hooks.on(hook, () => this.refresh());
        Hooks.on("controlToken", (_token: unknown, controlled: boolean) => {
            if (controlled) this.#focused = null;
        });
    }

    refresh(): void {
        window.clearTimeout(this.#timer);
        this.#timer = window.setTimeout(() => this.render(), 100);
    }

    #currentActor(): ActorSf2e | null {
        const actor = canvas.tokens?.controlled[0]?.actor ?? this.#focused ?? game.user.character;
        return actor?.isOwner ? actor : null;
    }

    render(): void {
        const edge = getSetting("panelEdge");
        if (edge === "hidden") {
            this.#hide();
            return;
        }

        const preset = getActivePreset();
        const pinned = getSetting("panelPinned");
        const actor = this.#currentActor();
        const card = actor ? buildCard(actor, preset) : null;
        const summary = game.user.isGM ? buildSummary(partyMembers(), preset) : null;
        const showCard = !!card && (pinned || isRelevant(card) || this.#focused === actor);
        const showSummary = !!summary?.members.length && (pinned || summary.members.some(isRelevant));

        const key = [card, ...(summary?.members ?? [])].map((c) => (c ? relevanceKey(c) : "")).join("/");
        if (this.#closedKey !== key) this.#closedKey = null;
        if (this.#closedKey || !(showCard || showSummary)) {
            this.#hide();
            return;
        }

        this.#actor = showCard ? actor : null;
        this.#key = key;
        this.element.className = `edge-${edge}`;
        const html =
            (showCard ? cardHtml(card!, controls(pinned)) : "") +
            (showSummary ? summaryHtml(summary!, showCard ? "" : controls(pinned)) : "");
        if (html !== this.#html) this.element.innerHTML = this.#html = html;
        const dock = DOCKS[edge];
        const container = document.getElementById(dock.container);
        if (container && this.element.parentElement !== container) {
            const before = dock.before ? document.getElementById(dock.before) : null;
            container.insertBefore(this.element, before?.parentElement === container ? before : null);
        }
    }

    #hide(): void {
        this.#actor = null;
        this.#html = "";
        this.element.remove();
    }

    /** No token on this scene: show their card instead (click again to hide it). */
    #focus(uuid: string): void {
        const token = canvas.tokens?.placeables.find((t) => t.actor?.uuid === uuid);
        if (token) {
            token.control({ releaseOthers: true });
            return;
        }
        const actor = fromUuidSync(uuid) as ActorSf2e | null;
        this.#focused = this.#focused?.uuid === uuid ? null : actor;
        this.render();
    }

    #onClick(event: MouseEvent): void {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
        const action = target?.dataset.action;
        switch (action) {
            case "pin":
                setSetting("panelPinned", !getSetting("panelPinned"));
                return;
            case "close":
                this.#closedKey = this.#key;
                if (getSetting("panelPinned")) setSetting("panelPinned", false);
                this.#hide();
                return;
            case "focus":
                this.#focus(target!.dataset.uuid ?? "");
                return;
        }
        const actor = this.#actor;
        if (!actor) return;
        switch (action) {
            case "toggle":
                toggleProtection(actor);
                break;
            case "recharge":
                rechargeProtection(actor);
                break;
            case "transfer":
                transferCharge({ source: actor });
                break;
            case "edit":
                openChargesDialog(actor);
                break;
        }
    }
}
