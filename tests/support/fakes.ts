// Just enough of Foundry and sf2e to run the module in Node.
import lang from "../../lang/en.json";

type AnyRecord = Record<string, any>;

const registry = new Map<string, unknown>();

const lookup = (path: string): unknown => path.split(".").reduce<any>((o, k) => o?.[k], lang);

/** Call in beforeEach. */
export function installGame(
    options: { settings?: AnyRecord; worldTime?: number; scenes?: unknown[]; packs?: Record<string, AnyRecord[]> } = {},
): AnyRecord {
    registry.clear();
    const settings = options.settings ?? {};
    const game: AnyRecord = {
        system: { id: "sf2e" },
        settings: { get: (_scope: string, key: string) => settings[key] ?? false },
        i18n: {
            has: (path: string) => typeof lookup(path) === "string",
            localize: (path: string) => (lookup(path) as string | undefined) ?? path,
            format: (path: string, data: AnyRecord = {}) =>
                ((lookup(path) as string | undefined) ?? path).replace(/\{(\w+)\}/g, (_, k) => String(data[k] ?? "")),
        },
        time: { worldTime: options.worldTime ?? 0 },
        scenes: { contents: options.scenes ?? [] },
        user: { id: "gm", isGM: true, character: null, targets: new Set() },
        users: (() => {
            const all = [{ id: "gm", isGM: true, isSelf: true }, { id: "player", isGM: false, isSelf: false }];
            return { activeGM: all[0], get: (id: string) => all.find((u) => u.id === id), filter: (fn: any) => all.filter(fn) };
        })(),
        packs: new Map(
            Object.entries(options.packs ?? {}).map(([id, docs]) => [id, { getDocuments: async () => docs }]),
        ),
        items: {
            // Like Foundry: drop the compendium ID and record the source.
            fromCompendium: (doc: AnyRecord) => {
                const { _id, ...data } = structuredClone(doc.source);
                return { ...data, _stats: { compendiumSource: `Compendium.test.Item.${_id}` } };
            },
        },
        pf2e: {
            system: {
                sluggify: (s: string) =>
                    s
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
            },
        },
    };
    (globalThis as AnyRecord).game = game;
    const notices: { level: string; message: string }[] = [];
    (globalThis as AnyRecord).ui = {
        notifications: {
            info: (message: string) => notices.push({ level: "info", message }),
            warn: (message: string) => notices.push({ level: "warn", message }),
        },
    };
    game.notices = notices;
    const messages: AnyRecord[] = [];
    (globalThis as AnyRecord).ChatMessage = {
        create: async (data: AnyRecord) => messages.push(data),
        getSpeaker: () => ({}),
    };
    game.messages = messages;
    (globalThis as AnyRecord).fromUuidSync = (uuid: string) => registry.get(uuid) ?? null;
    return game;
}

export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Sets options.parent like Foundry does, so reusing an options object breaks here too.
async function dbOp(options: AnyRecord, parent: FakeActor, change: (target: FakeActor) => void): Promise<void> {
    options.parent = parent;
    await tick();
    change(options.parent as FakeActor);
}

let nextId = 0;
const newId = () => `fake${String(++nextId).padStart(12, "0")}`;

export function fakeItem(data: AnyRecord = {}): AnyRecord {
    const item: AnyRecord = {
        id: data.id ?? newId(),
        name: data.name ?? "Item",
        type: data.type ?? "equipment",
        slug: data.slug ?? null,
        flags: data.flags ?? {},
        parentItem: data.parentItem ?? null,
        getFlag(scope: string, key: string) {
            return this.flags[scope]?.[key];
        },
    };
    return item;
}

export function fakeArmor(data: { name?: string; level?: number; traits?: string[]; upgrades?: string[] } = {}): AnyRecord {
    const armor = fakeItem({ name: data.name ?? "Suit", type: "armor" });
    armor.level = data.level ?? 1;
    armor.isOwner = true;
    armor.traits = new Set(data.traits ?? ["tech"]);
    armor.subitems = (data.upgrades ?? []).map((name) => fakeItem({ name, parentItem: armor }));
    armor.update = async (changes: AnyRecord) => {
        for (const [path, value] of Object.entries(changes)) {
            const [, scope, key] = path.split(".");
            armor.flags[scope!] ??= {};
            armor.flags[scope!][key!] = value;
        }
    };
    return armor;
}

export const hazardRule = (environment: string, limitedDuration: number | null = null) => ({
    key: "EnvironmentalHazard",
    active: true,
    environment,
    limitedDuration,
});

