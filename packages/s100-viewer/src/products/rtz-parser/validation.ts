import type { RouteDiagnostic } from "../route-plan.js";
import { routeDiagnostic } from "./diagnostics.js";

export class RtzParseError extends Error {
  readonly diagnostics: readonly RouteDiagnostic[];

  constructor(message: string, diagnostics: readonly RouteDiagnostic[]) {
    super(message);
    this.name = "RtzParseError";
    this.diagnostics = diagnostics;
  }
}

export const parseOptionalNumber = (
  value: string | undefined,
  path: string,
  diagnostics: RouteDiagnostic[],
  range?: {
    minInclusive?: number;
    maxInclusive?: number;
    maxExclusive?: number;
    code: string;
    label: string;
  },
): number | undefined => {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    diagnostics.push(routeDiagnostic(
      "rtz-number-invalid",
      "error",
      `Expected numeric RTZ value at ${path}.`,
      path,
      { value },
    ));
    return undefined;
  }
  if (range?.minInclusive !== undefined && parsed < range.minInclusive) {
    diagnostics.push(routeDiagnostic(
      range.code,
      "error",
      `${range.label} must be greater than or equal to ${range.minInclusive}.`,
      path,
      { value: parsed },
    ));
    return undefined;
  }
  if (range?.maxInclusive !== undefined && parsed > range.maxInclusive) {
    diagnostics.push(routeDiagnostic(
      range.code,
      "error",
      `${range.label} must be less than or equal to ${range.maxInclusive}.`,
      path,
      { value: parsed },
    ));
    return undefined;
  }
  if (range?.maxExclusive !== undefined && parsed >= range.maxExclusive) {
    diagnostics.push(routeDiagnostic(
      range.code,
      "error",
      `${range.label} must be less than ${range.maxExclusive}.`,
      path,
      { value: parsed },
    ));
    return undefined;
  }
  return parsed;
};

export const finiteNumberOrUndefined = (value: string | undefined): number | undefined => {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const combineNumberValues = (
  values: readonly (number | undefined)[],
  mode: "min" | "max",
): number | undefined => {
  const finiteValues = values.filter((value): value is number => value !== undefined);
  if (finiteValues.length === 0) {
    return undefined;
  }
  return mode === "min" ? Math.min(...finiteValues) : Math.max(...finiteValues);
};
