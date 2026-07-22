export class DisposableStack {
  private readonly disposables: Array<() => void | Promise<void>> = [];
  private disposed = false;

  use(dispose: () => void | Promise<void>): () => void | Promise<void> {
    if (this.disposed) {
      void dispose();
      return dispose;
    }
    this.disposables.push(dispose);
    return dispose;
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const pending = this.disposables.splice(0).reverse();
    await Promise.allSettled(pending.map((dispose) => dispose()));
  }
}

