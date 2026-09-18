export default function QuantityStepper({ value, onChange, min = 1, max = 10, disabled = false }) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="stepper__value">{value}</span>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
