import { describe, expect, it } from "vitest";
import { ControllerChangeReloadGate } from "./swControllerReload";

describe("ControllerChangeReloadGate", () => {
  it("never reloads on the first controllerchange when the tab had no controller yet (fresh install)", () => {
    const gate = new ControllerChangeReloadGate(false);
    expect(gate.onControllerChange()).toBe(false);
  });

  it("reloads on the first controllerchange when the tab was already controlled (genuine mid-session takeover)", () => {
    const gate = new ControllerChangeReloadGate(true);
    expect(gate.onControllerChange()).toBe(true);
  });

  it("reloads on a second controllerchange even when the first one was the fresh-install case", () => {
    const gate = new ControllerChangeReloadGate(false);
    expect(gate.onControllerChange()).toBe(false); // fresh install — ignored
    expect(gate.onControllerChange()).toBe(true); // a second deploy before any reload — genuine takeover
  });

  it("never reloads more than once no matter how many controllerchange events follow (no reload loop)", () => {
    const gate = new ControllerChangeReloadGate(true);
    expect(gate.onControllerChange()).toBe(true);
    expect(gate.onControllerChange()).toBe(false);
    expect(gate.onControllerChange()).toBe(false);
  });
});
