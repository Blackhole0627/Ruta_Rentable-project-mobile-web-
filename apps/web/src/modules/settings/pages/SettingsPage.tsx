import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/core/store/useSettingsStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useCooperativeStore } from '@/core/store/useCooperativeStore';
import { useSubscriptionStore } from '@/core/store/useSubscriptionStore';
import { db } from '@/core/db/db';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PLATFORMS, PLATFORM_LABELS } from '@/core/constants/platforms';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { planDisplayName } from '@/core/subscription/planAccess';
import type { Currency, FuelUnit } from '@shared/types/user.types';

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, loadSettings, updateSettings, applyRecommended, isLoading } = useSettingsStore();
  const { user, setUser } = useUserStore();
  const { status, session } = useAuthStore();
  const { coop, invites, isAdmin, load: loadCoop } = useCooperativeStore();
  const { plans, load: loadSub, isLoading: plansLoading } = useSubscriptionStore();
  const { t, lang, setLang } = useI18n();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadCoop();
      loadSub();
    }
  }, [status, loadCoop, loadSub]);

  if (isLoading || !settings) return <LoadingSkeleton variant="page" />;

  const handleClearData = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await db.delete();
    await db.open();
    window.location.href = '/bienvenida';
  };

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-lg font-extrabold tracking-tight text-road-900">{t('Ajustes')}</h1>
        <p className="mt-0.5 text-xs text-road-500">
          {t('Inicia sesión para respaldar tus viajes en la nube.')}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-road-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <AppIcons.account {...iconPropsSm} />
            </span>
            {t('Cuenta y sincronización')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {status === 'authenticated' ? (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-road-50 px-3 py-2.5 text-sm">
                <AppIcons.mail size={16} className="shrink-0 text-road-400" />
                <span className="truncate font-medium text-road-700">{session?.user.email}</span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate('/cuenta')}>
                {t('Gestionar cuenta')}
              </Button>
              <button
                type="button"
                onClick={() => navigate('/suscripcion')}
                className="press flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left ring-1 ring-road-100 hover:bg-road-50"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-road-800">
                  <AppIcons.crown size={18} className="text-gold-500" /> {t('Planes y suscripción')}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  {user?.subscriptionStatus === 'active' && (user?.currentPlan ?? 'free') !== 'free' ? (
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700 ring-1 ring-brand-100">
                      {plansLoading && !plans.length
                        ? '…'
                        : planDisplayName(user?.currentPlan, plans, t)}
                    </span>
                  ) : (
                    <span className="text-road-400">{t('Sin plan')}</span>
                  )}
                  <AppIcons.chevronRight size={16} className="text-road-300" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/cooperativa')}
                className="press flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left ring-1 ring-road-100 hover:bg-road-50"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-road-800">
                  <AppIcons.fleet size={18} className="text-brand-600" /> {t('Cooperativa / Flota')}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  {coop ? (
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700 ring-1 ring-brand-100">
                      {isAdmin ? t('Administras') : t('Miembro')}: {coop.name}
                    </span>
                  ) : invites.length > 0 ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-200">
                      {t('{n} invitación', { n: invites.length })}
                    </span>
                  ) : (
                    <span className="text-road-400">{t('Sin cooperativa')}</span>
                  )}
                  <AppIcons.chevronRight size={16} className="text-road-300" />
                </span>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-road-500">
                {t('Inicia sesión para respaldar tus viajes en la nube.')}
              </p>
              <Button className="w-full" onClick={() => navigate('/entrar')}>
                <AppIcons.mail size={18} /> {t('Iniciar sesión')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-road-900">{t('Idioma')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['es', 'en'] as const).map((l) => (
              <Button
                key={l}
                variant={lang === l ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setLang(l)}
              >
                {l === 'es' ? t('Español') : t('Inglés')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-road-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <AppIcons.fuel {...iconPropsSm} />
            </span>
            {t('Combustible')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2.5">
          <div>
            <Label>{t('Gasolina (C$/litro)')}</Label>
            <Input
              type="number"
              value={settings.gasolinePerLiter}
              onChange={(e) => updateSettings({ gasolinePerLiter: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>{t('Diésel (C$/litro)')}</Label>
            <Input
              type="number"
              value={settings.dieselPerLiter}
              onChange={(e) => updateSettings({ dieselPerLiter: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-road-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <AppIcons.reports {...iconPropsSm} />
            </span>
            {t('Umbrales de rentabilidad')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2.5">
          <div>
            <Label>{t('Rentable (mín. %)')}</Label>
            <Input
              type="number"
              value={settings.profitableThreshold * 100}
              onChange={(e) =>
                updateSettings({ profitableThreshold: Number(e.target.value) / 100 })
              }
            />
          </div>
          <div>
            <Label>{t('Aceptable (mín. %)')}</Label>
            <Input
              type="number"
              value={settings.acceptableThreshold * 100}
              onChange={(e) =>
                updateSettings({ acceptableThreshold: Number(e.target.value) / 100 })
              }
            />
          </div>
          <div className="col-span-2">
            <Label>{t('Margen deseado para tarifa mínima (%)')}</Label>
            <Input
              type="number"
              value={settings.desiredMargin * 100}
              onChange={(e) => updateSettings({ desiredMargin: Number(e.target.value) / 100 })}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-road-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <AppIcons.billing {...iconPropsSm} />
            </span>
            {t('Comisiones por plataforma (%)')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm font-medium text-road-600">{PLATFORM_LABELS[p]}</span>
              <Input
                type="number"
                className="flex-1"
                value={settings.commissions[p] ?? 0}
                onChange={(e) =>
                  updateSettings({
                    commissions: { ...settings.commissions, [p]: Number(e.target.value) },
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-road-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <AppIcons.account {...iconPropsSm} />
              </span>
              {t('Perfil')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              {(['NIO', 'USD'] as Currency[]).map((c) => (
                <Button
                  key={c}
                  variant={user.currency === c ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setUser({ ...user, currency: c })}
                >
                  {c === 'NIO' ? 'C$' : 'US$'}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['liter', 'gallon'] as FuelUnit[]).map((u) => (
                <Button
                  key={u}
                  variant={user.fuelUnit === u ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setUser({ ...user, fuelUnit: u })}
                >
                  {u === 'liter' ? t('Litro') : t('Galón')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Button
        variant="outline"
        className="w-full press"
        onClick={async () => {
          const ok = await applyRecommended();
          if (ok) toast.success(t('Valores recomendados aplicados'));
          else toast.error(t('No se pudieron cargar los valores recomendados'));
        }}
      >
        <AppIcons.sync size={18} /> {t('Restablecer a valores recomendados')}
      </Button>

      <div className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-danger-100">
        <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-danger-600">
          <AppIcons.alert size={16} /> {t('Borrar todos los datos')}
        </p>
        <Button variant="destructive" className="w-full press" onClick={handleClearData}>
          <AppIcons.trash size={18} />
          {confirmClear ? t('Confirmar: borrar todos los datos') : t('Borrar todos los datos')}
        </Button>
      </div>
    </div>
  );
}
