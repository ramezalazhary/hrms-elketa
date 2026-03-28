import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { appRoutes } from './routes'

/** Single browser router instance built from `appRoutes`. */
const router = createBrowserRouter(appRoutes)

/**
 * Renders `<RouterProvider />` for the SPA.
 * @returns {JSX.Element}
 */
export function AppRouter() {
  return <RouterProvider router={router} />
}
