import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

/**
 * Form field wrapper with label, error, and helper text
 */
export function FormField({
  label,
  error,
  helper,
  required,
  children,
  className,
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-zinc-700 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {children}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helper && !error && (
        <div className="text-sm text-zinc-500">{helper}</div>
      )}
    </div>
  );
}

/**
 * Input field with validation states
 */
export function Input({ className, error, ...props }) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-red-300 focus-visible:ring-red-500",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Textarea field with validation states
 */
export function Textarea({ className, error, ...props }) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-red-300 focus-visible:ring-red-500",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Select field with validation states
 */
export function Select({ children, className, error, ...props }) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-red-300 focus-visible:ring-red-500",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * Checkbox field with label
 */
export function Checkbox({ label, error, className, ...props }) {
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500",
          error && "border-red-300 focus:ring-red-500",
        )}
        {...props}
      />
      {label && (
        <label className="text-sm font-medium text-zinc-700">{label}</label>
      )}
    </div>
  );
}

/**
 * Radio button group
 */
export function RadioGroup({ options, value, onChange, error, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <input
            type="radio"
            id={option.value}
            name={option.name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            className={cn(
              "h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500",
              error && "border-red-300 focus:ring-red-500",
            )}
          />
          <label
            htmlFor={option.value}
            className="text-sm font-medium text-zinc-700"
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
}

/**
 * Alert component for form messages
 */
export function Alert({
  variant = "info",
  title,
  children,
  dismissible,
  onDismiss,
  className,
}) {
  const variants = {
    info: {
      container: "bg-blue-50 border-blue-200 text-blue-800",
      icon: Info,
      iconColor: "text-blue-600",
    },
    success: {
      container: "bg-green-50 border-green-200 text-green-800",
      icon: CheckCircle,
      iconColor: "text-green-600",
    },
    error: {
      container: "bg-red-50 border-red-200 text-red-800",
      icon: AlertCircle,
      iconColor: "text-red-600",
    },
    warning: {
      container: "bg-yellow-50 border-yellow-200 text-yellow-800",
      icon: AlertCircle,
      iconColor: "text-yellow-600",
    },
  };

  const style = variants[variant] || variants.info;
  const IconComponent = style.icon;

  return (
    <div className={cn("rounded-lg border p-4", style.container, className)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <IconComponent className={cn("h-5 w-5", style.iconColor)} />
        </div>
        <div className="ml-3 flex-1">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          <div className={cn("text-sm", title && "mt-1")}>{children}</div>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={cn(
                "inline-flex rounded-md p-1.5 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-2",
                variant === "info" && "focus:ring-blue-500",
                variant === "success" && "focus:ring-green-500",
                variant === "error" && "focus:ring-red-500",
                variant === "warning" && "focus:ring-yellow-500",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Form validation error summary
 */
export function ValidationSummary({ errors, className }) {
  if (!errors || errors.length === 0) return null;

  return (
    <Alert
      variant="error"
      title="Please fix the following errors:"
      className={className}
    >
      <ul className="list-disc list-inside space-y-1">
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </Alert>
  );
}

/**
 * Loading state for forms
 */
export function FormLoading({ message = "Saving..." }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-3 text-zinc-600">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
