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

    // Status bar: solid white background with dark icons (matches the app shell).
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});

    const handle = CapApp.addListener('backButton', ({ canGoBack }) => {
      const path = pathRef.current;
      if (ROOT_ROUTES.includes(path) || !canGoBack) {
        CapApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
}
