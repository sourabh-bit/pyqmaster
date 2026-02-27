export interface UploadProgressSnapshot {
  loaded: number;
  total: number;
}

export interface UploadXhrOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (snapshot: UploadProgressSnapshot) => void;
}

export interface UploadXhrResult {
  status: number;
  responseText: string;
}

export const uploadFormDataWithProgress = (
  url: string,
  formData: FormData,
  options: UploadXhrOptions = {}
): Promise<UploadXhrResult> => {
  const timeoutMs = options.timeoutMs ?? 60_000;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastProgressTick = 0;

    const onAbortSignal = () => {
      try {
        xhr.abort();
      } catch {
        // ignore
      }
    };
    const cleanup = () => {
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbortSignal);
      }
    };

    xhr.open("POST", url, true);
    xhr.timeout = timeoutMs;

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress) return;
      const now = Date.now();
      if (now - lastProgressTick < 120 && event.loaded !== event.total) return;
      lastProgressTick = now;
      options.onProgress({
        loaded: event.loaded,
        total: event.total || 0,
      });
    };

    xhr.onload = () => {
      cleanup();
      resolve({
        status: xhr.status,
        responseText: xhr.responseText || "",
      });
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("XHR network error"));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("XHR timeout"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error("XHR aborted"));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new Error("Upload aborted"));
        return;
      }
      options.signal.addEventListener("abort", onAbortSignal, { once: true });
    }

    try {
      xhr.send(formData);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("XHR send failed"));
    }
  });
};
