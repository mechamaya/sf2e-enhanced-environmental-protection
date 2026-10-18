import { HAZARD_RULE_KEY, I18N } from "../constants.ts";
import { optionalHoursField } from "./fields.ts";
import { ENVIRONMENT_KEY_HINT, ENVIRONMENT_KEY_PATTERN, type EnvironmentKey, type Hazard } from "../rules/types.ts";

/**
 * { "key": "EnvironmentalHazard", "environment": "thick:severe", "limitedDuration": 4 }
 * Adds the roll option environment:<key>.
 */
interface HazardRuleElement extends RuleElementInstance {
    environment: EnvironmentKey;
    limitedDuration: number | null | undefined;
    active: boolean;
}

export function registerHazardRuleElement(): void {
    const { RuleElement } = game.pf2e;
    const fields = foundry.data.fields;

    class EnvironmentalHazardRuleElement extends RuleElement {
        declare environment: EnvironmentKey;
        declare limitedDuration: number | null | undefined;
        active = false;

        static override autogenForms = true;

        static override LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, `${I18N}.RuleElement.EnvironmentalHazard`];

        static override defineSchema(): Record<string, unknown> {
            return {
                ...super.defineSchema(),
                environment: new fields.StringField({ required: true, blank: false, trim: true }),
                limitedDuration: optionalHoursField(),
            };
        }

        override beforePrepareData(): void {
            if (!ENVIRONMENT_KEY_PATTERN.test(this.environment)) {
                this.failValidation(`environment: "${this.environment}" must be ${ENVIRONMENT_KEY_HINT}`);
            }
            this.active = !this.ignored && this.test();
            if (this.active) this.actor.rollOptions.all[`environment:${this.environment}`] = true;
        }
    }

    game.pf2e.RuleElements.custom[HAZARD_RULE_KEY] = EnvironmentalHazardRuleElement;
}

export function getHazards(actor: ActorSf2e): Hazard[] {
    return actor.rules
        .filter((r): r is HazardRuleElement => r.key === HAZARD_RULE_KEY && (r as HazardRuleElement).active)
        .map((r) => ({ environment: r.environment, limitedDuration: r.limitedDuration ?? null }));
}
