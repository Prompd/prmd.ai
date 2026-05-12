import type { ThemeMode } from '../theme';
import { Icon } from './Icon';

interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const OPTIONS: { mode: ThemeMode; icon: 'sun' | 'moon' | 'monitor'; label: string }[] = [
  { mode: 'light', icon: 'sun', label: 'Light' },
  { mode: 'system', icon: 'monitor', label: 'System' },
  { mode: 'dark', icon: 'moon', label: 'Dark' },
];

export function ThemeToggle({ mode, onChange }: ThemeToggleProps): JSX.Element {
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          aria-label={opt.label}
          aria-pressed={mode === opt.mode}
          data-active={mode === opt.mode ? 'true' : 'false'}
          onClick={() => onChange(opt.mode)}
        >
          <Icon name={opt.icon} size={14} />
        </button>
      ))}
    </div>
  );
}
