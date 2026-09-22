/**
 * PWA Installation and Application Mode Detection Engine
 * Ensures that once installed or launched as a standalone web application (PWA/WebAPK),
 * all in-app install buttons, banners, and floating prompts are completely suppressed.
 */

/**
 * Checks if the application is currently running as an installed standalone app,
 * or has previously been installed on this device/browser.
 */
export function isPwaInstalledOrAppMode(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check persistent installation mark in localStorage
  try {
    if (
      localStorage.getItem('tcsms_pwa_installed') === 'true' ||
      localStorage.getItem('pwa_installed_mode') === 'true'
    ) {
      return true;
    }
  } catch (e) {
    // Gracefully handle private browsing or iframe localStorage blocks
  }

  // 2. Check query params injected by PWA home screen launcher (start_url: /?mode=standalone)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get('mode') === 'standalone' ||
      urlParams.get('source') === 'pwa' ||
      urlParams.get('pwa') === '1'
    ) {
      return true;
    }
  } catch (e) {}

  // 3. Check CSS display-mode media queries
  try {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches
    ) {
      return true;
    }
  } catch (e) {}

  // 4. iOS Safari standalone mode
  if ((window.navigator as any)?.standalone === true) {
    return true;
  }

  // 5. Android WebAPK or Trusted Web Activity (TWA) referrer
  if (typeof document !== 'undefined' && document.referrer) {
    if (
      document.referrer.startsWith('android-app://') ||
      document.referrer.includes('org.chromium.webapk')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Marks the PWA as installed permanently on this device and notifies active components.
 */
export function markPwaAsInstalled(): void {
  try {
    localStorage.setItem('tcsms_pwa_installed', 'true');
    localStorage.setItem('pwa_installed_mode', 'true');
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pwa_app_installed'));
  }
}

/**
 * Subscribes to runtime events that indicate the app has been installed or entered standalone mode.
 */
export function subscribeToPwaInstallChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleInstalled = () => {
    markPwaAsInstalled();
    callback();
  };

  window.addEventListener('appinstalled', handleInstalled);
  window.addEventListener('pwa_app_installed', callback);

  let mediaQueryList: MediaQueryList | null = null;
  const handleMediaChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      markPwaAsInstalled();
      callback();
    }
  };

  try {
    mediaQueryList = window.matchMedia('(display-mode: standalone)');
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleMediaChange);
    } else if ((mediaQueryList as any).addListener) {
      (mediaQueryList as any).addListener(handleMediaChange);
    }
  } catch (e) {}

  return () => {
    window.removeEventListener('appinstalled', handleInstalled);
    window.removeEventListener('pwa_app_installed', callback);
    if (mediaQueryList) {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleMediaChange);
      } else if ((mediaQueryList as any).removeListener) {
        (mediaQueryList as any).removeListener(handleMediaChange);
      }
    }
  };
}
