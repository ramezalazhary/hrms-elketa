import { store } from "@/app/store";
import { refreshTokenThunk } from "@/modules/identity/store";
import { logout } from "@/modules/identity/store";

/**
 * Reads the access token from the Redux `identity` slice.
 * @returns {string|null|undefined}
 */
export function getAuthToken() {
  return store.getState().identity.accessToken;
}

/**
 * Reads the refresh token from the Redux `identity` slice.
 * @returns {string|null|undefined}
 */
export function getRefreshToken() {
  return store.getState().identity.refreshToken;
}

/**
 * Builds headers for authenticated requests (`Authorization: Bearer …`) if a token exists.
 * @returns {Record<string, string>} Empty object or single-key Authorization header.
 */
export function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * `fetch` wrapper: injects Bearer token; on **401** attempts one refresh via `refreshTokenThunk` and retries.
 * Also catches network errors (no internet, server down) and throws a friendlier message.
 *
 * @param {RequestInfo} input URL or Request
 * @param {RequestInit} [init] Standard fetch options (headers merged).
 * @returns {Promise<Response>} Final HTTP response (caller still checks `ok`).
 *
 * Data flow: merge `Authorization` → `fetch` → if 401 and refresh token exists → dispatch thunk unwrap → retry with new header.
 */
export async function fetchWithAuth(input, init) {
  const token = getAuthToken();
  const hadAccessTokenAtRequestStart = Boolean(token);
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestInit = {
    ...init,
    headers,
  };

  let response;

  try {
    response = await fetch(input, requestInit);
  } catch (networkError) {
    // Network errors (no internet, DNS failure, CORS blocked, server unreachable)
    throw new Error(
      "Unable to connect to the server. Please check your internet connection and try again."
    );
  }

  const extract401Message = async (resp) => {
    if (resp.status !== 401) return "";
    try {
      const body = await resp.clone().json();
      return String(body?.error || body?.message || "").toLowerCase();
    } catch {
      return "";
    }
  };

  let serverMessage = await extract401Message(response);
  let isTokenSession401 =
    serverMessage.includes("session outdated") ||
    serverMessage.includes("token expired") ||
    serverMessage.includes("invalid token");

  // Refresh only for token/session invalidation, not every 401.
  if (response.status === 401 && isTokenSession401 && getRefreshToken()) {
    try {
      await store.dispatch(refreshTokenThunk()).unwrap();

      const newToken = getAuthToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        try {
          response = await fetch(input, {
            ...init,
            headers,
          });
          // Re-evaluate based on the retried response, not the initial 401.
          serverMessage = await extract401Message(response);
          isTokenSession401 =
            serverMessage.includes("session outdated") ||
            serverMessage.includes("token expired") ||
            serverMessage.includes("invalid token");
        } catch (retryNetworkError) {
          throw new Error(
            "Unable to connect to the server. Please check your internet connection and try again."
          );
        }
      }
    } catch (refreshError) {
      // Token refresh failed — user session is expired
      // The identity store handles clearing state on rejection
      console.error("Token refresh failed:", refreshError);
      store.dispatch(logout());
      throw new Error("Your session has expired. Please sign in again.");
    }
  }

  // If we still end up unauthorized, force logout only for clear token/session-invalid states.
  if (response.status === 401) {
    if (hadAccessTokenAtRequestStart && isTokenSession401) {
      store.dispatch(logout());
      throw new Error("Your session has expired. Please sign in again.");
    }
  }

  return response;
}
