// Typed wrappers over the gtag.js global. The snippet that loads gtag.js lives
// in index.html (G-MJ181PXNVF). `send_page_view: false` is set in the config
// call there so we can fire route-aware page_view events manually from the
// SPA router instead of getting only the initial page.

type GtagFn = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const fn = window.gtag;
  return typeof fn === 'function' ? fn : null;
}

export type AnalyticsEvent =
  | { name: 'cta_click'; cta: 'open_generator_nav' | 'open_generator_hero' | 'how_it_works' | 'prompd_credit' | 'agent_pack' | 'github_repo' }
  | { name: 'theme_change'; mode: 'system' | 'light' | 'dark' }
  | { name: 'source_tab_change'; tab: 'manual' | 'url' }
  | { name: 'format_toggle'; format: string; checked: boolean }
  | { name: 'repo_url_detected'; host: 'github' | 'bitbucket' }
  | {
      name: 'generate_submit';
      tab: 'manual' | 'url';
      formats: string[];
      languages_count: number;
      frameworks_count: number;
      test_runners_count: number;
      has_description: boolean;
    }
  | { name: 'generate_success'; tab: 'manual' | 'url'; file_count: number; formats: string[] }
  | { name: 'generate_error'; tab: 'manual' | 'url'; message: string }
  | { name: 'preview_file_select'; path: string }
  | { name: 'download_zip'; file_count: number };

export function trackEvent(event: AnalyticsEvent): void {
  const gtag = getGtag();
  if (!gtag) return;
  const { name, ...params } = event;
  try {
    gtag('event', name, params);
  } catch {
    // Never let analytics break the app.
  }
}

export function trackPageView(path: string, title?: string): void {
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: title ?? document.title,
    });
  } catch {
    // Never let analytics break the app.
  }
}
