export type Subscription = {
  unsubscribe(): void;
};

export class EventEmitter<TPayload = void> {
  private readonly listeners = new Set<(payload: TPayload) => void>();

  subscribe(listener: (payload: TPayload) => void): Subscription {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  emit(payload: TPayload): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  get size(): number {
    return this.listeners.size;
  }
}
