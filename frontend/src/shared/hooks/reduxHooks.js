import { useDispatch, useSelector } from "react-redux";

/**
 * Typed convenience around `useDispatch` for this app’s `store`.
 * @returns {import("@reduxjs/toolkit").ThunkDispatch<any, any, any>}
 */
export const useAppDispatch = () => useDispatch();

/**
 * Re-export `useSelector` for consistent imports (`useAppSelector`).
 * @type {typeof useSelector}
 */
export const useAppSelector = useSelector;
