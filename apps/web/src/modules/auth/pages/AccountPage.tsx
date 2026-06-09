import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { useAuthStore } from '@/core/store/useAuthStore';
import { toast } from '@/core/store/useToastStore';
import { hasCapability } from '@/core/subscription/planAccess';
import { useSyncStore } from '@/core/store/useSyncStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useSubscriptionStore } from '@/core/store/useSubscriptionStore';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { AppIcons, iconPropsLg, iconPropsSm } from '@/shared/constants/icons';
import { formatDate } from '@/shared/utils/formatters';
import { useI18n } from '@/core/i18n/i18n';

const STATUS_LABELS: Record<string, string> = {
  trial: 'Prueba',
  active: 'Activo',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

export function AccountPage() {
  const navigate = useNavigate();
  const { session, status, signOut, deleteAccount, updatePassword, isWorking } = useAuthStore();
  const { sync, status: syncStatus, lastSyncedAt } = useSyncStore();
  const { user } = useUserStore();
  const { plans, load: loadPlans } = useSubscriptionStore();
  const { t } = useI18n();
  const isOnline = useOnlineStatus();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const pwMatch = newPw === confirmPw;
  const canChangePw = newPw.length >= 6 && pwMatch;

  const handleChangePw = async () => {
    if (!canChangePw) return;
    const ok = await updatePassword(newPw);
    if (ok) {
      toast.success(t('Contraseña actualizada.'));
      setShowChangePw(false);
      setNewPw('');
      setConfirmPw('');
    } else {
      toast.error(useAuthStore.getState().error ?? t('No se pudo actualizar la contraseña'));
    }
  };

  // Plans carry the human name; currentPlan is stored as the plan id (a UUID
  // once a payment is approved), so load them to resolve the label.
  useEffect(() => {
    if (plans.length === 0) loadPlans();
  }, [plans.length, loadPlans]);

  const planId = user?.currentPlan ?? 'free';
  const planLabel =
    plans.find((p) => p.id === planId)?.name ??
    (planId === 'free' ? t('Gratis') : planId);

  if (status !== 'authenticated' || !session) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{t('Cuenta')}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AppIcons.cloudOff {...iconPropsLg} className="text-road-400" />
            <p className="text-road-600">
              {t('Estás en modo local. Inicia sesión para respaldar y sincronizar tus viajes entre dispositivos.')}
            </p>
            <Button onClick={() => navigate('/entrar')}>
              <AppIcons.mail size={18} /> {t('Iniciar sesión')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('Cuenta')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AppIcons.account {...iconPropsSm} /> {t('Mi cuenta')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-road-500">{t('Correo')}</span>
            <span className="font-medium">{session.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-road-500">{t('Plan')}</span>
            <Badge variant="profitable">{planLabel}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-road-500">{t('Estado')}</span>
            <span className="font-medium">
              {t(STATUS_LABELS[user?.subscriptionStatus ?? 'trial'])}
            </span>
          </div>
          {user?.subscriptionEndsAt && user?.subscriptionStatus === 'active' && (
            <div className="flex justify-between">
              <span className="text-road-500">{t('Vence')}</span>
              <span className="font-medium">{formatDate(new Date(user.subscriptionEndsAt))}</span>
            </div>
          )}
          <Button variant="outline" className="mt-2 w-full" onClick={() => navigate('/suscripcion')}>
            <AppIcons.crown size={18} /> {t('Ver planes y suscripción')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AppIcons.cloud {...iconPropsSm} /> {t('Sincronización')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-road-500">{t('Última sincronización')}</span>
            <span className="font-medium">
              {lastSyncedAt ? formatDate(new Date(lastSyncedAt)) : t('Nunca')}
            </span>
          </div>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => sync()}
            disabled={!isOnline || syncStatus === 'syncing'}
          >
            <AppIcons.sync
              size={18}
              className={syncStatus === 'syncing' ? 'animate-spin' : undefined}
            />
            {syncStatus === 'syncing' ? t('Sincronizando…') : t('Sincronizar ahora')}
          </Button>
          {!isOnline && (
            <p className="text-xs text-amber-600">
              {t('Sin conexión — la sincronización se reanudará al volver en línea.')}
            </p>
          )}
          {!hasCapability(user, 'cloudSync') && (
            <p className="text-xs text-road-400">
              {t('El respaldo en la nube está disponible en los planes de pago.')}
            </p>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full press" onClick={() => setShowChangePw(true)}>
        <AppIcons.key size={18} /> {t('Cambiar contraseña')}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          await signOut();
          toast.info(t('Sesión cerrada'));
        }}
      >
        <AppIcons.logout size={18} /> {t('Cerrar sesión')}
      </Button>
      <Button
        variant="destructive"
        className="w-full"
        onClick={() => setConfirmDelete(true)}
      >
        <AppIcons.trash size={18} /> {t('Eliminar mi cuenta')}
      </Button>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('Eliminar cuenta')}
      >
        <p className="text-sm text-road-600">
          {t('Esto borrará tu cuenta y todos tus datos de forma permanente. Esta acción no se puede deshacer.')}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setConfirmDelete(false)}
          >
            {t('Cancelar')}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={isWorking}
            onClick={async () => {
              await deleteAccount();
              setConfirmDelete(false);
              toast.info(t('Cuenta eliminada'));
              navigate('/bienvenida');
            }}
          >
            {isWorking ? t('Eliminando…') : t('Sí, eliminar')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={showChangePw}
        onClose={() => setShowChangePw(false)}
        title={t('Cambiar contraseña')}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="acc-newpw">{t('Nueva contraseña')}</Label>
            <PasswordInput
              id="acc-newpw"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
              showStrength
            />
          </div>
          <div>
            <Label htmlFor="acc-confirmpw">{t('Confirmar contraseña')}</Label>
            <PasswordInput
              id="acc-confirmpw"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && handleChangePw()}
            />
            {confirmPw.length > 0 && !pwMatch && (
              <p className="mt-1 text-xs text-danger-500">
                {t('Las contraseñas no coinciden.')}
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowChangePw(false)}>
              {t('Cancelar')}
            </Button>
            <Button
              className="flex-1"
              disabled={isWorking || !canChangePw}
              onClick={handleChangePw}
            >
              {isWorking ? t('Guardando…') : t('Guardar')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
