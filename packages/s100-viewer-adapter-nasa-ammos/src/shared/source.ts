import {
  S100Error,
  type BaseLayerSpec,
  type RestJsonSource,
  type ServiceReadySource,
  type StaticJsonSource,
} from "@ecc/s100-viewer";
import type { FetchLike } from "../options.js";

export function assertSourceKind<TKind extends ServiceReadySource["kind"]>(
  spec: BaseLayerSpec,
  kind: TKind,
): asserts spec is BaseLayerSpec & { source: Extract<ServiceReadySource, { kind: TKind }> } {
  if (!spec.source || typeof spec.source !== "object" || !("kind" in spec.source)) {
    throw new S100Error("invalid-layer-spec", `Layer '${spec.id}' must define a '${kind}' source.`);
  }

  if ((spec.source as ServiceReadySource).kind !== kind) {
    throw new S100Error(
      "invalid-layer-spec",
      `Layer '${spec.id}' must use a '${kind}' source for NASA-AMMOS.`,
      spec,
    );
  }
}

export const loadJsonSource = async (
  source: RestJsonSource | StaticJsonSource,
  fetchHandler: FetchLike | undefined,
): Promise<unknown> => {
  if (source.kind === "static-json") {
    return source.data;
  }

  const fetchImpl = fetchHandler ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new S100Error("invalid-layer-spec", "A fetch implementation is required for REST JSON sources.");
  }

  const init: RequestInit = {
    method: source.method ?? "GET",
  };
  if (source.headers !== undefined) {
    init.headers = source.headers;
  }
  if (source.body !== undefined) {
    init.body = JSON.stringify(source.body);
  }
  if (source.credentials !== undefined) {
    init.credentials = source.credentials;
  }

  const response = await fetchImpl(source.url, init);

  if (!response.ok) {
    throw new S100Error(
      "invalid-layer-spec",
      `Failed to load REST JSON source '${source.url}': ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};
