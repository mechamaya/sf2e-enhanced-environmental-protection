import { beforeEach, describe, expect, it } from "vitest";
import { environmentName, environmentNames } from "../src/environments/names.ts";
import { installGame } from "./support/fakes.ts";

describe("names", () => {
    beforeEach(() => installGame());

    it("built-in keys", () => {
        expect(environmentName("vacuum")).toBe("Vacuum");
        expect(environmentName("cold:extreme")).toBe("Extreme Cold");
        expect(environmentName("thin:severe")).toBe("Severely Thin Atmosphere");
    });

    it("custom keys", () => {
        expect(environmentName("spore-cloud")).toBe("Spore Cloud");
        expect(environmentName("spore-cloud:dense")).toBe("Spore Cloud (Dense)");
        expect(environmentName("acid-rain:light:night")).toBe("Acid Rain (Light, Night)");
    });

    it("no repeats", () => {
        expect(environmentNames(["vacuum", "toxic", "vacuum"])).toBe("Vacuum, Toxic Atmosphere");
    });
});
