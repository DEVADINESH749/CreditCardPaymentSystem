import { useState } from 'react'

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="field-group password-field-group">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          className="password-visibility-toggle"
          type="button"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {isVisible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0112 5c6.2 0 9.5 7 9.5 7a15.5 15.5 0 01-3.1 3.8" />
                <path d="M6.6 6.6C3.9 8.3 2.5 12 2.5 12s3.3 7 9.5 7a10.4 10.4 0 004.1-.8" />
              </>
            ) : (
              <>
                <path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}

export default PasswordField