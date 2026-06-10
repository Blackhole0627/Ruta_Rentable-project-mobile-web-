import { useEffect, useState } from 'react';
import { getBackend } from '@/core/backend';
import type { SubscriptionPlan } from '@shared/types/subscription.types';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { formatCurrency } from '@/shared/utils/currency';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { ALL_CAPABILITIES, type Capability } from '@/core/subscription/planAccess';

const backend = getBackend();

/** Admin-facing labels for each feature flag a plan can unlock. */
const CAP_LABELS: Record<Capability, string> = {
  unlimitedCalc: 'Cálculos ilimitados',
  reports: 'Reportes',
  cloudSync: 'Respaldo en la nube',
  multiVehicle: 'Varios vehículos',
  breakEven: 'Punto de equilibrio',
  cooperative: 'Cooperativa / flota',
};

export function AdminPlans() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);

  const reload = () => backend.adminListPlans().then(setPlans);
  useEffect(() => {
    reload();
  }, []);

  if (!plans) return <LoadingSkeleton variant="cards" />;

  const startNew = () =>
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      priceNio: 0,
      priceUsd: 0,
      calcLimit: null,
      features: [],
      capabilities: [],
      durationDays: 30,
      isActive: true,
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <AppIcons.plus size={18} /> {t('Nuevo plan')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.isActive ? undefined : 'opacity-60'}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {!plan.isActive && <span className="text-xs text-road-400">{t('Inactivo')}</span>}
              </div>
              <p className="text-2xl font-bold text-brand-700">
                {formatCurrency(plan.priceNio ?? 0, 'NIO', { compact: true })}
                <span className="text-sm font-normal text-road-500">{t('/mes')}</span>
              </p>
              <p className="text-sm text-road-500">
                {plan.calcLimit == null ? t('Cálculos ilimitados') : t('{n} cálculos', { n: plan.calcLimit })}
              </p>
              <p className="text-xs text-road-400">
                {t('Duración: {n} días', { n: plan.durationDays ?? 30 })}
              </p>
              <ul className="space-y-1 text-sm text-road-600">
                {(plan.features ?? []).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <Button variant="outline" className="mt-2 w-full" onClick={() => setEditing(plan)}>
                <AppIcons.edit size={16} /> {t('Editar')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <PlanEditor
        key={editing?.id ?? 'none'}
        plan={editing}
        onClose={() => setEditing(null)}
        onSave={async (p) => {
          try {
            await backend.adminUpsertPlan(p);
            await reload();
            setEditing(null);
            toast.success(t('Plan guardado'));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t('No se pudo guardar el plan'));
          }
        }}
      />
    </div>
  );
}

function PlanEditor({
  plan,
  onClose,
  onSave,
}: {
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onSave: (p: SubscriptionPlan) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SubscriptionPlan | null>(plan);
  const [featuresText, setFeaturesText] = useState(() =>
    (plan?.features ?? []).join('\n'),
  );

  if (!draft) return null;

  const update = (patch: Partial<SubscriptionPlan>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Dialog open={!!plan} onClose={onClose} title={t('Editar plan')}>
      <div className="space-y-3">
        <div>
          <Label>{t('Nombre')}</Label>
          <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('Precio C$')}</Label>
            <Input
              type="number"
              value={draft.priceNio ?? 0}
              onChange={(e) => update({ priceNio: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>{t('Precio US$')}</Label>
            <Input
              type="number"
              value={draft.priceUsd ?? 0}
              onChange={(e) => update({ priceUsd: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('Límite de cálculos (vacío = ilimitado)')}</Label>
            <Input
              type="number"
              value={draft.calcLimit ?? ''}
              onChange={(e) =>
                update({ calcLimit: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>{t('Duración (días)')}</Label>
            <Input
              type="number"
              min={1}
              value={draft.durationDays ?? 30}
              onChange={(e) => update({ durationDays: Number(e.target.value) || 30 })}
            />
          </div>
        </div>
        <div>
          <Label>{t('Funciones que desbloquea')}</Label>
          <div className="mt-1 grid grid-cols-1 gap-1.5 rounded-lg border border-road-200 p-3 sm:grid-cols-2">
            {ALL_CAPABILITIES.map((cap) => {
              const checked = (draft.capabilities ?? []).includes(cap);
              return (
                <label key={cap} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={checked}
                    onChange={(e) => {
                      const set = new Set(draft.capabilities ?? []);
                      if (e.target.checked) set.add(cap);
                      else set.delete(cap);
                      update({ capabilities: Array.from(set) });
                    }}
                  />
                  {t(CAP_LABELS[cap])}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <Label>{t('Características (una por línea)')}</Label>
          <Textarea
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            rows={4}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>{t('Plan activo')}</Label>
          <Switch
            checked={draft.isActive}
            onCheckedChange={(v) => update({ isActive: v })}
            label={t('Plan activo')}
          />
        </div>
        <Button
          className="w-full"
          onClick={() =>
            onSave({
              ...draft,
              features: featuresText
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          {t('Guardar plan')}
        </Button>
      </div>
    </Dialog>
  );
}
