export type FeatureSessionStatus =
  | { status: "idle"; message?: string }
  | { status: "loading"; message?: string }
  | { status: "success"; message?: string }
  | { status: "not-available"; message?: string }
  | { status: "error"; message: string; cause?: unknown };

export type FeatureDisposer = () => void | Promise<void>;

export type FeatureLifecycleRun = {
  readonly token: number;
  readonly signal: AbortSignal;
  isActive(): boolean;
  assertActive(message?: string): void;
  cancel(): void;
};

const DEFAULT_SUPERSEDED_MESSAGE = "Feature session operation was superseded.";

export class FeatureLifecycleScope {
  private activeToken = 0;
  private disposed = false;
  private activeAbortController: AbortController | undefined;
  private readonly disposers = new Set<FeatureDisposer>();

  get isDisposed(): boolean {
    return this.disposed;
  }

  begin(): number {
    this.assertNotDisposed();
    this.abortActiveRun();
    this.activeToken += 1;
    return this.activeToken;
  }

  beginAbortable(): FeatureLifecycleRun {
    this.assertNotDisposed();
    this.abortActiveRun();
    this.activeToken += 1;
    const token = this.activeToken;
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    return {
      token,
      signal: abortController.signal,
      isActive: () => this.isActive(token),
      assertActive: (message?: string) => {
        this.assertActive(token, message);
      },
      cancel: () => {
        if (this.isActive(token)) {
          this.cancelActive();
        }
      },
    };
  }

  cancelActive(): void {
    if (this.disposed) {
      return;
    }
    this.abortActiveRun();
    this.activeToken += 1;
  }

  isActive(token: number): boolean {
    return !this.disposed && token === this.activeToken;
  }

  assertActive(token: number, message = DEFAULT_SUPERSEDED_MESSAGE): void {
    if (!this.isActive(token)) {
      throw new Error(message);
    }
  }

  onDispose(disposer: FeatureDisposer): () => void {
    if (this.disposed) {
      void Promise.resolve().then(disposer);
      return () => {};
    }

    this.disposers.add(disposer);
    return () => {
      this.disposers.delete(disposer);
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.activeToken += 1;
    this.abortActiveRun();

    const disposers = [...this.disposers];
    this.disposers.clear();
    await Promise.all(disposers.map((disposer) => Promise.resolve().then(disposer)));
  }

  private abortActiveRun(): void {
    this.activeAbortController?.abort();
    this.activeAbortController = undefined;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Feature session has been disposed.");
    }
  }
}
