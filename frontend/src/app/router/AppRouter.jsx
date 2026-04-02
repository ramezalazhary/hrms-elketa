import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { appRoutes } from "./routes";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

/** Single browser router instance built from `appRoutes`. */
const router = createBrowserRouter(appRoutes);

/**
 * Renders `<RouterProvider />` for the SPA with error boundary.
 * @returns {JSX.Element}
 */
export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
