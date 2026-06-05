import { Navigate } from 'react-router-dom';
import { useUserStore } from '@/core/store/useUserStore';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUserStore();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/bienvenida" replace />;
  if (!user.onboardingComplete) return <Navigate to="/bienvenida" replace />;

  return <>{children}</>;
}
