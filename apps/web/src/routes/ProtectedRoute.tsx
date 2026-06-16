import { Navigate } from 'react-router-dom';
import { useUserStore } from '@/core/store/useUserStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUserStore();
  const status = useAuthStore((s) => s.status);

  if (isLoading || status === 'unknown') return <LoadingSpinner />;
  // Just signed in but the profile is still syncing in — wait rather than
  // bouncing to the welcome/onboarding screen (which looks like "login did
  // nothing"). The profile lands a beat later and the route renders.
  if (!user && status === 'authenticated') return <LoadingSpinner />;
  if (!user) return <Navigate to="/bienvenida" replace />;
  if (!user.onboardingComplete) return <Navigate to="/bienvenida" replace />;

  return <>{children}</>;
}
