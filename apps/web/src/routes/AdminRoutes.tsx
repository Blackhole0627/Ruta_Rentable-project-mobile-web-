import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';
import { AdminProtectedRoute } from './AdminProtectedRoute';
import { AdminDashboard } from '@/modules/admin/pages/AdminDashboard';
import { AdminUsers } from '@/modules/admin/pages/AdminUsers';
import { AdminPlans } from '@/modules/admin/pages/AdminPlans';
import { AdminPayments } from '@/modules/admin/pages/AdminPayments';
import { AdminKyc } from '@/modules/admin/pages/AdminKyc';
import { AdminParameters } from '@/modules/admin/pages/AdminParameters';
import { AdminCatalog } from '@/modules/admin/pages/AdminCatalog';
import { AdminAnnouncements } from '@/modules/admin/pages/AdminAnnouncements';

export function AdminRoutes() {
  return (
    <Routes>
      <Route
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="planes" element={<AdminPlans />} />
        <Route path="pagos" element={<AdminPayments />} />
        <Route path="kyc" element={<AdminKyc />} />
        <Route path="parametros" element={<AdminParameters />} />
        <Route path="catalogo" element={<AdminCatalog />} />
        <Route path="anuncios" element={<AdminAnnouncements />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
