import { Link, useLocation } from 'react-router-dom';
import type { ThemeMode } from '../theme';
import { PMark } from './PMark';
import { ThemeToggle } from './ThemeToggle';
import { Icon } from './Icon';
import { AuthControls } from './AuthControls';
import { trackEvent } from '../lib/analytics';

interface SiteHeaderProps {
  mode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export function SiteHeader({ mode, onThemeChange }: SiteHeaderProps): JSX.Element {
  const location = useLocation();
  const onApp = location.pathname.startsWith('/app');

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        <PMark size={24} />
        <span className="site-header-wordmark">prmd.ai</span>
      </Link>
      <div className="site-header-spacer" />
      <div className="site-header-actions">
        <ThemeToggle mode={mode} onChange={onThemeChange} />
        <AuthControls />
        {onApp ? (
          <Link to="/" className="btn btn-ghost">
            <Icon name="arrow-left" size={14} /> Home
          </Link>
        ) : (
          <Link
            to="/app"
            className="btn btn-primary"
            onClick={() => trackEvent({ name: 'cta_click', cta: 'open_generator_nav' })}
          >
            Open generator <Icon name="arrow-right" size={14} />
          </Link>
        )}
      </div>
    </header>
  );
}
