import { MODULE_ID } from "../constants.ts";

export type ProtectionEvent = "depleted";

interface ModuleOptions {
    internal: true;
    event?: ProtectionEvent;
}

export function internalOptions(event?: ProtectionEvent): Record<string, ModuleOptions> {
    return { [MODULE_ID]: event ? { internal: true, event } : { internal: true } };
}

export function readOptions(options: Record<string, unknown> | undefined): ModuleOptions | null {
    return (options?.[MODULE_ID] as ModuleOptions | undefined) ?? null;
}
