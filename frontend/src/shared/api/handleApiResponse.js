/**
 * Centralised API response handler for the frontend.
 *
 * Every module-level `api.js` used to define its own `handleResponse`.
 * This file replaces all of them with a single, richer implementation that:
 *
 *  1. Parses JSON safely (handles non-JSON error bodies).
 *  2. Creates a typed `ApiError` with `status`, `error`, and `details`.
 *  3. Provides a human-readable `message` property for easy display in toasts.
 *
 * Usage in module api files:
 *   import { handleApiResponse } from "@/shared/api/handleApiResponse";
 *   const data = await handleApiResponse(response);
 */

/**
 * Error class thrown when an API call gets a non-2xx response.
 * Components and thunks can catch this and read `.message`, `.status`, `.details`.
 */
export class ApiError extends Error {
  /**
   * @param {number}  status   HTTP status code
   * @param {string}  message  Human-readable error message
   * @param {any}     details  Structured details from the server (validation array, etc.)
   * @param {object}  body     The full parsed JSON body
   */
  constructor(status, message, details = null, body = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.body = body;
  }
}

/**
 * Parse a fetch `Response` into JSON. On non-2xx status, throw an `ApiError`.
 *
 * @param {Response} response
 * @returns {Promise<any>} Parsed JSON body.
 * @throws {ApiError} on HTTP errors (4xx, 5xx).
 */
export async function handleApiResponse(response) {
  // Try to parse body regardless of status — servers usually send JSON errors
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    // Extract the most useful message from common backend shapes
    const message =
      body?.error ||
      body?.message ||
      (Array.isArray(body?.details)
        ? body.details.map((d) => d.message || d.msg).join("; ")
        : null) ||
      `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message, body?.details ?? null, body);
  }

  return body;
}

/**
 * Extract a user-friendly string from any caught error.
 * Works with ApiError, Redux rejected payloads, plain objects, and strings.
 *
 * @param {unknown} err
 * @param {string}  [fallback]  Default message when nothing useful can be extracted.
 * @returns {string}
 */
export function getErrorMessage(err, fallback = "Something went wrong") {
  if (!err) return fallback;

  // ApiError or standard Error
  if (err instanceof Error) return err.message || fallback;

  // Redux `rejectWithValue` payload — often an object with `error` or `message`
  if (typeof err === "object") {
    return err.error || err.message || fallback;
  }

  if (typeof err === "string") return err;

  return fallback;
}
