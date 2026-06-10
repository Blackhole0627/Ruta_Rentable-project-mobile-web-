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
import type { Currency, FuelUnit } from '@shared/types/user.types';

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, loadSettings, updateSettings, applyRecommended, isLoading } = useSettingsStore();
  const { user, setUser } = useUserStore();
  const { status, session } = useAuthStore();
  const { coop, invites, isAdmin, load: loadCoop } = useCooperativeStore();
  const { plans, load: loadSub } = useSubscriptionStore();
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('Ajustes')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AppIcons.account {...iconPropsSm} /> {t('Cuenta y sincronización')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {status === 'authenticated' ? (
            <>
              <p className="text-sm text-road-600">{session?.user.email}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/cuenta')}>
                {t('Gestionar cuenta')}
              </Button>
              <button
                type="button"
                onClick={() => navigate('/suscripcion')}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-road-200 px-3 py-2.5 text-left hover:bg-road-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-road-700">
                  <AppIcons.crown size={18} /> {t('Planes y suscripción')}
                </span>
                <span className="text-xs">
                  {user?.subscriptionStatus === 'active' && (user?.currentPlan ?? 'free') !== 'free' ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-800">
                      {plans.find((p) => p.id === user?.currentPlan)?.name ?? user?.currentPlan}
                    </span>
                  ) : (
                    <span className="text-road-400">{t('Sin plan')}</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/cooperativa')}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-road-200 px-3 py-2.5 text-left hover:bg-road-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-road-700">
                  <AppIcons.fleet size={18} /> {t('Cooperativa / Flota')}
                </span>
                <span className="text-xs">
                  {coop ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-800">
                      {isAdmin ? t('Administras') : t('Miembro')}: {coop.name}
                    </span>
                  ) : invites.length > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                      {t('{n} invitación', { n: invites.length })}
                    </span>
                  ) : (
                    <span className="text-road-400">{t('Sin cooperativa')}</span>
                  )}
                </span>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-road-600">
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
          <CardTitle className="text-base">{t('Idioma')}</CardTitle>
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
          <CardTitle className="text-base">{t('Combustible')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
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
          <CardTitle className="text-base">{t('Umbrales de rentabilidad')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
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
          <CardTitle className="text-base">{t('Comisiones por plataforma (%)')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm">{PLATFORM_LABELS[p]}</span>
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
            <CardTitle className="text-base">{t('Perfil')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
        className="w-full"
        onClick={async () => {
          const ok = await applyRecommended();
          if (ok) toast.success(t('Valores recomendados aplicados'));
          else toast.error(t('No se pudieron cargar los valores recomendados'));
        }}
      >
        <AppIcons.sync size={18} /> {t('Restablecer a valores recomendados')}
      </Button>
      <Button variant="destructive" className="w-full" onClick={handleClearData}>
        {confirmClear ? t('Confirmar: borrar todos los datos') : t('Borrar todos los datos')}
      </Button>
    </div>
  );
}
