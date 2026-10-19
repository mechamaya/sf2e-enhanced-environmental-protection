// Only the parts of Foundry and sf2e this module uses.

interface ItemSf2e {
    id: string;
    name: string;
    type: string;
    slug: string | null;
    actor: ActorSf2e | null;
    isOwner: boolean;
    getFlag(scope: string, key: string): unknown;
    update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

interface PhysicalItemSf2e extends ItemSf2e {
    level: number;
    traits: Set<string>;
    subitems: Iterable<PhysicalItemSf2e>;
    parentItem: PhysicalItemSf2e | null;
}

interface ArmorSf2e extends PhysicalItemSf2e {
    type: "armor";
}

interface EffectSf2e extends ItemSf2e {
    type: "effect";
    img: string;
    isExpired: boolean;
    system: {
        description: { value: string };
        duration: { value: number; unit: string };
        start: { value: number };
        badge: { type?: string; value: number; min?: number | null; max?: number | null } | null;
        rules?: { key: string; environment?: string }[];
    };
    delete(options?: Record<string, unknown>): Promise<unknown>;
}

interface RuleElementInstance {
    key: string;
    label: string;
    ignored: boolean;
}

interface RuleElementBase extends RuleElementInstance {
    readonly actor: ActorSf2e;
    readonly item: ItemSf2e;
    test(rollOptions?: Iterable<string>): boolean;
    failValidation(...message: string[]): void;
    beforePrepareData?(): void;
}

interface RuleElementBaseConstructor {
    new (...args: any[]): RuleElementBase;
    defineSchema(): Record<string, unknown>;
    autogenForms: boolean;
    LOCALIZATION_PREFIXES: string[];
}

interface ActorSf2e {
    id: string;
    type: string;
    hasPlayerOwner: boolean;
    img: string;
    isOwner: boolean;
    items: { get(id: string): ItemSf2e | undefined };
    allowedItemTypes: string[];
    uuid: string;
    token: TokenDocumentSf2e | null;
    name: string;
    itemTypes: { armor: ArmorSf2e[]; effect: EffectSf2e[]; feat: ItemSf2e[]; heritage: ItemSf2e[] };
    traits: Set<string>;
    rules: RuleElementInstance[];
    rollOptions: { all: Record<string, boolean> };
    wornArmor: ArmorSf2e | null;
    testUserPermission(user: UserSf2e, permission: "OWNER"): boolean;
    createEmbeddedDocuments(type: "Item", data: object[], options?: Record<string, unknown>): Promise<unknown[]>;
    deleteEmbeddedDocuments(type: "Item", ids: string[], options?: Record<string, unknown>): Promise<unknown[]>;
}

interface UserSf2e {
    id: string;
    isGM: boolean;
    isSelf: boolean;
}

interface TokenDocumentSf2e {
    actorId: string | null;
    actorLink: boolean;
    actor: ActorSf2e | null;
    parent: SceneSf2e | null;
    regions: Set<RegionSf2e>;
}

interface RegionBehaviorSf2e {
    name: string;
    type: string;
    disabled: boolean;
    system: unknown;
    parent: RegionSf2e | null;
}

interface SceneSf2e {
    name: string;
    active: boolean;
    flags: Record<string, unknown>;
    tokens: { contents: TokenDocumentSf2e[] };
}

interface RegionSf2e {
    name: string;
    flags: Record<string, unknown>;
    behaviors: Iterable<RegionBehaviorSf2e>;
    tokens: Set<TokenDocumentSf2e>;
}

declare const game: {
    user: { id: string; isGM: boolean; character: ActorSf2e | null; targets: Set<{ actor: ActorSf2e | null }> };
    socket: {
        on(channel: string, fn: (message: any, senderId: string) => void): void;
        emit(channel: string, message: unknown, options?: { recipients?: string[] }): void;
    };
    packs: Map<string, { getDocuments(): Promise<ItemSf2e[]> }>;
    items: { fromCompendium(document: ItemSf2e): Record<string, unknown> };
    i18n: {
        format(key: string, data?: Record<string, unknown>): string;
        localize(key: string): string;
        has(key: string): boolean;
    };
    time: { worldTime: number };
    users: { activeGM: UserSf2e | null; get(id: string): UserSf2e | undefined; filter(fn: (u: UserSf2e) => boolean): UserSf2e[] };
    actors: { contents: ActorSf2e[]; get(id: string): ActorSf2e | undefined; party: { members: ActorSf2e[] } | null };
    scenes: { contents: SceneSf2e[] };
    settings: {
        register(namespace: string, key: string, config: Record<string, unknown>): void;
        get(namespace: string, key: string): unknown;
        set(namespace: string, key: string, value: unknown): Promise<unknown>;
    };
    modules: Map<string, { active: boolean; api?: unknown; macros?: Record<string, unknown> }>;
    system: { id: string };
    pf2e: {
        RuleElement: RuleElementBaseConstructor;
        RuleElements: { custom: Record<string, unknown> };
        system: { sluggify(text: string): string };
    };
};

declare function fromUuidSync(uuid: string): unknown;

declare const Hooks: {
    once(hook: string, fn: (...args: any[]) => void): number;
    on(hook: string, fn: (...args: any[]) => void): number;
};

/** Null before the canvas is ready or when it's disabled. */
declare const canvas: {
    tokens: {
        controlled: { actor: ActorSf2e | null }[];
        placeables: { actor: ActorSf2e | null; control(options?: { releaseOthers?: boolean }): boolean }[];
    } | null;
};

declare const ui: {
    notifications: { info(message: string): void; warn(message: string): void };
};

declare const ChatMessage: {
    create(data: { content: string; whisper?: string[]; speaker?: unknown }): Promise<unknown>;
    getSpeaker(options: { actor?: ActorSf2e }): unknown;
};

interface DataFieldSf2e {
    toFormGroup(groupConfig?: Record<string, unknown>, inputConfig?: Record<string, unknown>): HTMLElement;
}

declare const CONFIG: {
    RegionBehavior: {
        dataModels: Record<string, unknown>;
        typeIcons: Record<string, string>;
        typeLabels: Record<string, string>;
    };
};

declare const foundry: {
    applications: {
        api: {
            DialogV2: {
                wait(config: {
                    window?: { title?: string };
                    content?: string;
                    rejectClose?: boolean;
                    buttons: {
                        action: string;
                        label: string;
                        default?: boolean;
                        callback?: (event: Event, button: HTMLButtonElement, dialog: unknown) => unknown;
                    }[];
                }): Promise<unknown>;
            };
        };
    };
    data: {
        regionBehaviors: { RegionBehaviorType: { new (...args: any[]): object; defineSchema(): Record<string, unknown> } };
        fields: {
            StringField: new (options?: Record<string, unknown>) => DataFieldSf2e;
            NumberField: new (options?: Record<string, unknown>) => DataFieldSf2e;
            SetField: new (element: DataFieldSf2e, options?: Record<string, unknown>) => DataFieldSf2e;
        };
    };
};
