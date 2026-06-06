import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Root-level routes where pressing back should exit the app, not navigate. */
const ROOT_ROUTES = ['/', '/historial', '/reportes', '/vehiculo', '/ajustes', '/admin'];

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

    // Status bar: solid white background with dark icons (matches the app shell),
    // and pushed below the system status bar so the header isn't clipped.
    const applyStatusBar = () => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});
    };
    applyStatusBar();

    const back = CapApp.addListener('backButton', ({ canGoBack }) => {
      const path = pathRef.current;
      if (ROOT_ROUTES.includes(path) || !canGoBack) {
        CapApp.exitApp();
      } else {
        navigate(-1);
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
