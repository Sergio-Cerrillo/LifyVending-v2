'use client';

const DEFAULT_TIMEOUT_MS = 30_000;

export class RequestTimeoutError extends Error {
  constructor(message = 'La petición ha tardado demasiado') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  message = 'La petición ha tardado demasiado',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new RequestTimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestTimeoutError('La petición ha tardado demasiado. Prueba a actualizar.');
    }
    throw error;
  } finally {
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromExternalSignal);
    clearTimeout(timeoutId);
  }
}
