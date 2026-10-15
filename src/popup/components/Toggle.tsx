interface ToggleProps {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

export function Toggle({ on, disabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className="toggle-switch"
      data-on={on}
      data-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      aria-pressed={on}
    >
      <span className="knob" />
    </button>
  );
}
