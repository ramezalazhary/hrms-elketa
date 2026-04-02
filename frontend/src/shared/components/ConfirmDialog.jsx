import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Trash2, X } from "lucide-react";

/**
 * Confirmation Dialog component for critical actions
 * Provides a modal overlay with confirmation options
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isDestructive = false,
  isLoading = false,
  children,
}) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const variants = {
    default: {
      icon: AlertTriangle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      confirmBg: "bg-indigo-600 hover:bg-indigo-700",
      confirmText: "text-white",
    },
    destructive: {
      icon: Trash2,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      confirmBg: "bg-red-600 hover:bg-red-700",
      confirmText: "text-white",
    },
    warning: {
      icon: AlertTriangle,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      confirmBg: "bg-orange-600 hover:bg-orange-700",
      confirmText: "text-white",
    },
  };

  const style = variants[variant] || variants.default;
  const IconComponent = style.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4",
            style.iconBg,
          )}
        >
          <IconComponent className={cn("w-6 h-6", style.iconColor)} />
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">{title}</h3>
          <p className="text-sm text-zinc-600">{description}</p>
          {children && <div className="mt-4">{children}</div>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
              style.confirmBg,
              style.confirmText,
              isDestructive && "focus:ring-red-500",
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing confirmation dialog state
 */
export function useConfirmDialog() {
  const [state, setState] = React.useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    variant: "default",
    isDestructive: false,
  });

  const confirm = (options) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title || "Confirm Action",
        description: options.description || "Are you sure you want to proceed?",
        onConfirm: () => {
          setState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        variant: options.variant || "default",
        isDestructive: options.isDestructive || false,
      });
    });
  };

  const close = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={close}
      onConfirm={state.onConfirm}
      title={state.title}
      description={state.description}
      variant={state.variant}
      isDestructive={state.isDestructive}
    />
  );

  return { confirm, close, ConfirmDialog: ConfirmDialogComponent };
}

/**
 * Pre-configured confirmation dialogs for common actions
 */
export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  isLoading,
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Item"
      description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      variant="destructive"
      isDestructive={true}
      isLoading={isLoading}
    />
  );
}

export function BulkDeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  count,
  itemType,
  isLoading,
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete ${count} ${itemType}s`}
      description={`Are you sure you want to delete ${count} selected ${itemType}(s)? This action cannot be undone.`}
      confirmText={`Delete ${count} ${itemType}s`}
      cancelText="Cancel"
      variant="destructive"
      isDestructive={true}
      isLoading={isLoading}
    />
  );
}

export function StatusChangeConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  newStatus,
  isLoading,
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Change Status"
      description={`Are you sure you want to change the status of "${itemName}" to "${newStatus}"?`}
      confirmText="Change Status"
      cancelText="Cancel"
      variant="warning"
      isLoading={isLoading}
    />
  );
}
