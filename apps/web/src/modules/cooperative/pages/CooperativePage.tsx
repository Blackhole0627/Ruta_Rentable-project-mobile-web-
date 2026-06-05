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
import { formatCurrency } from '@/shared/utils/currency';
import { formatPercent } from '@/shared/utils/formatters';
import { AppIcons, iconPropsLg } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

const GROUP_PRICE_PER_DRIVER = 120; // C$/mes (plan Cooperativa)

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
    payGroup,
  } = useCooperativeStore();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

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

  // ---- No cooperative yet: create flow ----
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
  const groupAmount = (report?.drivers.length ?? 0) * GROUP_PRICE_PER_DRIVER;

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
          <CardTitle className="text-base">{t('Conductores ({n})', { n: report?.drivers.length ?? 0 })}</CardTitle>
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
                  onClick={() => removeMember(d.memberId)}
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
                    } catch (err) {
                      setInviteError(
                        err instanceof Error ? err.message : 'No se pudo invitar.',
                      );
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
              <CardTitle className="text-base">{t('Facturación en grupo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-road-500">
                  {t('Conductores ({n})', { n: report?.drivers.length ?? 0 })} ×{' '}
                  {formatCurrency(GROUP_PRICE_PER_DRIVER, currency, { compact: true })}
                </span>
                <span className="text-lg font-bold text-brand-700">
                  {formatCurrency(groupAmount, currency, { compact: true })}
                  {t('/mes')}
                </span>
              </div>
              <Button
                className="w-full"
                disabled={working || paid}
                onClick={async () => {
                  setWorking(true);
                  try {
                    await payGroup(groupAmount);
                    setPaid(true);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                <AppIcons.billing size={18} />
                {paid ? t('Pago registrado ✓') : t('Pagar por la flota')}
              </Button>
              <p className="text-xs text-road-400">{t('Pago simulado (un solo pago por toda la flota).')}</p>
            </CardContent>
          </Card>
        </>
      )}
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
  onSave: (p: { gasolinePerLiter?: number; desiredMargin?: number }) => void;
}) {
  const [fuel, setFuel] = useState(initialFuel ?? 45);
  const [margin, setMargin] = useState((initialMargin ?? 0.3) * 100);
  const [saved, setSaved] = useState(false);
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
            onClick={() => {
              onSave({ gasolinePerLiter: fuel, desiredMargin: margin / 100 });
              setSaved(true);
            }}
          >
            {t('Guardar')}
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
