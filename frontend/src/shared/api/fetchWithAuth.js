import { store } from "@/app/store";
import { refreshTokenThunk } from "@/modules/identity/store";

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
 * @param {RequestInfo} input URL or Request
 * @param {RequestInit} [init] Standard fetch options (headers merged).
 * @returns {Promise<Response>} Final HTTP response (caller still checks `ok`).
 *
 * Data flow: merge `Authorization` → `fetch` → if 401 and refresh token exists → dispatch thunk unwrap → retry with new header.
 */
export async function fetchWithAuth(input, init) {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestInit = {
    ...init,
    headers,
  };

  let response = await fetch(input, requestInit);

  if (response.status === 401 && getRefreshToken()) {
    try {
      await store.dispatch(refreshTokenThunk()).unwrap();

      const newToken = getAuthToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        response = await fetch(input, {
          ...init,
          headers,
        });
      }
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      throw refreshError;
    }
  }

  return response;
}
