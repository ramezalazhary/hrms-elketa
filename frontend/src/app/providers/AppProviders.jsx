import { Provider } from "react-redux";
import { store } from "@/app/store";
import { ToastProvider } from "@/shared/components/ToastProvider";

export function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <ToastProvider>{children}</ToastProvider>
    </Provider>
  );
}
