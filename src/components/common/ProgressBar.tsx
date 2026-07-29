import './ProgressBar.css';

interface ProgressBarProps {
  value: number;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  label?: string;
}

export function ProgressBar({ value, color = 'primary', label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-bar-wrap">
      {label && <div className="progress-bar-label">{label}</div>}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill progress-bar-fill--${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
