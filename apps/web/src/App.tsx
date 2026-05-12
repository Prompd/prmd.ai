import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useTheme, type ThemeMode } from './theme';
import { AuthProvider } from './auth';
import { SiteHeader } from './components/SiteHeader';
import { MarketingPage } from './pages/MarketingPage';
import { GeneratorPage } from './pages/GeneratorPage';
import { trackEvent, trackPageView } from './lib/analytics';

function RouteTracker(): null {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export function App(): JSX.Element {
  const { mode, resolved, setMode } = useTheme();

  function handleThemeChange(next: ThemeMode): void {
    setMode(next);
    trackEvent({ name: 'theme_change', mode: next });
  }

  return (
    <AuthProvider resolvedTheme={resolved}>
      <BrowserRouter>
        <RouteTracker />
        <div className="app-shell">
          <SiteHeader mode={mode} onThemeChange={handleThemeChange} />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<MarketingPage />} />
              <Route path="/app" element={<GeneratorPage resolvedTheme={resolved} />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
