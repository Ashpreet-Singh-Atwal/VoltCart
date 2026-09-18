export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export default function Countdown({ ms, label }) {
  return (
    <div className="countdown">
      {label && <span className="countdown__label">{label}</span>}
      <span className="countdown__value">{formatDuration(ms)}</span>
    </div>
  );
}
