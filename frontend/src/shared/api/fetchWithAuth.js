import { store } from "@/app/store";
import { refreshTokenThunk } from "@/modules/identity/store";

let isRefreshing = false;
let refreshPromise = null;

export function getAuthToken() {
  return store.getState().identity.accessToken;
}

export function getRefreshToken() {
  return store.getState().identity.refreshToken;
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

// Check if token is expired (basic check - you might want more sophisticated JWT parsing)
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true; // If we can't parse, assume expired
  }
}

// Refresh token and retry the request
async function refreshTokenAndRetry(originalRequest) {
  if (isRefreshing) {
    // Wait for ongoing refresh
    await refreshPromise;
  } else {
    // Start refresh
    isRefreshing = true;
    refreshPromise = store.dispatch(refreshTokenThunk());

    try {
      await refreshPromise;
    } catch (error) {
      isRefreshing = false;
      refreshPromise = null;
      throw error;
    }

    isRefreshing = false;
    refreshPromise = null;
  }

  // Retry with new token
  const newToken = getAuthToken();
  if (newToken) {
    const newRequest = new Request(originalRequest.url, {
      ...originalRequest,
      headers: {
        ...Object.fromEntries(originalRequest.headers),
        Authorization: `Bearer ${newToken}`,
      },
    });
    return fetch(newRequest);
  }

  throw new Error("Failed to refresh token");
}

export async function fetchWithAuth(input, init) {
  // Add auth headers if we have a token
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

  // If unauthorized and we have a refresh token, try to refresh
  if (response.status === 401 && getRefreshToken()) {
    try {
      // Wait for refresh to complete
      await store.dispatch(refreshTokenThunk()).unwrap();

      // Retry with new token
      const newToken = getAuthToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        response = await fetch(input, {
          ...init,
          headers,
        });
      }
    } catch (refreshError) {
      // Refresh failed, the store should handle logout
      console.error("Token refresh failed:", refreshError);
      throw refreshError;
    }
  }

  return response;
}
