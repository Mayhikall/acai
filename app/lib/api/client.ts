export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  token?: string;
  body?: BodyInit | Record<string, unknown>;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  let body = options.body;
  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    body: body as BodyInit | undefined,
    headers,
  });
  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    let message =
      payload?.error?.message || payload?.message || "Request failed";
    if (
      Array.isArray(payload?.error?.details) &&
      payload.error.details.length > 0
    ) {
      const issues = payload.error.details
        .map((d: { path?: string | (string | number)[]; message?: string }) => {
          const path = Array.isArray(d.path) ? d.path.join(".") : d.path;
          return path ? `${path}: ${d.message}` : d.message;
        })
        .filter(Boolean)
        .join(", ");
      if (issues) {
        message = `${message}: ${issues}`;
      }
    }
    throw new ApiError(
      response.status,
      payload?.error?.code || payload?.code || "REQUEST_FAILED",
      message
    );
  }
  return payload as T;
}
