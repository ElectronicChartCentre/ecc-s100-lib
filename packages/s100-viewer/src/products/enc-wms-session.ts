import type { S100Layer } from "../layers/types.js";
import type { S100Scene } from "../scene/types.js";
import { FeatureLifecycleScope } from "../features/index.js";
import { EncStandard, type EncLayerSpec } from "./enc.js";
import {
  createEncWmsPair,
  type CreateEncWmsPairOptions,
} from "./enc-builders.js";

export type EncWmsLayerPair = {
  transparentLayer: S100Layer<EncLayerSpec>;
  opaqueLayer?: S100Layer<EncLayerSpec>;
};

export type EncWmsSessionStandardOptions =
  Omit<CreateEncWmsPairOptions, "standard">;

export type EncWmsAvailability = Partial<Record<EncStandard, boolean>>;

export type EncWmsSessionOptions = {
  scene: S100Scene;
  standards: Partial<Record<EncStandard, EncWmsSessionStandardOptions>>;
  availability?: EncWmsAvailability;
  preference?: readonly EncStandard[];
  visible?: boolean;
  opacity?: number;
};

export type EncWmsOpacityEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";

export type EncWmsOpacityAnimationOptions = {
  durationMs?: number;
  frameIntervalMs?: number;
  from?: number | "current";
  easing?: EncWmsOpacityEasing;
  signal?: AbortSignal;
};

export type EncWmsSessionStatus = {
  activeStandard: EncStandard | null;
  availableStandards: readonly EncStandard[];
  configuredStandards: readonly EncStandard[];
};

export type EncAvailabilityService<TBounds = unknown> = {
  hasS101(bounds: TBounds, licenseeKey: string): Promise<boolean>;
  hasS57Access(licenseeKey: string): Promise<boolean>;
  hasS57(bounds: TBounds): Promise<boolean>;
};

export type EncAvailabilityCheck =
  | "s101"
  | "s57-access"
  | "s57-coverage";

export type ResolveEncWmsAvailabilityOptions<TBounds = unknown> = {
  bounds: TBounds | null | undefined;
  licenseeKey: string;
  service: EncAvailabilityService<TBounds>;
  onError?: (error: unknown, check: EncAvailabilityCheck) => void;
};

export async function resolveEncWmsAvailability<TBounds = unknown>(
  options: ResolveEncWmsAvailabilityOptions<TBounds>,
): Promise<EncWmsAvailability> {
  if (!options.bounds) {
    return {
      [EncStandard.S101]: false,
      [EncStandard.S57]: false,
    };
  }

  const [hasS101, hasS57Access, hasS57Coverage] = await Promise.all([
    resolveAvailabilityCheck(
      () => options.service.hasS101(options.bounds as TBounds, options.licenseeKey),
      "s101",
      options.onError,
    ),
    resolveAvailabilityCheck(
      () => options.service.hasS57Access(options.licenseeKey),
      "s57-access",
      options.onError,
    ),
    resolveAvailabilityCheck(
      () => options.service.hasS57(options.bounds as TBounds),
      "s57-coverage",
      options.onError,
    ),
  ]);

  return {
    [EncStandard.S101]: hasS101,
    [EncStandard.S57]: hasS57Access && hasS57Coverage,
  };
}

export class EncWmsSession {
  private readonly lifecycle = new FeatureLifecycleScope();
  private readonly pairs = new Map<EncStandard, EncWmsLayerPair>();
  private readonly configuredStandards: readonly EncStandard[];
  private availability: EncWmsAvailability;
  private preference: readonly EncStandard[];
  private visible: boolean;
  private opacity: number;
  private appliedOpacity: number;
  private opacityAnimationToken = 0;
  private activeStandard: EncStandard | null = null;

  private constructor(private readonly options: EncWmsSessionOptions) {
    this.configuredStandards = encStandards.filter((standard) =>
      options.standards[standard] !== undefined,
    );
    this.availability = options.availability ?? {};
    this.preference = options.preference ?? encStandards;
    this.visible = options.visible ?? false;
    this.opacity = clamp01(options.opacity ?? 1);
    this.appliedOpacity = this.opacity;
    this.lifecycle.onDispose(async () => {
      this.cancelOpacityAnimation();
      const pairs = [...this.pairs.values()];
      this.pairs.clear();
      this.activeStandard = null;
      await Promise.allSettled(pairs.flatMap(pairLayers).map((layer) => layer.remove()));
    });
  }

