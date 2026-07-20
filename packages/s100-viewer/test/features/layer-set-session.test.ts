import { describe, expect, it, vi } from "vitest";
import { LayerSetSession, sameStringSet } from "../../src/features/layer-set-session.js";
import type { S100Layer } from "../../src/layers/types.js";

describe("LayerSetSession", () => {
  it("tracks layer handles by stable ids", () => {
    const first = createLayer("first");
    const second = createLayer("second");
    const session = new LayerSetSession();

    session.set([
      { id: "first", layer: first },
      { id: "second", layer: second },
    ]);

    expect(session.length).toBe(2);
    expect(session.ids()).toEqual(["first", "second"]);
    expect(session.hasSameIds(["second", "first"])).toBe(true);
  });

  it("updates layer visibility by id", async () => {
    const first = createLayer("first");
    const second = createLayer("second");
    const session = new LayerSetSession();

    session.set([
      { id: "first", layer: first },
      { id: "second", layer: second },
    ]);

    await session.setVisibilityById(["second"]);

    expect(first.update).toHaveBeenCalledWith({ visible: false });
    expect(second.update).toHaveBeenCalledWith({ visible: true });
  });

  it("removes all current layers and clears the session", async () => {
    const first = createLayer("first");
    const second = createLayer("second");
    const session = new LayerSetSession();

    session.set([
      { id: "first", layer: first },
      { id: "second", layer: second },
    ]);

    await session.removeAll();

    expect(first.remove).toHaveBeenCalledTimes(1);
    expect(second.remove).toHaveBeenCalledTimes(1);
    expect(session.length).toBe(0);
  });

  it("replaces current layers and removes previous layers", async () => {
    const oldLayer = createLayer("old");
    const newLayer = createLayer("new");
    const session = new LayerSetSession();

    session.set([{ id: "old", layer: oldLayer }]);
    await session.replace([{ id: "new", layer: newLayer }]);

    expect(oldLayer.remove).toHaveBeenCalledTimes(1);
    expect(newLayer.remove).not.toHaveBeenCalled();
    expect(session.ids()).toEqual(["new"]);
  });
});

describe("sameStringSet", () => {
  it("compares string sets independent of order", () => {
    expect(sameStringSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameStringSet(["a", "b"], ["a"])).toBe(false);
    expect(sameStringSet(["a", "b"], ["a", "c"])).toBe(false);
  });
});

function createLayer(id: string): S100Layer {
  return {
    id,
    product: "test",
    spec: { id, product: "test" },
    controllers: {},
    nativeHandle: null,
    visible: true,
    opacity: 1,
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getNativeHandle: vi.fn().mockReturnValue(null),
    onChanged: vi.fn().mockReturnValue(() => {}),
  } as unknown as S100Layer;
}
