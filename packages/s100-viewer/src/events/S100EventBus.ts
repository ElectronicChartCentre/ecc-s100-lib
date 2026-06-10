export type S100EventListener<TPayload> = (payload: TPayload) => void;
export type S100Unsubscribe = () => void;

export interface S100EventBus<TEvents extends object> {
  on<K extends keyof TEvents & string>(
    eventName: K,
    listener: S100EventListener<TEvents[K]>,
  ): S100Unsubscribe;
  once<K extends keyof TEvents & string>(
    eventName: K,
    listener: S100EventListener<TEvents[K]>,
  ): S100Unsubscribe;
  off<K extends keyof TEvents & string>(
    eventName: K,
    listener: S100EventListener<TEvents[K]>,
  ): void;
  emit<K extends keyof TEvents & string>(eventName: K, payload: TEvents[K]): void;
  listenerCount<K extends keyof TEvents & string>(eventName: K): number;
  clear(): void;
}

export class EventBus<TEvents extends object> implements S100EventBus<TEvents> {
  private readonly listeners = new Map<keyof TEvents & string, Set<S100EventListener<TEvents[keyof TEvents]>>>();

  on<K extends keyof TEvents & string>(
    eventName: K,
    listener: S100EventListener<TEvents[K]>,
  ): S100Unsubscribe {
    const listeners = this.getOrCreateListeners(eventName);
    listeners.add(listener as S100EventListener<TEvents[keyof TEvents]>);

    return () => this.off(eventName, listener);
  }

  once<K extends keyof TEvents & string>(
    eventName: K,
    listener: S100EventListener<TEvents[K]>,
  ): S100Unsubscribe {
    const onceListener: S100EventListener<TEvents[K]> = (payload) => {
      this.off(eventName, onceListener);
      listener(payload);
    };

    return this.on(eventName, onceListener);
  }

  off<K extends keyof TEvents & string>(
    eventName: K,
    listener: S100EventListener<TEvents[K]>,
  ): void {
    this.listeners.get(eventName)?.delete(listener as S100EventListener<TEvents[keyof TEvents]>);
  }

  emit<K extends keyof TEvents & string>(eventName: K, payload: TEvents[K]): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }

    for (const listener of [...listeners]) {
      (listener as S100EventListener<TEvents[K]>)(payload);
    }
  }

  listenerCount<K extends keyof TEvents & string>(eventName: K): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }

  private getOrCreateListeners<K extends keyof TEvents & string>(
    eventName: K,
  ): Set<S100EventListener<TEvents[keyof TEvents]>> {
    let listeners = this.listeners.get(eventName);
    if (!listeners) {
      listeners = new Set<S100EventListener<TEvents[keyof TEvents]>>();
      this.listeners.set(eventName, listeners);
    }
    return listeners;
  }
}
