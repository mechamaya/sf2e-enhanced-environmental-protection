import { I18N, MODULE_ID } from "../constants.ts";

const REGION_MODES = ["add", "remove", "override"] as const;
export type RegionMode = (typeof REGION_MODES)[number];

/** Module sub-types are namespaced by module id; declared under `documentTypes.RegionBehavior` in module.json. */
export const ENVIRONMENT_BEHAVIOR_TYPE = `${MODULE_ID}.environment`;

const L = `${I18N}.RegionBehavior`;

export function registerEnvironmentBehavior(): void {
    const fields = foundry.data.fields;

    class EnvironmentalHazardBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
        static override defineSchema(): Record<string, unknown> {
            return {
                environments: new fields.SetField(new fields.StringField({ required: true, blank: false, trim: true }), {
                    label: `${L}.Environments.Label`,
                    hint: `${L}.Environments.Hint`,
                }),
                mode: new fields.StringField({
                    required: true,
                    blank: false,
                    choices: Object.fromEntries(REGION_MODES.map((m) => [m, `${L}.Mode.${m}`])),
                    initial: "add",
                    label: `${L}.Mode.Label`,
                    hint: `${L}.Mode.Hint`,
                }),
                limitedDuration: new fields.NumberField({
                    required: false,
                    nullable: true,
                    positive: true,
                    initial: null,
                    label: `${L}.LimitedDuration.Label`,
                    hint: `${L}.LimitedDuration.Hint`,
                }),
            };
        }
    }

    CONFIG.RegionBehavior.dataModels[ENVIRONMENT_BEHAVIOR_TYPE] = EnvironmentalHazardBehaviorType;
    CONFIG.RegionBehavior.typeIcons[ENVIRONMENT_BEHAVIOR_TYPE] = "fa-solid fa-biohazard";
    CONFIG.RegionBehavior.typeLabels[ENVIRONMENT_BEHAVIOR_TYPE] = `${L}.Label`;
}
