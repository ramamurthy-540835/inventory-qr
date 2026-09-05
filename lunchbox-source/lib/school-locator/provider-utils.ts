export class ProviderError extends Error {
  constructor(public readonly provider: string, message: string, public readonly status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

export async function fetchProviderJson(url: string, init: RequestInit, provider: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ProviderError(provider, `${provider} timed out.`);
    try {
      const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(remaining) });
      if (response.ok) return response.json() as Promise<unknown>;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 1) throw new ProviderError(provider, `${provider} returned ${response.status}.`, response.status);
      await new Promise((resolve) => setTimeout(resolve, Math.min(150, Math.max(0, deadline - Date.now()))));
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (attempt === 1 || Date.now() >= deadline) throw new ProviderError(provider, `${provider} is unavailable.`);
    }
  }
  throw new ProviderError(provider, `${provider} is unavailable.`);
}