  static async create(options: EncWmsSessionOptions): Promise<EncWmsSession> {
    const session = new EncWmsSession(options);
    try {
      await session.refreshActiveStandard();
      return session;
    } catch (error) {
      await session.dispose();
      throw error;
    }
  }

  get status(): EncWmsSessionStatus {
    return {
      activeStandard: this.activeStandard,
      availableStandards: this.availableConfiguredStandards(),
      configuredStandards: this.configuredStandards,
    };
  }

  get activeLayerPair(): EncWmsLayerPair | null {
    return this.activeStandard ? this.pairs.get(this.activeStandard) ?? null : null;
  }

  async setAvailability(availability: EncWmsAvailability): Promise<void> {
    this.availability = {
      ...this.availability,
      ...availability,
    };
    await this.refreshActiveStandard();
  }

  async setPreference(preference: readonly EncStandard[]): Promise<void> {
    this.preference = preference;
    await this.refreshActiveStandard();
  }

  async setPreferredStandard(standard: EncStandard): Promise<void> {
    const fallback = this.preference.filter((candidate) => candidate !== standard);
    await this.setPreference([standard, ...fallback]);
  }

  async setVisible(visible: boolean): Promise<void> {
    this.visible = visible;
    await this.applyActivePairVisibility();
  }

  async setOpacity(opacity: number): Promise<void> {
    this.cancelOpacityAnimation();
    this.opacity = clamp01(opacity);
    await this.applyOpacityToActivePair(this.opacity);
  }

  async setOpacityAnimated(
    opacity: number,
    options: EncWmsOpacityAnimationOptions = {},
  ): Promise<void> {
    const targetOpacity = clamp01(opacity);
    this.opacity = targetOpacity;

    const pair = this.activeLayerPair;
    if (!pair) {
      this.appliedOpacity = targetOpacity;
      return;
    }

    const token = this.nextOpacityAnimationToken();
    const durationMs = Math.max(0, options.durationMs ?? 250);
    const frameIntervalMs = Math.max(1, options.frameIntervalMs ?? 16);
    const fromOpacity = resolveAnimationStartOpacity(
      options.from,
      this.appliedOpacity,
      targetOpacity,
    );

    if (durationMs === 0 || fromOpacity === targetOpacity) {
      if (this.isOpacityAnimationActive(token, options.signal)) {
        await this.applyOpacityToPair(pair, targetOpacity);
      }
      return;
    }

    await this.applyOpacityToPair(pair, fromOpacity);
    const startedAt = Date.now();

    while (this.isOpacityAnimationActive(token, options.signal)) {
      const elapsedMs = Date.now() - startedAt;
      const progress = Math.min(1, elapsedMs / durationMs);
      const easedProgress = ease(progress, options.easing ?? "linear");
      await this.applyOpacityToPair(
        pair,
        interpolate(fromOpacity, targetOpacity, easedProgress),
      );

      if (progress >= 1) {
        return;
      }

      const shouldContinue = await sleep(frameIntervalMs, options.signal);
      if (!shouldContinue) {
        return;
      }
    }
  }

  async dispose(): Promise<void> {
    await this.lifecycle.dispose();
  }

  private async refreshActiveStandard(): Promise<void> {
    this.cancelOpacityAnimation();
    const token = this.lifecycle.begin();
    const nextStandard = this.resolveActiveStandard();
    if (nextStandard === this.activeStandard) {
      await this.applyActivePairVisibility();
      this.lifecycle.assertActive(token);
      return;
    }

    const previousPair = this.activeLayerPair;
    await hidePair(previousPair);
    this.lifecycle.assertActive(token);
    this.activeStandard = null;

    if (!nextStandard) {
      return;
    }

    const nextPair = await this.ensurePair(nextStandard);
    this.lifecycle.assertActive(token);
    this.activeStandard = nextStandard;
    await this.applyPairVisibility(nextPair, this.visible);
    await this.applyOpacityToPair(nextPair, this.opacity);
  }

  private resolveActiveStandard(): EncStandard | null {
    const available = new Set(this.availableConfiguredStandards());
    return this.preference.find((standard) => available.has(standard)) ?? null;
  }

  private availableConfiguredStandards(): EncStandard[] {
    return this.configuredStandards.filter((standard) =>
      this.availability[standard] ?? true,
    );
  }

