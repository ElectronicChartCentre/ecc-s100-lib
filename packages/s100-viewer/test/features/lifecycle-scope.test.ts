import { describe, expect, it, vi } from "vitest";
import { FeatureLifecycleScope } from "../../src/features/lifecycle-scope.js";

describe("FeatureLifecycleScope", () => {
  it("marks older operation tokens inactive when a new operation begins", () => {
    const scope = new FeatureLifecycleScope();

    const firstToken = scope.begin();
    const secondToken = scope.begin();

    expect(scope.isActive(firstToken)).toBe(false);
    expect(scope.isActive(secondToken)).toBe(true);
  });

  it("aborts older abortable runs when a new run begins", () => {
    const scope = new FeatureLifecycleScope();

    const firstRun = scope.beginAbortable();
    const secondRun = scope.beginAbortable();

    expect(firstRun.signal.aborted).toBe(true);
    expect(firstRun.isActive()).toBe(false);
    expect(secondRun.signal.aborted).toBe(false);
    expect(secondRun.isActive()).toBe(true);
  });

  it("runs registered disposers and deactivates active runs on dispose", async () => {
    const scope = new FeatureLifecycleScope();
    const disposer = vi.fn();
    const run = scope.beginAbortable();

    scope.onDispose(disposer);
    await scope.dispose();

    expect(disposer).toHaveBeenCalledTimes(1);
    expect(run.signal.aborted).toBe(true);
    expect(run.isActive()).toBe(false);
    expect(scope.isDisposed).toBe(true);
  });

  it("rejects new operations after disposal", async () => {
    const scope = new FeatureLifecycleScope();
    await scope.dispose();

    expect(() => scope.begin()).toThrow("Feature session has been disposed.");
    expect(() => scope.beginAbortable()).toThrow("Feature session has been disposed.");
  });
});
