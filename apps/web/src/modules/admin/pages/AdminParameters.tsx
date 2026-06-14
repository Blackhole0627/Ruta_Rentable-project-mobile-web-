import { useEffect, useState } from 'react';
import { getBackend } from '@/core/backend';
import type { GlobalParameters } from '@shared/types/admin.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { PLATFORMS, PLATFORM_LABELS } from '@/core/constants/platforms';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { errMessage } from '@/shared/utils/errorMessage';
import type { Platform } from '@shared/types/trip.types';

const backend = getBackend();

export function AdminParameters() {
  const { t } = useI18n();
  const [params, setParams] = useState<GlobalParameters | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    backend.adminGetParameters().then(setParams);
  }, []);

  if (!params) return <LoadingSkeleton variant="page" />;

  const update = (patch: Partial<GlobalParameters>) => {
    setParams((p) => (p ? { ...p, ...patch } : p));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await backend.adminUpdateParameters(params);
      setSaved(true);
      toast.success(t('Parámetros guardados. Los conductores los verán al actualizar.'));
    } catch (err) {
      toast.error(errMessage(err, t('No se pudieron guardar los parámetros.')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-road-500">
        {t('Estos valores se aplican como predeterminados para todos los conductores.')}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Precios de combustible (C$/litro)')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('Gasolina')}</Label>
            <Input
              type="number"
              value={params.gasolinePerLiter}
              onChange={(e) => update({ gasolinePerLiter: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>{t('Diésel')}</Label>
            <Input
              type="number"
              value={params.dieselPerLiter}
              onChange={(e) => update({ dieselPerLiter: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Comisiones por plataforma (%)')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {PLATFORMS.map((p) => (
            <div key={p}>
              <Label>{t(PLATFORM_LABELS[p])}</Label>
              <Input
                type="number"
                value={params.commissions[p] ?? 0}
                onChange={(e) =>
                  update({
                    commissions: {
                      ...params.commissions,
                      [p as Platform]: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Umbrales de rentabilidad (%)')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>{t('Rentable')}</Label>
            <Input
              type="number"
              value={params.profitableThreshold * 100}
              onChange={(e) => update({ profitableThreshold: Number(e.target.value) / 100 })}
            />
          </div>
          <div>
            <Label>{t('Aceptable')}</Label>
            <Input
              type="number"
              value={params.acceptableThreshold * 100}
              onChange={(e) => update({ acceptableThreshold: Number(e.target.value) / 100 })}
            />
          </div>
          <div>
            <Label>{t('Margen deseado')}</Label>
            <Input
              type="number"
              value={params.desiredMargin * 100}
              onChange={(e) => update({ desiredMargin: Number(e.target.value) / 100 })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? t('Guardando…') : t('Guardar parámetros')}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-brand-600">
            <AppIcons.check size={16} /> {t('Guardado')}
          </span>
        )}
      </div>
    </div>
  );
}
