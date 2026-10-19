import { isSf2eAutomationActive } from "./compat/sf2e-automation.ts";
import { I18N, MODULE_ID } from "./constants.ts";

interface SettingTypes {
    limitedProtection: boolean;
    keepPartialCharges: boolean;
    ancestryProtection: boolean;
    disableSf2eAutomation: boolean;
    panelEdge: PanelEdge;
    panelPinned: boolean;
}

const PANEL_EDGES = ["left", "right", "top", "bottom", "hidden"] as const;
export type PanelEdge = (typeof PANEL_EDGES)[number];
type SettingKey = keyof SettingTypes;

export function registerSettings(onRulesChange: () => void, onPanelChange: () => void): void {
    for (const key of ["limitedProtection", "keepPartialCharges", "ancestryProtection"] as const) {
        game.settings.register(MODULE_ID, key, {
            name: `${I18N}.Settings.${key}.Name`,
            hint: `${I18N}.Settings.${key}.Hint`,
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: onRulesChange,
        });
    }

    // Only shown when SF2e Automation is active; registered regardless so reading it never fails.
    game.settings.register(MODULE_ID, "disableSf2eAutomation", {
        name: `${I18N}.Settings.disableSf2eAutomation.Name`,
        hint: `${I18N}.Settings.disableSf2eAutomation.Hint`,
        scope: "world",
        config: isSf2eAutomationActive(),
        type: Boolean,
        default: true,
        requiresReload: true,
    });

    game.settings.register(MODULE_ID, "panelEdge", {
        name: `${I18N}.Settings.panelEdge.Name`,
        hint: `${I18N}.Settings.panelEdge.Hint`,
        scope: "client",
        config: true,
        type: String,
        choices: Object.fromEntries(PANEL_EDGES.map((e) => [e, `${I18N}.Settings.panelEdge.${e}`])),
        default: "left",
        onChange: onPanelChange,
    });
    game.settings.register(MODULE_ID, "panelPinned", {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
        onChange: onPanelChange,
    });
}

export function setSetting<K extends SettingKey>(key: K, value: SettingTypes[K]): Promise<unknown> {
    return game.settings.set(MODULE_ID, key, value);
}

export function getSetting<K extends SettingKey>(key: K): SettingTypes[K] {
    return game.settings.get(MODULE_ID, key) as SettingTypes[K];
}
