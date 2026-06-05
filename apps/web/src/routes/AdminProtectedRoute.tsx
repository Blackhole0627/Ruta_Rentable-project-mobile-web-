import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/core/store/useAuthStore';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status, session } = useAuthStore();

  if (status === 'unknown') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (status !== 'authenticated' || !session) {
    return <Navigate to="/entrar" replace />;
  }
  if (session.user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
