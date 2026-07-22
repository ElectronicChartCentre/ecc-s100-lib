export type AbortableTaskHandle = {
  readonly signal: AbortSignal;
  isActive(): boolean;
  abort(): void;
  assertActive(): void;
};

export class AbortableTaskScope {
  private active: AbortController | null = null;

  begin(): AbortableTaskHandle {
    this.abort();
    const controller = new AbortController();
    this.active = controller;
    return {
      signal: controller.signal,
      isActive: () => this.active === controller && !controller.signal.aborted,
      abort: () => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
        if (this.active === controller) {
          this.active = null;
        }
      },
      assertActive: () => {
        if (this.active !== controller || controller.signal.aborted) {
          throw new DOMException("Task was aborted.", "AbortError");
        }
      },
    };
  }

  abort(): void {
    const controller = this.active;
    this.active = null;
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
  }
}

