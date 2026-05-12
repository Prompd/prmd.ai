import { useEffect, useRef } from 'react';

const P1 = 'M 271.6313,29.109924 C 456.06055,29.109924 454.60452,304.1 270.40336,304.1 L 228,304 v -47.30173 l 43.85191,0.0317 c 118.41324,0 116.08205,-178.966717 -0.82527,-178.966717 L 132.15087,77.622831 129.6,420.52 c -0.33992,0.0728 -45.968529,35.12868 -45.968529,35.12868 L 83.506489,28.866413 Z';
const P2 = 'm 156,102 103.33423,0.32678 c 88.07508,0 87.938,129.66692 1.26051,129.66692 l -32.5414,0.0925 -0.0533,-47.08616 32.66331,-0.23913 c 27.90739,0 25.69827,-34.89447 -0.0611,-34.99087 L 204.00004,150 c 0.90517,68.30467 0.52,211.29643 0.52,211.29643 0,0 -48.54879,38.04493 -48.62668,38.05052 z';
const MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 475 487"><path fill="white" d="${P1}"/><path fill="white" d="${P2}"/></svg>`;
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG)}")`;
const STATIC_GRADIENT = 'linear-gradient(135deg, #06b6d4, #3b82f6)';

interface PMarkProps {
  size?: number;
  trackCursor?: boolean;
}

export function PMark({ size = 22, trackCursor = true }: PMarkProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!trackCursor) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
        el.style.background = `conic-gradient(from ${deg}deg, #06b6d4, #8b5cf6, #ec4899, #f59e0b, #06b6d4)`;
        el.style.transition = 'none';
      });
    };
    const onLeave = (): void => {
      el.style.background = STATIC_GRADIENT;
      el.style.transition = 'background 400ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [trackCursor]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: STATIC_GRADIENT,
        WebkitMaskImage: MASK_URL,
        maskImage: MASK_URL,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    />
  );
}
