import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MobileLayout } from '@/shared/components/layout/MobileLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { OnboardingPage } from '@/modules/auth/pages/OnboardingPage';
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { AccountPage } from '@/modules/auth/pages/AccountPage';
import { SubscriptionPage } from '@/modules/subscription/pages/SubscriptionPage';
import { CooperativePage } from '@/modules/cooperative/pages/CooperativePage';
import { CalculatorPage } from '@/modules/calculator/pages/CalculatorPage';
import { HistoryPage } from '@/modules/history/pages/HistoryPage';
import { VehiclePage } from '@/modules/vehicle/pages/VehiclePage';
import { SettingsPage } from '@/modules/settings/pages/SettingsPage';

// Reports pulls in Recharts — load it on demand to keep the core bundle small.
const ReportsPage = lazy(() =>
  import('@/modules/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);

export function DriverRoutes() {
  return (
    <Routes>
      <Route path="bienvenida" element={<OnboardingPage />} />
      <Route path="entrar" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <MobileLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CalculatorPage />} />
        <Route path="historial" element={<HistoryPage />} />
        <Route path="reportes" element={<ReportsPage />} />
        <Route path="vehiculo" element={<VehiclePage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="cuenta" element={<AccountPage />} />
        <Route path="suscripcion" element={<SubscriptionPage />} />
        <Route path="cooperativa" element={<CooperativePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
