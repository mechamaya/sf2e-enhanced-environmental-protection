import { MODULE_ID } from "../constants.ts";
import { getSceneSettings } from "../environments/places.ts";
import { localize } from "../i18n.ts";

const FIELDSET_CLASS = "sf2eep-environments";

export function registerSceneConfig(): void {
    // Prefer the system's own tab, where its environment types live; fall back to core's Environment tab.
    Hooks.on("renderSceneConfig", (app: { document: SceneSf2e }, element: HTMLElement) => {
        const tab =
            element.querySelector(`.tab[data-tab="${game.system.id}"]`) ??
            element.querySelector('.tab[data-tab="environment"]');
        if (tab) inject(tab, app.document);
    });
}

function inject(container: Element, scene: SceneSf2e): void {
    // A full or partial re-render rebuilds the tab, so this runs on every render but only adds the section once.
    if (container.querySelector(`.${FIELDSET_CLASS}`)) return;
    const fields = foundry.data.fields;
    const settings = getSceneSettings(scene);
    const name = (key: string) => `flags.${MODULE_ID}.${key}`;

    const fieldset = document.createElement("fieldset");
    fieldset.classList.add(FIELDSET_CLASS);
    const legend = document.createElement("legend");
    legend.textContent = localize("SceneConfig.Legend");
    fieldset.append(
        legend,
        new fields.SetField(new fields.StringField({ blank: false })).toFormGroup(
            { label: localize("SceneConfig.Environments.Label"), hint: localize("SceneConfig.Environments.Hint") },
            { name: name("environments"), value: [...(settings.environments ?? [])] },
        ),
        new fields.NumberField({ nullable: true, positive: true }).toFormGroup(
            { label: localize("SceneConfig.LimitedDuration.Label"), hint: localize("SceneConfig.LimitedDuration.Hint") },
            { name: name("limitedDuration"), value: settings.limitedDuration ?? null },
        ),
    );
    container.append(fieldset);
}
