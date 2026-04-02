import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";

/**
 * Breadcrumb navigation component
 * Provides hierarchical navigation with automatic route detection
 */
export function Breadcrumb({
  items,
  className,
  separator,
  homeLabel = "Home",
}) {
  const location = useLocation();
  const SeparatorComponent = separator || ChevronRight;

  // Auto-generate breadcrumb items from current route if not provided
  const breadcrumbItems = React.useMemo(() => {
    if (items) return items;

    const pathSegments = location.pathname.split("/").filter(Boolean);
    const generatedItems = [{ label: homeLabel, href: "/" }];

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = formatBreadcrumbLabel(segment);

      // Don't add the last segment as a link if it's the current page
      if (index === pathSegments.length - 1) {
        generatedItems.push({ label, href: currentPath, isCurrent: true });
      } else {
        generatedItems.push({ label, href: currentPath });
      }
    });

    return generatedItems;
  }, [items, location.pathname, homeLabel]);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center space-x-1 text-sm", className)}
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index) => (
          <li key={item.href || index} className="flex items-center">
            {index > 0 && (
              <SeparatorComponent className="w-4 h-4 text-zinc-400 mx-2 flex-shrink-0" />
            )}

            {item.isCurrent ? (
              <span className="text-zinc-900 font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className={cn(
                  "flex items-center hover:text-zinc-700 transition-colors",
                  index === 0 ? "text-zinc-500" : "text-zinc-600",
                )}
              >
                {index === 0 && <Home className="w-4 h-4 mr-1" />}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Format segment names into readable labels
 */
function formatBreadcrumbLabel(segment) {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Page header with breadcrumb and title
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  className,
}) {
  return (
    <div className={cn("mb-6 space-y-4", className)}>
      {breadcrumb && (
        <Breadcrumb items={breadcrumb} className="text-zinc-600" />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * Hook to generate breadcrumbs from route configuration
 */
export function useBreadcrumb(items) {
  return React.useMemo(() => {
    if (items) return items;

    // This can be extended to use route configuration
    // For now, use automatic generation
    return null;
  }, [items]);
}
