import { ErrorEnvelope } from "./ErrorEnvelope";

type QueryValue = string | number | boolean | null | undefined;

/** A failed gateway request, carrying the envelope's code when the server sent one. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Browser-side calls to gateway GET routes: builds the query string and turns an error envelope into a thrown `ApiRequestError`. */
export class ApiClient {
  static async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const qs = params.toString();

    const response = await fetch(qs ? `${path}?${qs}` : path, { headers: { Accept: "application/json" } });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code =
        typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "code" in body.error
          ? String(body.error.code)
          : undefined;
      throw new ApiRequestError(ErrorEnvelope.messageFrom(body, "Request failed."), response.status, code);
    }
    // A 200 that isn't JSON (an offline page from the service worker or a CDN) is not an answer.
    if (body === null) throw new ApiRequestError("Unexpected response.", response.status);
    return body as T;
  }
}
