declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

export function initAnalytics(): void {
  const raw = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return;
  }

  let measurementId = raw.trim();

  // Extract ID if a full URL or query parameter was provided (e.g. ?id=G-XXXXXXXXXX)
  const match = measurementId.match(/id=([A-Za-z0-9-_]+)/);
  if (match) {
    measurementId = match[1];
  } else if (measurementId.startsWith('http://') || measurementId.startsWith('https://')) {
    const parts = measurementId.split('?')[0].split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      measurementId = lastPart;
    }
  }

  if (!measurementId) return;

  // 1. Inject gtag script tag
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  // 2. Setup dataLayer and window.gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: any[]) {
    window.dataLayer.push(args);
  }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', measurementId);
}
