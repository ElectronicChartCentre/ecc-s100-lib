import type { RouteDiagnostic } from "../route-plan.js";

export const routeDiagnostic = (
  code: string,
  severity: RouteDiagnostic["severity"],
  message: string,
  path?: string,
  values?: Record<string, unknown>,
): RouteDiagnostic => ({
  code,
  severity,
  message,
  ...(path !== undefined ? { path } : {}),
  ...(values !== undefined ? { values } : {}),
});
