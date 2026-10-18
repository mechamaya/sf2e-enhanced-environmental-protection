import { I18N, PROTECTION_RULE_KEY } from "../constants.ts";
import { optionalHoursField } from "./fields.ts";
import {
    ENVIRONMENT_KEY_HINT,
    ENVIRONMENT_KEY_PATTERN,
    PROTECTION_LEVELS,
    type EnvironmentKey,
    type Protection,
    type ProtectionLevel,
    type ProtectionSource,
} from "../rules/types.ts";

/**
 * { "key": "EnvironmentalProtection", "counters": ["vacuum"], "level": "limited", "limitedDuration": 4 }
 * On armor or its upgrades it only works while protection is switched on; anywhere else it's innate.
 */
interface ProtectionRuleElement extends RuleElementBase {
    counters: Set<EnvironmentKey>;
    level: ProtectionLevel;
    limitedDuration: number | null | undefined;
    active: boolean;
}

export function registerProtectionRuleElement(): void {
    const { RuleElement } = game.pf2e;
    const fields = foundry.data.fields;

    class EnvironmentalProtectionRuleElement extends RuleElement {
        declare counters: Set<EnvironmentKey>;
        declare level: ProtectionLevel;
        declare limitedDuration: number | null | undefined;
        active = false;

        static override autogenForms = true;

        static override LOCALIZATION_PREFIXES = [
            ...super.LOCALIZATION_PREFIXES,
            `${I18N}.RuleElement.EnvironmentalProtection`,
        ];

        static override defineSchema(): Record<string, unknown> {
            return {
                ...super.defineSchema(),
                counters: new fields.SetField(new fields.StringField({ required: true, blank: false, trim: true }), {
                    required: true,
                }),
                level: new fields.StringField({ required: true, choices: [...PROTECTION_LEVELS], initial: "full" }),
                limitedDuration: optionalHoursField(),
            };
        }

        override beforePrepareData(): void {
            const invalid = [...this.counters].filter((k) => !ENVIRONMENT_KEY_PATTERN.test(k));
            if (invalid.length > 0) {
                this.failValidation(`counters: ${invalid.map((k) => `"${k}"`).join(", ")} must be ${ENVIRONMENT_KEY_HINT}`);
            }
            if (this.level === "limited" && !this.limitedDuration) {
                this.failValidation("limitedDuration: required when level is limited");
            }
            this.active = !this.ignored && this.counters.size > 0 && this.test();
        }
    }

    game.pf2e.RuleElements.custom[PROTECTION_RULE_KEY] = EnvironmentalProtectionRuleElement;
}

function sourceOf(item: ItemSf2e): ProtectionSource {
    const physical = item as PhysicalItemSf2e;
    return item.type === "armor" || physical.parentItem?.type === "armor" ? "armor" : "innate";
}

export function getProtections(actor: ActorSf2e): Protection[] {
    return actor.rules
        .filter((r): r is ProtectionRuleElement => r.key === PROTECTION_RULE_KEY && (r as ProtectionRuleElement).active)
        .flatMap((r) =>
            [...r.counters].map((environment) => ({
                environment,
                level: r.level,
                hoursPerCharge: r.level === "limited" ? (r.limitedDuration ?? null) : null,
                source: sourceOf(r.item),
                label: r.label,
            })),
        );
}
