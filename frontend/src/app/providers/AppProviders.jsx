import { Provider } from "react-redux";
import { store } from "@/app/store";
import { ToastProvider } from "@/shared/components/ToastProvider";

/**
 * Wraps the app with Redux `Provider` and global toast UI.
 * @param {{ children: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
export function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <ToastProvider>{children}</ToastProvider>
    </Provider>
  );
}
