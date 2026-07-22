export const appendUrlQuery = (
  url: string,
  query: Record<string, string | number | boolean> | URLSearchParams | undefined,
): string => {
  if (query === undefined) {
    return url;
  }

  const params = query instanceof URLSearchParams
    ? query
    : new URLSearchParams(
        Object.entries(query).map(
          ([key, value]): [string, string] => [key, String(value)],
        ),
      );
  if (params.size === 0) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
};

export const fillProjectedBboxTemplate = (
  template: string,
  extent: { minX: number; minY: number; maxX: number; maxY: number },
  size?: { width: number; height: number },
): string => {
  let output = template
    .replaceAll("{xmin}", String(extent.minX))
    .replaceAll("{ymin}", String(extent.minY))
    .replaceAll("{xmax}", String(extent.maxX))
    .replaceAll("{ymax}", String(extent.maxY))
    .replaceAll("%7Bxmin%7D", String(extent.minX))
    .replaceAll("%7Bymin%7D", String(extent.minY))
    .replaceAll("%7Bxmax%7D", String(extent.maxX))
    .replaceAll("%7Bymax%7D", String(extent.maxY));

  if (size !== undefined) {
    output = output
      .replace(/([?&]WIDTH=)[^&]*/iu, `$1${size.width}`)
      .replace(/([?&]HEIGHT=)[^&]*/iu, `$1${size.height}`);
  }

  return output;
};