  private async ensurePair(standard: EncStandard): Promise<EncWmsLayerPair> {
    const existing = this.pairs.get(standard);
    if (existing) {
      return existing;
    }

    const options = this.options.standards[standard];
    if (!options) {
      throw new Error(`ENC WMS standard '${standard}' is not configured.`);
    }

    const pair = standard === EncStandard.S101
      ? createEncWmsPair({
          ...options,
          standard: EncStandard.S101,
        })
      : createEncWmsPair({
          ...options,
          standard: EncStandard.S57,
        });
    const specs = pair.opaque ? [pair.transparent, pair.opaque] : [pair.transparent];
    const [transparentLayer, opaqueLayer] = await this.options.scene.layers.addMany(specs);
    if (!transparentLayer) {
      throw new Error(`ENC WMS standard '${standard}' did not create a transparent layer.`);
    }
    const layerPair: EncWmsLayerPair = {
      transparentLayer,
      ...(opaqueLayer !== undefined ? { opaqueLayer } : {}),
    };
    this.pairs.set(standard, layerPair);
    return layerPair;
  }

  private async applyActivePairVisibility(): Promise<void> {
    await this.applyPairVisibility(this.activeLayerPair, this.visible);
  }

  private async applyOpacityToActivePair(opacity: number): Promise<void> {
    const pair = this.activeLayerPair;
    if (!pair) {
      this.appliedOpacity = opacity;
      return;
    }
    await this.applyOpacityToPair(pair, opacity);
  }

  private async applyOpacityToPair(
    pair: EncWmsLayerPair,
    opacity: number,
  ): Promise<void> {
    this.appliedOpacity = opacity;
    await Promise.all(
      pairLayers(pair).map((layer) => layer.controllers.map.setAlpha(opacity)),
    );
  }

  private async applyPairVisibility(
    pair: EncWmsLayerPair | null,
    visible: boolean,
  ): Promise<void> {
    if (!pair) {
      return;
    }
    await Promise.all(
      pairLayers(pair).map((layer) => layer.controllers.map.setVisibility(visible)),
    );
  }

  private cancelOpacityAnimation(): void {
    this.opacityAnimationToken += 1;
  }

  private nextOpacityAnimationToken(): number {
    this.opacityAnimationToken += 1;
    return this.opacityAnimationToken;
  }

  private isOpacityAnimationActive(
    token: number,
    signal: AbortSignal | undefined,
  ): boolean {
    return !this.lifecycle.isDisposed &&
      token === this.opacityAnimationToken &&
      signal?.aborted !== true;
  }
}

const encStandards = [EncStandard.S101, EncStandard.S57] as const;

const pairLayers = (pair: EncWmsLayerPair): S100Layer<EncLayerSpec>[] => [
  pair.transparentLayer,
  ...(pair.opaqueLayer ? [pair.opaqueLayer] : []),
];

const hidePair = async (pair: EncWmsLayerPair | null): Promise<void> => {
  if (!pair) {
    return;
  }
  await Promise.all(
    pairLayers(pair).map((layer) => layer.controllers.map.setVisibility(false)),
  );
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;

function resolveAnimationStartOpacity(
  from: number | "current" | undefined,
  appliedOpacity: number,
  targetOpacity: number,
): number {
  if (from === undefined || from === "current") {
    return appliedOpacity;
  }
  return Number.isFinite(from) ? clamp01(from) : targetOpacity;
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function ease(progress: number, easing: EncWmsOpacityEasing): number {
  switch (easing) {
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - (1 - progress) * (1 - progress);
    case "ease-in-out":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case "linear":
      return progress;
  }
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<boolean> {
  if (signal?.aborted) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout>;
    function cleanup(): void {
      signal?.removeEventListener("abort", abort);
    }
    function abort(): void {
      clearTimeout(timeout);
      cleanup();
      resolve(false);
    }

    timeout = setTimeout(() => {
      cleanup();
      resolve(true);
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function resolveAvailabilityCheck(
  check: () => Promise<boolean>,
  checkName: EncAvailabilityCheck,
  onError: ((error: unknown, check: EncAvailabilityCheck) => void) | undefined,
): Promise<boolean> {
  try {
    return await check();
  } catch (error) {
    onError?.(error, checkName);
    return false;
  }
}
