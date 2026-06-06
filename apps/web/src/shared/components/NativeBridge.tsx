import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Home screens — pressing back here exits the app. */
const HOME_ROUTES = ['/', '/admin'];
/** Bottom-nav tabs — pressing back here returns to home first. */
const TAB_ROUTES = ['/historial', '/reportes', '/vehiculo', '/ajustes'];

/**
 * Native (Capacitor) integration: themes the status bar and routes the Android
 * hardware back button through React Router instead of closing the app.
 * No-op in the browser.
 */
export function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Android 15+ (targetSdk 36) forces edge-to-edge, so let the WebView draw
    // under the status bar (overlay: true) and report safe-area insets — the
    // layout's `pt-safe` padding then keeps the header below the status bar.
    // Dark icons (Style.Light) read well over the light app background.
    const applyStatusBar = () => {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    };
    applyStatusBar();

    const back = CapApp.addListener('backButton', ({ canGoBack }) => {
      const path = pathRef.current;
      if (HOME_ROUTES.includes(path)) {
        CapApp.exitApp(); // home → close the app
      } else if (TAB_ROUTES.includes(path)) {
        navigate('/'); // a bottom-nav tab → back to home
      } else if (canGoBack) {
        navigate(-1); // any sub-screen → previous screen
      } else {
        navigate('/'); // fallback → home
      }
    });

    // Android sometimes drops the status-bar config when the app returns from the
    // background, leaving the header hidden behind the status bar — reapply it.
    const resume = CapApp.addListener('resume', applyStatusBar);

    return () => {
      back.then((h) => h.remove()).catch(() => {});
      resume.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
}
