import { Provider } from "react-redux";
import { store } from "@/app/store";
import { ToastProvider } from "@/shared/components/ToastProvider";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

/**
 * Wraps the app with Redux `Provider`, global toast UI, and an Error Boundary.
 * @param {{ children: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
export function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <ToastProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </ToastProvider>
    </Provider>
  );
}
