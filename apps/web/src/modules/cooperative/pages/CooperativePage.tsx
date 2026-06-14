import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCooperativeStore } from '@/core/store/useCooperativeStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { errMessage } from '@/shared/utils/errorMessage';
import { formatCurrency } from '@/shared/utils/currency';
import { formatPercent } from '@/shared/utils/formatters';
import { AppIcons, iconPropsLg } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { MAX_COOP_DRIVERS } from '@shared/types/cooperative.types';

export function CooperativePage() {
  const navigate = useNavigate();
  const { status } = useAuthStore();
  const { user } = useUserStore();
  const {
    coop,
    report,
    invites,
    isAdmin,
    isLoading,
    error,
    load,
    create,
    invite,
    removeMember,
    respondToInvite,
    leave,
    updateParams,
  } = useCooperativeStore();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ memberId: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  if (status !== 'authenticated') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{t('Cooperativa')}</h1>
        <Card>
          <CardContent className="py-8 text-center text-road-600">
            {t('Inicia sesión para crear o administrar una cooperativa.')}
            <Button className="mt-4" onClick={() => navigate('/entrar')}>
              {t('Iniciar sesión')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && !coop) return <LoadingSkeleton variant="page" />;

  const currency = user?.currency ?? 'NIO';

  // ---- No cooperative yet: create flow (open to any signed-in user) ----
  if (!coop) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <AppIcons.fleet {...iconPropsLg} />
          </span>
          <h1 className="text-xl font-bold">{t('Cooperativa / Flota')}</h1>
        </header>

        {error && (
          <div className="rounded-lg border border-danger-500/30 bg-red-50 p-3 text-sm text-danger-500">
            {error}
          </div>
        )}

        {invites.map((inv) => (
          <Card key={inv.member.id} className="border-brand-300 bg-brand-50">
            <CardContent className="space-y-3 pt-4">
              <p className="text-sm font-semibold text-road-900">
                {t('Te invitaron a "{coop}"', { coop: inv.coop.name })}
              </p>
              <p className="text-xs text-road-600">
                {t('Acepta para unirte a la flota y compartir tus reportes con el administrador.')}
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={working}
                  onClick={async () => {
                    setWorking(true);
                    try {
                      await respondToInvite(inv.member.id, true);
                      if (!useCooperativeStore.getState().error)
                        toast.success(t('Te uniste a la cooperativa'));
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  <AppIcons.check size={18} /> {t('Aceptar')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={working}
                  onClick={async () => {
                    setWorking(true);
                    try {
                      await respondToInvite(inv.member.id, false);
                      toast.info(t('Invitación rechazada'));
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  {t('Rechazar')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm text-road-600">
              {t('Crea una cooperativa para administrar varios conductores: invita a tu flota, mira la rentabilidad de cada uno y maneja la facturación en grupo.')}
            </p>
            <div>
              <Label>{t('Nombre de la cooperativa')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cooperativa Managua"
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || working}
              onClick={async () => {
                setWorking(true);
                try {
                  await create(name);
                  if (!useCooperativeStore.getState().error)
                    toast.success(t('Cooperativa creada'));
                } finally {
                  setWorking(false);
                }
              }}
            >
              <AppIcons.plus size={18} /> {t('Crear cooperativa')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Member view: confirm membership + allow leaving ----
  if (coop && !isAdmin) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <AppIcons.fleet {...iconPropsLg} />
          </span>
          <div>
            <h1 className="text-xl font-bold">{coop.name}</h1>
            <p className="text-xs text-road-500">{t('Miembro de la cooperativa')}</p>
          </div>
        </header>

        <Card className="border-brand-300 bg-brand-50">
          <CardContent className="flex items-start gap-3 pt-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <AppIcons.check size={20} />
            </span>
            <div>
              <p className="font-semibold text-road-900">
                {t('Perteneces a "{coop}"', { coop: coop.name })}
              </p>
              <p className="mt-1 text-xs text-road-600">
                {t('El administrador de la cooperativa puede ver tus reportes de rentabilidad para gestionar la flota.')}
              </p>
            </div>
          </CardContent>
        </Card>

        {coop.subscriptionActive ? (
          <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-800">
            <AppIcons.crown size={16} />
            {t('Tu cooperativa está activa: tienes acceso premium.')}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900">
            <AppIcons.clock size={16} />
            {t('Tu cooperativa aún no está activa. El administrador debe activar el plan.')}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger-500/30 bg-red-50 p-3 text-sm text-danger-500">
            {error}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full text-danger-500"
          disabled={working}
          onClick={async () => {
            if (!leaveConfirm) {
              setLeaveConfirm(true);
              return;
            }
            setWorking(true);
            try {
              await leave();
              if (!useCooperativeStore.getState().error)
                toast.info(t('Saliste de la cooperativa'));
            } finally {
              setWorking(false);
              setLeaveConfirm(false);
            }
          }}
        >
          {leaveConfirm ? t('¿Confirmar salida?') : t('Salir de la cooperativa')}
        </Button>
      </div>
    );
  }

  // ---- Cooperative dashboard (admin) ----
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <AppIcons.fleet {...iconPropsLg} />
        </span>
        <div>
          <h1 className="text-xl font-bold">{coop.name}</h1>
          <p className="text-xs text-road-500">
            {isAdmin ? t('Administrador de la cooperativa') : t('Miembro de la cooperativa')}
          </p>
        </div>
      </header>

      {!coop.subscriptionActive && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AppIcons.crown size={18} /> {t('Activa tu flota')}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {t('Compra el plan Cooperativa para dar acceso premium a todos tus conductores (hasta {max}).', { max: MAX_COOP_DRIVERS })}
          </p>
          <Button className="press mt-3 w-full" onClick={() => navigate('/suscripcion')}>
            <AppIcons.crown size={18} /> {t('Comprar plan Cooperativa')}
          </Button>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{t('Ganancia de la flota')}</p>
            <p className="text-lg font-bold text-brand-600">
              {formatCurrency(report.totalProfit, currency, { compact: true })}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{t('Viajes totales')}</p>
            <p className="text-lg font-bold">{report.totalTrips}</p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{t('Conductores rentables')}</p>
            <p className="text-lg font-bold text-brand-600">{report.profitableDrivers}</p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{t('No rentables')}</p>
            <p className="text-lg font-bold text-danger-500">{report.unprofitableDrivers}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('Conductores ({n}/{max})', {
              n: report?.drivers.length ?? 0,
              max: MAX_COOP_DRIVERS,
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {report?.drivers.map((d) => (
            <div
              key={d.memberId}
              className="flex items-center justify-between gap-2 rounded-lg border border-road-100 p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-road-500">{d.email}</p>
                <p className="text-xs text-road-400">
                  {t('{n} viajes · margen {m}', {
                    n: d.tripsCount,
                    m: formatPercent(d.avgMargin),
                  })}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    'font-bold',
                    d.totalProfit >= 0 ? 'text-brand-600' : 'text-danger-500',
                  )}
                >
                  {formatCurrency(d.totalProfit, currency, { compact: true })}
                </span>
                {d.status === 'invited' ? (
                  <Badge>{t('Invitado')}</Badge>
                ) : (
                  <Badge variant={d.profitable ? 'profitable' : 'danger'}>
                    {d.profitable ? t('Rentable') : t('Pérdida')}
                  </Badge>
                )}
              </div>
              {isAdmin && d.userId !== user?.id && (
                <button
                  type="button"
                  aria-label={t('Eliminar')}
                  className="shrink-0 text-road-400 hover:text-danger-500"
                  onClick={() => setPendingRemove({ memberId: d.memberId, name: d.name })}
                >
                  <AppIcons.trash size={16} />
                </button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Invitar conductor')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
                <Button
                  disabled={!inviteEmail.includes('@') || working}
                  onClick={async () => {
                    setWorking(true);
                    setInviteError(null);
                    try {
                      await invite(inviteEmail);
                      setInviteEmail('');
                      toast.success(t('Invitación enviada'));
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'No se pudo invitar.';
                      setInviteError(msg);
                      toast.error(t(msg));
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  {t('Invitar')}
                </Button>
              </div>
              {inviteError ? (
                <p className="text-xs text-danger-500">{t(inviteError)}</p>
              ) : (
                <p className="text-xs text-road-400">
                  {t('Solo puedes invitar a usuarios ya registrados.')}
                </p>
              )}
            </CardContent>
          </Card>

          <CoopParamsCard
            currency={currency}
            initialFuel={coop.fleetParams?.gasolinePerLiter}
            initialMargin={coop.fleetParams?.desiredMargin}
            onSave={updateParams}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Suscripción de la flota')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {coop.subscriptionActive ? (
                <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
                  <AppIcons.check size={16} />{' '}
                  {t('Plan Cooperativa activo. Toda tu flota tiene premium.')}
                </p>
              ) : (
                <p className="text-sm text-road-600">
                  {t('Compra el plan Cooperativa para activar a toda tu flota (hasta {max} conductores).', { max: MAX_COOP_DRIVERS })}
                </p>
              )}
              <Button
                className="press w-full"
                variant={coop.subscriptionActive ? 'outline' : 'default'}
                onClick={() => navigate('/suscripcion')}
              >
                <AppIcons.crown size={18} />
                {coop.subscriptionActive
                  ? t('Gestionar suscripción')
                  : t('Comprar plan Cooperativa')}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title={t('Eliminar conductor')}
        message={t('¿Quitar a {name} de la cooperativa? Dejará de compartir sus reportes contigo.', {
          name: pendingRemove?.name ?? '',
        })}
        confirmLabel={t('Eliminar')}
        onCancel={() => setPendingRemove(null)}
        onConfirm={async () => {
          if (!pendingRemove) return;
          try {
            await removeMember(pendingRemove.memberId);
            toast.success(t('Conductor eliminado'));
          } catch (err) {
            toast.error(errMessage(err, t('No se pudo eliminar al conductor.')));
          } finally {
            setPendingRemove(null);
          }
        }}
      />
    </div>
  );
}

function CoopParamsCard({
  currency,
  initialFuel,
  initialMargin,
  onSave,
}: {
  currency: 'NIO' | 'USD';
  initialFuel?: number;
  initialMargin?: number;
  onSave: (p: { gasolinePerLiter?: number; desiredMargin?: number }) => void | Promise<void>;
}) {
  const [fuel, setFuel] = useState(initialFuel ?? 45);
  const [margin, setMargin] = useState((initialMargin ?? 0.3) * 100);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();
  void currency;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('Parámetros de la flota')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('Combustible (C$/L)')}</Label>
            <Input
              type="number"
              value={fuel}
              onChange={(e) => {
                setFuel(Number(e.target.value));
                setSaved(false);
              }}
            />
          </div>
          <div>
            <Label>{t('Margen deseado (%)')}</Label>
            <Input
              type="number"
              value={margin}
              onChange={(e) => {
                setMargin(Number(e.target.value));
                setSaved(false);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ gasolinePerLiter: fuel, desiredMargin: margin / 100 });
                setSaved(true);
              } catch (err) {
                toast.error(errMessage(err, t('No se pudieron guardar los parámetros.')));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? t('Guardando…') : t('Guardar')}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-brand-600">
              <AppIcons.check size={16} /> {t('Guardado')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
