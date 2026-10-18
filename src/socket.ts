import { MODULE_ID } from "./constants.ts";

// Needs "socket": true in module.json. Foundry adds the sender's user ID.
const CHANNEL = `module.${MODULE_ID}`;

type GMHandler<T = unknown> = (payload: T, sender: UserSf2e) => Promise<void>;
const handlers = new Map<string, GMHandler>();

interface Message {
    action: string;
    payload: unknown;
}

function run({ action, payload }: Message, sender: UserSf2e): void {
    handlers.get(action)?.(payload, sender).catch((error) => console.error(MODULE_ID, action, error));
}

/** The handler must check that `sender` is allowed to do this. */
export function onGMRequest<T>(action: string, handler: GMHandler<T>): void {
    handlers.set(action, handler as GMHandler);
}

export function registerSocket(): void {
    game.socket.on(CHANNEL, (message: Message, senderId: string) => {
        const sender = game.users.get(senderId);
        if (sender && game.users.activeGM?.isSelf) run(message, sender);
    });
}

/** False if no GM is connected. */
export function requestGM(action: string, payload: unknown): boolean {
    const gm = game.users.activeGM;
    if (!gm) return false;
    if (gm.isSelf) run({ action, payload }, gm);
    else game.socket.emit(CHANNEL, { action, payload }, { recipients: [gm.id] });
    return true;
}
