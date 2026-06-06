import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SafeArea, SystemBarsStyle } from '@capacitor-community/safe-area';

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

    // @capacitor-community/safe-area handles edge-to-edge insets natively (it
    // pads the WebView on Android WebViews that wrongly report 0px insets), so
    // the header sits below the status bar. Here we only style the bar content:
    // SystemBarsStyle.Light = dark icons, which read well on the light app shell.
    const applyStatusBar = () => {
      SafeArea.setSystemBarsStyle({ style: SystemBarsStyle.Light }).catch(() => {});
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
