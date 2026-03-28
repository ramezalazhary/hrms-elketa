import { useState } from 'react'

export function FormBuilder({
  fields,
  submitLabel,
  initialValues,
  onSubmit,
  error,
  disabled,
  onCancel,
}) {
  const computedInitialValues = fields.reduce((acc, field) => {
    acc[field.name] = ''
    return acc
  }, {})
  const [values, setValues] = useState({
    ...computedInitialValues,
    ...initialValues,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      className="space-y-6 rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur-xl"
      onSubmit={(event) => {
        event.preventDefault()
        setIsSubmitting(true)
        Promise.resolve(onSubmit(values)).finally(() => setIsSubmitting(false))
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {fields.map((field) => {
          if (field.type === 'section') {
            return (
              <div key={field.label} className="col-span-full mt-4 border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{field.label}</h3>
              </div>
            )
          }

          return (
            <label className={`block text-sm ${field.fullWidth ? 'col-span-full' : ''}`} key={field.name}>
              <span className="mb-2 block font-semibold text-slate-700 tracking-tight">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </span>
              {field.type === 'select' ? (
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-slate-900 transition-all hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  required={field.required}
                  value={values[field.name] || ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                >
                  <option value="">Select...</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-slate-900 transition-all hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  rows={3}
                  required={field.required}
                  value={values[field.name] || ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                />
              ) : (
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-slate-900 transition-all hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  type={field.type}
                  required={field.required}
                  value={values[field.name] || ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                />
              )}
            </label>
          )
        })}
      </div>
      {error ? (
        <p className="text-sm rounded-lg bg-red-50 p-3 text-red-600 font-medium">{error}</p>
      ) : null}
      
      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={onCancel}
            disabled={isSubmitting || disabled}
          >
            Cancel
          </button>
        )}
        <button
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          disabled={isSubmitting || disabled}
          type="submit"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
