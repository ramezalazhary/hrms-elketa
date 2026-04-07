import { useState } from "react";
import { SearchableSelect } from "./SearchableSelect";

export function FormBuilder({
  fields,
  submitLabel = "Submit",
  initialValues,
  onSubmit,
  error,
  disabled,
  onCancel,
  /** Called whenever any field value changes: (fieldName, newValue, setValues) => void */
  onChange,
  /** Dev only: `{ getValues, label?, afterFill? }` — button merges returned fields; `afterFill(patch)` runs after apply. */
  devDemoFill,
}) {
  const computedInitialValues = fields.reduce((acc, field) => {
    if (field.name) acc[field.name] = "";
    return acc;
  }, {});
  const [values, setValues] = useState({
    ...computedInitialValues,
    ...initialValues,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputClass =
    "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400";

  return (
    <form
      className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        setIsSubmitting(true);
        Promise.resolve(onSubmit(values)).finally(() => setIsSubmitting(false));
      }}
    >
      {import.meta.env.DEV && devDemoFill?.getValues ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-dashed border-amber-300/80 bg-amber-50/80 px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-amber-900/70">
            Development
          </span>
          <button
            type="button"
            className="rounded-md border border-amber-400/80 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 shadow-sm hover:bg-amber-100/80"
            onClick={() => {
              const patch = devDemoFill.getValues();
              setValues((prev) => ({ ...prev, ...patch }));
              devDemoFill.afterFill?.(patch);
            }}
          >
            {devDemoFill.label ?? "Fill demo data"}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {fields.map((field) => {
          if (field.type === "section") {
            return (
              <div key={field.label} className="col-span-full mt-4 border-b border-zinc-100 pb-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{field.label}</h3>
              </div>
            );
          }

          return (
            <label className={`block text-sm ${field.fullWidth ? "col-span-full" : ""}`} key={field.name}>
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                {field.label} {field.required && <span className="text-red-600">*</span>}
              </span>
              {field.type === "select" ? (
                <select
                  className={inputClass}
                  required={field.required}
                  disabled={disabled || field.disabled}
                  value={values[field.name] || ""}
                  onChange={(event) => {
                    const v = event.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: v }));
                    field.onChange?.(v);
                    onChange?.(field.name, v, setValues);
                  }}
                >
                  <option value="">Select...</option>
                  {(field.options ?? []).map((option, optIdx) => (
                    <option
                      key={`${field.name}-${optIdx}-${String(option.value ?? "")}`}
                      value={option.value ?? ""}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "searchableSelect" ? (
                <SearchableSelect
                  options={field.options.map(opt => ({
                    id: opt.value, 
                    label: opt.label,
                    sublabel: opt.sublabel
                  }))}
                  value={values[field.name]}
                  multiple={field.multiple}
                  placeholder={field.placeholder || "Start typing to search..."}
                  disabled={disabled || field.disabled}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [field.name]: v }));
                    field.onChange?.(v);
                    onChange?.(field.name, v, setValues);
                  }}
                />
              ) : field.type === "radio" ? (
                <div className="mt-2 space-y-2">
                  {(field.options || []).map((option, optIdx) => (
                    <label key={`${field.name}-${optIdx}`} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={field.name}
                        value={option.value}
                        checked={values[field.name] === option.value}
                        onChange={(event) => {
                          const v = event.target.value;
                          setValues((prev) => ({ ...prev, [field.name]: v }));
                          onChange?.(field.name, v, setValues);
                        }}
                        className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        disabled={disabled || field.disabled}
                      />
                      <span className="text-sm font-medium text-zinc-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : field.type === "textarea" ? (
                <textarea
                  className={inputClass}
                  rows={3}
                  required={field.required}
                  disabled={disabled || field.disabled}
                  value={values[field.name] || ""}
                  onChange={(event) => {
                    const v = event.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: v }));
                    onChange?.(field.name, v, setValues);
                  }}
                />
              ) : (
                <input
                  className={inputClass}
                  type={field.type}
                  required={field.required}
                  disabled={disabled || field.disabled}
                  value={values[field.name] || ""}
                  onChange={(event) => {
                    const v = event.target.value;
                    setValues((prev) => ({ ...prev, [field.name]: v }));
                    onChange?.(field.name, v, setValues);
                  }}
                />
              )}
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="text-sm rounded-md bg-zinc-50 p-3 text-zinc-700 border border-zinc-200">{error}</p>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            className="flex-1 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            onClick={onCancel}
            disabled={isSubmitting || disabled}
          >
            Cancel
          </button>
        )}
        <button
          className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          disabled={isSubmitting || disabled}
          type="submit"
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
