import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with `clsx`, then resolves Tailwind conflicts via `twMerge`.
 * @param {...import("clsx").ClassValue} inputs Any clsx-compatible tokens.
 * @returns {string} Safe `className` string for React.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
