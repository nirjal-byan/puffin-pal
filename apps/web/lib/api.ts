import type { Permission, Role } from "@puffinpal/permissions";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"
).replace(/\/$/, "");
export interface User {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}
export interface Profile {
  user: User;
  organization: { id: string; name: string; slug: string; currency: string };
  role: Role;
  permissions: Permission[];
}
export interface Session extends Profile {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}
export interface Client {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  taxId: string | null;
}
export interface Member {
  id: string;
  userId: string;
  role: Role;
  user: User | null;
}
export interface FinancialRecord {
  id: string;
  invoiceNumber?: string;
  version?: number;
  title?: string;
  clientName?: string;
  status?: string;
  active?: boolean;
  total?: string;
  amount?: string;
  monthlyAmount?: string;
  dueDate?: string;
  date?: string;
  billingDay?: number;
}
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
async function rawRequest<T>(
  path: string,
  options: {
    token?: string;
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      cache: "no-store",
      credentials: "include",
      signal: options.signal,
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      "Cannot reach the API. Check that the backend is running and try again.",
      0,
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(" · ")
      : typeof body?.message === "string"
        ? body.message
        : "Request failed. Please try again.";
    throw new ApiError(
      response.status === 429
        ? "Too many attempts. Please wait a minute before trying again."
        : message,
      response.status,
    );
  }
  return body as T;
}
let activeSession: Session | null = null;
let sessionGeneration = 0;
let refreshPromise: Promise<Session> | null = null;
const sessionListeners = new Set<() => void>();
export const getActiveSession = () => activeSession;
export const getServerSession = () => null;
export function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}
function publishSession(next: Session | null) {
  activeSession = next;
  sessionListeners.forEach((listener) => listener());
}
export function setActiveSession(next: Session | null) {
  sessionGeneration++;
  refreshPromise = null;
  publishSession(next);
}
export function refreshSession(): Promise<Session> {
  if (refreshPromise) return refreshPromise;
  const generation = sessionGeneration;
  const pending = rawRequest<Session>("/auth/refresh", { method: "POST" }).then(
    (session) => {
      if (generation !== sessionGeneration)
        throw new ApiError("Session changed. Try again.", 409);
      publishSession(session);
      return session;
    },
  );
  refreshPromise = pending;
  void pending
    .finally(() => {
      if (refreshPromise === pending) refreshPromise = null;
    })
    .catch(() => {});
  return pending;
}
export async function apiRequest<T>(
  path: string,
  options: {
    token?: string;
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const generation = sessionGeneration;
  const token = options.token
    ? (activeSession?.accessToken ?? options.token)
    : undefined;
  try {
    return await rawRequest<T>(path, { ...options, token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !options.token)
      throw error;
    if (generation !== sessionGeneration)
      throw new ApiError("Session changed. Try again.", 409);
    // Other requests may already have renewed this token. Share one refresh
    // request and retry once rather than logging out on normal token expiry.
    try {
      const session =
        activeSession?.accessToken !== token && activeSession
          ? activeSession
          : await refreshSession();
      if (generation !== sessionGeneration)
        throw new ApiError("Session changed. Try again.", 409);
      return await rawRequest<T>(path, {
        ...options,
        token: session.accessToken,
      });
    } catch (failure) {
      if (generation !== sessionGeneration)
        throw new ApiError("Session changed. Try again.", 409);
      throw failure;
    }
  }
}

export const roleLabel = (role: Role) =>
  role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

export interface WorkspaceApi {
  <T>(
    path: string,
    options?: { method?: string; body?: unknown; signal?: AbortSignal },
  ): Promise<T>;
}