export const protectionRule = (counters: string[], level = "full", item: AnyRecord = { type: "armor" }) => ({
    key: "EnvironmentalProtection",
    active: true,
    counters: new Set(counters),
    level,
    limitedDuration: null,
    label: "Rule",
    item,
});

// Loosely typed: fakes only model part of ActorSf2e.
export type FakeActor = any;

export function fakeActor(
    data: {
        name?: string;
        armor?: AnyRecord;
        rules?: AnyRecord[];
        type?: string;
        owners?: string[];
        traits?: string[];
        /** [type, name], with no slug, like compendium copies. */
        features?: [string, string][];
    } = {},
): FakeActor {
    const items = new Map<string, AnyRecord>();
    const actor: FakeActor = {
        id: newId(),
        name: data.name ?? "Actor",
        type: data.type ?? "character",
        token: null,
        rules: data.rules ?? [],
        rollOptions: { all: {} },
        allowedItemTypes: data.type === "party" || data.type === "loot" ? ["physical"] : ["condition", "effect", "physical"],
        wornArmor: data.armor ?? null,
        traits: new Set(data.traits ?? []),
        testUserPermission: (user: AnyRecord) => user.isGM || (data.owners ?? []).includes(user.id),
        operations: [] as AnyRecord[],
        items: {
            get: (id: string) => items.get(id),
            values: () => items.values(),
        },
        get itemTypes() {
            const all = [...items.values()];
            return {
                armor: [actor.wornArmor, ...all.filter((i) => i.type === "armor")].filter(Boolean),
                effect: all.filter((i) => i.type === "effect"),
                feat: all.filter((i) => i.type === "feat"),
                heritage: all.filter((i) => i.type === "heritage"),
            };
        },
        async createEmbeddedDocuments(_type: string, sources: AnyRecord[], options: AnyRecord = {}) {
            actor.operations.push(options);
            await dbOp(options, actor, (target) => {
                for (const source of sources) {
                    if (options.keepId && target._items.has(source._id)) {
                        throw new Error(`The _id [${source._id}] already exists within the parent collection`);
                    }
                    const id = source._id ?? newId();
                    target._items.set(id, target._makeEffect({ ...source, _id: id }));
                }
            });
        },
        async deleteEmbeddedDocuments(_type: string, ids: string[], options: AnyRecord = {}) {
            actor.operations.push(options);
            await dbOp(options, actor, (target) => {
                for (const id of ids) {
                    if (!target._items.delete(id)) throw new Error(`Item "${id}" does not exist!`);
                }
            });
        },
        _items: items,
        _makeEffect(source: AnyRecord) {
            const effect = fakeItem({ ...source, id: source._id, type: "effect" });
            Object.assign(effect, { img: source.img, system: structuredClone(source.system) });
            effect.slug = source.system?.slug ?? null;
            effect.update = async (changes: AnyRecord, options: AnyRecord = {}) => {
                actor.operations.push(options);
                await dbOp(options, actor, (target) => {
                    const doc = target._items.get(effect.id);
                    if (!doc) throw new Error(`Item "${effect.id}" does not exist!`);
                    Object.assign(doc, { name: changes.name ?? doc.name, img: changes.img ?? doc.img });
                    if (changes.system) doc.system = { ...doc.system, ...structuredClone(changes.system) };
                    doc.slug = doc.system?.slug ?? doc.slug;
                });
            };
            effect.delete = async (options: AnyRecord = {}) => {
                actor.operations.push(options);
                await dbOp(options, actor, (target) => {
                    if (!target._items.delete(effect.id)) throw new Error(`Item "${effect.id}" does not exist!`);
                });
            };
            return effect;
        },
    };
    for (const [type, name] of data.features ?? []) {
        const item = fakeItem({ type, name });
        items.set(item.id, item);
    }
    actor.uuid = `Actor.${actor.id}`;
    registry.set(actor.uuid, actor);
    return actor;
}

export function effectsWithRole(actor: FakeActor, role: string): AnyRecord[] {
    return actor.itemTypes.effect.filter((e: AnyRecord) => e.getFlag("sf2e-enhanced-environmental-protection", "role") === role);
}

export function compendiumEffect(_id: string, name: string, rules: AnyRecord[]): AnyRecord {
    const source = { _id, name, type: "effect", img: "icon.webp", system: { rules } };
    return { id: _id, name, type: "effect", system: { rules }, source };
}
