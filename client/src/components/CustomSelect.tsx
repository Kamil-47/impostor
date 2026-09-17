import { useState, useRef, useEffect, useCallback } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  id,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  const dropdownRef = useCallback(
    (el: HTMLUListElement | null) => {
      if (el && triggerRef.current && containerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        el.style.width = `${triggerRect.width}px`;
        el.style.left = `${triggerRect.left - containerRect.left}px`;
      }
    },
    [isOpen],
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = options.findIndex((o) => o.value === value);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0);
      onChange(options[next].value);
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
  }

  return (
    <div
      className={`custom-select ${className}${isOpen ? ' custom-select--open' : ''}${disabled ? ' custom-select--disabled' : ''}`}
      ref={containerRef}
      id={id}
    >
      <button
        type="button"
        className="custom-select__trigger"
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select__value">
          {selected?.label ?? ''}
        </span>
        <svg
          className="custom-select__arrow"
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <ul className="custom-select__dropdown" role="listbox" ref={dropdownRef}>
          {options.map((option) => (
            <li
              key={option.value}
              className={`custom-select__option${option.value === value ? ' custom-select__option--selected' : ''}`}
              role="option"
              aria-selected={option.value === value}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
              {option.value === value && (
                <svg
                  className="custom-select__check"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8.5l3.5 3.5 6.5-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
