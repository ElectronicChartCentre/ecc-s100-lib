export type BrowserImageLike = {
  crossOrigin?: string | null;
  height?: number;
  src: string;
  width?: number;
  complete?: boolean;
  naturalWidth?: number;
  onload?: unknown;
  onerror?: unknown;
  addEventListener?: (type: "load" | "error", listener: () => void, options?: { once?: boolean }) => void;
  removeEventListener?: (type: "load" | "error", listener: () => void) => void;
};

export type BrowserImageGlobalLike = {
  HTMLImageElement?: { prototype?: unknown };
  Image?: new (width?: number, height?: number) => BrowserImageLike;
};

export type BrowserDocumentLike = {
  createElement?: (tagName: string) => unknown;
  defaultView?: BrowserImageGlobalLike | null;
};

export type DeferredImageSource = {
  image: string | BrowserImageLike;
  readonly ready: boolean;
  onLoad(callback: () => void): void;
};

export function createDeferredImageSource(imageUrl: string): DeferredImageSource {
  const image = createBrowserImageElement();
  if (!image) {
    return {
      image: imageUrl,
      ready: true,
      onLoad(callback: () => void): void {
        callback();
      },
    };
  }

  const loadCallbacks: Array<() => void> = [];
  let ready = false;
  let failed = false;

  const markReady = () => {
    if (ready || failed) {
      return;
    }
    ready = true;
    const callbacks = loadCallbacks.splice(0);
    for (const callback of callbacks) {
      callback();
    }
  };
  const markFailed = () => {
    if (ready || failed) {
      return;
    }
    failed = true;
    loadCallbacks.length = 0;
  };

  if (typeof image.addEventListener === "function") {
    image.addEventListener("load", markReady, { once: true });
    image.addEventListener("error", markFailed, { once: true });
  } else {
    image.onload = markReady;
    image.onerror = markFailed;
  }

  image.crossOrigin = "anonymous";
  image.src = imageUrl;
  if (image.complete && (image.naturalWidth ?? 1) > 0) {
    markReady();
  }

  return {
    image,
    get ready() {
      return ready;
    },
    onLoad(callback: () => void): void {
      if (ready) {
        callback();
        return;
      }
      if (!failed) {
        loadCallbacks.push(callback);
      }
    },
  };
}

export function ensureConstructibleBrowserImageGlobal(
  documentLike?: BrowserDocumentLike,
): void {
  const globals = globalThis as BrowserImageGlobalLike & { document?: BrowserDocumentLike };
  const imageDocument = documentLike ?? globals.document;
  if (typeof imageDocument?.createElement !== "function") {
    return;
  }

  patchImageConstructor(globals, imageDocument);
  const windowTarget = imageDocument.defaultView;
  if (windowTarget && windowTarget !== globals) {
    patchImageConstructor(windowTarget, imageDocument);
  }
}

function createBrowserImageElement(): BrowserImageLike | null {
  const ImageConstructor = (globalThis as { Image?: new () => BrowserImageLike }).Image;
  if (typeof ImageConstructor === "function") {
    try {
      return new ImageConstructor();
    } catch {
      // Some embedded contexts expose HTMLImageElement as Image; that constructor is not directly constructible.
    }
  }

  const documentLike = (globalThis as {
    document?: { createElement?: (tagName: string) => unknown };
  }).document;
  const image = documentLike?.createElement?.("img");
  return image && typeof image === "object" ? (image as BrowserImageLike) : null;
}

function patchImageConstructor(
  target: BrowserImageGlobalLike,
  imageDocument: BrowserDocumentLike,
): void {
  const ImageConstructor = target.Image;
  if (typeof ImageConstructor !== "function" || isConstructibleImageConstructor(ImageConstructor)) {
    return;
  }
  const createElement = imageDocument.createElement;
  if (typeof createElement !== "function") {
    return;
  }
  const CompatibleImage = function Image(width?: number, height?: number) {
    const image = createElement.call(imageDocument, "img") as BrowserImageLike;
    if (typeof width === "number") {
      image.width = width;
    }
    if (typeof height === "number") {
      image.height = height;
    }
    return image;
  } as unknown as {
    new (width?: number, height?: number): BrowserImageLike;
    prototype?: unknown;
  };
  if (target.HTMLImageElement?.prototype) {
    CompatibleImage.prototype = target.HTMLImageElement.prototype;
  }

  try {
    Object.defineProperty(target, "Image", {
      configurable: true,
      writable: true,
      value: CompatibleImage,
    });
  } catch {
    try {
      target.Image = CompatibleImage;
    } catch {
      // Leave the host global untouched if it is non-writable.
    }
  }
}

function isConstructibleImageConstructor(
  ImageConstructor: new () => BrowserImageLike,
): boolean {
  try {
    return Boolean(new ImageConstructor());
  } catch {
    return false;
  }
}
