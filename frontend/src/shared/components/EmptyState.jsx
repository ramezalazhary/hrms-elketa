import { cn } from "@/lib/utils";
import { 
  Users, 
  FileText, 
  Search, 
  Inbox, 
  Calendar, 
  Briefcase,
  Plus,
  ArrowRight
} from "lucide-react";

/**
 * Empty State component for displaying when no data is available
 * Provides context-specific messaging and actionable CTAs
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className
}) {
  const IconComponent = icon;

  const variants = {
    default: {
      container: "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center",
      icon: "w-12 h-12 text-zinc-400 mx-auto mb-4",
      title: "text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2",
      description: "text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto"
    },
    minimal: {
      container: "text-center py-12",
      icon: "w-8 h-8 text-zinc-300 mx-auto mb-3",
      title: "text-base font-medium text-zinc-700 dark:text-zinc-300 mb-1",
      description: "text-sm text-zinc-400"
    },
    card: {
      container: "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800/50 rounded-lg p-6 text-center",
      icon: "w-10 h-10 text-zinc-300 mx-auto mb-3",
      title: "text-base font-medium text-zinc-800 dark:text-zinc-200 mb-2",
      description: "text-sm text-zinc-500 dark:text-zinc-400 mb-4"
    }
  };

  const styles = variants[variant] || variants.default;

  return (
    <div className={cn(styles.container, className)}>
      {IconComponent && <IconComponent className={styles.icon} />}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {action}
    </div>
  );
}

/**
 * Pre-configured empty states for common use cases
 */

export function NoEmployees({ onAdd }) {
  return (
    <EmptyState
      icon={Users}
      title="No employees found"
      description="Get started by adding your first employee to the system."
      action={
        onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )
      }
    />
  );
}

export function NoDepartments({ onAdd }) {
  return (
    <EmptyState
      icon={Briefcase}
      title="No departments found"
      description="Create your first department to start organizing your workforce."
      action={
        onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Department
          </button>
        )
      }
    />
  );
}

export function NoTeams({ onAdd }) {
  return (
    <EmptyState
      icon={Users}
      title="No teams found"
      description="Create teams to better organize employees within departments."
      action={
        onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        )
      }
    />
  );
}

export function NoAttendance({ onImport }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No attendance records"
      description="Import attendance data or start tracking employee check-ins."
      action={
        onImport && (
          <button
            onClick={onImport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Import Attendance
          </button>
        )
      }
    />
  );
}

export function NoSearchResults({ searchQuery, onClear }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`No results match "${searchQuery}". Try adjusting your search terms.`}
      variant="minimal"
      action={
        onClear && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Clear search
            <ArrowRight className="w-3 h-3" />
          </button>
        )
      }
    />
  );
}

export function NoData({ message = "No data available" }) {
  return (
    <EmptyState
      icon={Inbox}
      title="No data"
      description={message}
      variant="minimal"
    />
  );
}

export function NoFiles() {
  return (
    <EmptyState
      icon={FileText}
      title="No files uploaded"
      description="Upload files to get started."
    />
  );
}
