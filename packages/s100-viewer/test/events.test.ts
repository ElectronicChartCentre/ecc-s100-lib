import { describe, expect, it } from "vitest";
import { EventBus } from "../src/index.js";

type TestEvents = {
  changed: number;
};

describe("EventBus", () => {
  it("supports on, once, off, and listener counts", () => {
    const bus = new EventBus<TestEvents>();
    const values: number[] = [];
    const listener = (value: number) => values.push(value);

    const unsubscribe = bus.on("changed", listener);
    bus.once("changed", (value) => values.push(value * 10));

    expect(bus.listenerCount("changed")).toBe(2);

    bus.emit("changed", 1);
    bus.emit("changed", 2);

    unsubscribe();
    bus.emit("changed", 3);

    expect(values).toEqual([1, 10, 2]);
    expect(bus.listenerCount("changed")).toBe(0);
  });
});
