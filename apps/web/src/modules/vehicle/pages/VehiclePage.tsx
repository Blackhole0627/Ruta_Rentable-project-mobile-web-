import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVehicleStore } from '@/core/store/useVehicleStore';
import { useSettingsStore } from '@/core/store/useSettingsStore';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { getCatalogByType, findCatalogVehicle } from '@/core/constants/catalog';
import { calculateCostPerKm } from '@/core/financial-model/costPerKm';
import { DEFAULT_PARAMS } from '@/core/constants/defaultParams';
import { formatCurrency } from '@/shared/utils/currency';
import { useUserStore } from '@/core/store/useUserStore';
import type { UnitType, UserVehicle } from '@shared/types/vehicle.types';
import type { SettingsRecord } from '@/core/db/schema';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { SearchableSelect } from '@/shared/components/ui/searchable-select';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { CostBreakdownChart } from '../components/CostBreakdownChart';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { hasCapability } from '@/core/subscription/planAccess';

/** Numeric field with a driver-friendly hint (FR-VEH-03 tooltips). */
function NumberField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <Label>{t(label)}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="mt-0.5 text-[11px] leading-tight text-road-400">{t(help)}</p>
    </div>
  );
}

type EditTarget = { mode: 'new'; nonce: number } | { mode: 'edit'; id: string };

export function VehiclePage() {
  const navigate = useNavigate();
  const { vehicles, vehicle, loadVehicles, saveVehicle, setActiveVehicle, deleteVehicle, isLoading } =
    useVehicleStore();
  const { settings, loadSettings } = useSettingsStore();
  const { user } = useUserStore();
  const { t } = useI18n();
  const [override, setOverride] = useState<EditTarget | null>(null);
  const canAddMore = hasCapability(user, 'multiVehicle');

  useEffect(() => {
    loadVehicles();
    loadSettings();
  }, [loadVehicles, loadSettings]);

  // Derive the edit target from the store — no prop→state syncing effect needed.
  const target: EditTarget =
    override ?? (vehicle ? { mode: 'edit', id: vehicle.id } : { mode: 'new', nonce: 0 });
  const seed = target.mode === 'edit' ? vehicles.find((v) => v.id === target.id) ?? null : null;
  const editorKey = target.mode === 'edit' ? target.id : `new-${target.nonce}`;

  if (isLoading) return <LoadingSkeleton variant="page" />;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">{t('Mis vehículos')}</h1>
      </header>

      {vehicles.length > 0 && (
        <div className="space-y-2">
          {vehicles.map((v) => {
            const VIcon = v.unitType === 'motorcycle' ? AppIcons.motorcycle : AppIcons.car;
            return (
            <div
              key={v.id}
              className={cn(
                'flex items-center justify-between rounded-lg border bg-white p-3 transition-colors',
                v.id === seed?.id ? 'border-brand-500 ring-1 ring-brand-500' : 'border-road-200',
              )}
            >
              <button
                type="button"
                className="flex flex-1 items-center gap-3 text-left"
                onClick={() => setOverride({ mode: 'edit', id: v.id })}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-road-100 text-road-500">
                  <VIcon size={18} />
                </span>
                <span>
                  <span className="block font-medium">
                    {v.make} {v.model}
                  </span>
                  <span className="text-xs text-road-500">
                    {v.unitType === 'car' ? t('Automóvil') : t('Motocicleta')} · {v.realKmPerLiter} km/L
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                {v.isActive ? (
                  <Badge variant="profitable">{t('Activo')}</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="press"
                    onClick={() => {
                      setActiveVehicle(v.id);
                      toast.info(t('Vehículo activado'));
                    }}
                  >
                    {t('Usar')}
                  </Button>
                )}
                <button
                  type="button"
                  aria-label={t('Eliminar')}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-danger-500 transition-colors hover:bg-red-50"
                  onClick={async () => {
                    await deleteVehicle(v.id);
                    setOverride(null);
                    toast.success(t('Vehículo eliminado'));
                  }}
                >
                  <AppIcons.trash size={18} />
                </button>
              </div>
            </div>
            );
          })}
          {canAddMore ? (
            <Button
              variant="outline"
              className="w-full press"
              onClick={() => setOverride({ mode: 'new', nonce: Date.now() })}
            >
              <AppIcons.plus size={18} /> {t('Agregar otro vehículo')}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full press"
              onClick={() => navigate('/suscripcion')}
            >
              <AppIcons.lock size={18} /> {t('Agregar otro vehículo (Pro)')}
            </Button>
          )}
        </div>
      )}

      <VehicleEditor
        key={editorKey}
        seed={seed}
        isNew={target.mode === 'new'}
        settings={settings}
        currency={user?.currency ?? 'NIO'}
        onSave={async (v) => {
          await saveVehicle(v);
          setOverride({ mode: 'edit', id: v.id });
          toast.success(t('Vehículo guardado'));
        }}
      />
    </div>
  );
}

function VehicleEditor({
  seed,
  isNew,
  settings,
  currency,
  onSave,
}: {
  seed: UserVehicle | null;
  isNew: boolean;
  settings: SettingsRecord | null;
  currency: 'NIO' | 'USD';
  onSave: (v: UserVehicle) => void;
}) {
  const [unitType, setUnitType] = useState<UnitType>(seed?.unitType ?? 'car');
  const [catalogId, setCatalogId] = useState(seed?.catalogId ?? '');
  const [form, setForm] = useState<Partial<UserVehicle>>(seed ?? {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { t } = useI18n();

  const set = (patch: Partial<UserVehicle>) => setForm((f) => ({ ...f, ...patch }));

  const catalog = getCatalogByType(unitType);
  const catalogOptions = catalog.map((v) => ({
    value: v.id,
    label: `${v.make} ${v.model}`,
    description: `${v.estKmPerLiter} km/L · ${v.fuelType === 'gasoline' ? t('Gasolina') : v.fuelType === 'diesel' ? t('Diésel') : t('Eléctrico')}`,
  }));
  const defaults = unitType === 'car' ? DEFAULT_PARAMS.car : DEFAULT_PARAMS.motorcycle;
  const EditorIcon = unitType === 'motorcycle' ? AppIcons.motorcycle : AppIcons.car;

  const handleCatalogSelect = (id: string) => {
    setCatalogId(id);
    const item = findCatalogVehicle(id);
    if (item) {
      setForm((f) => ({
        ...f,
        make: item.make,
        model: item.model,
        realKmPerLiter: item.estKmPerLiter,
      }));
    }
  };

  const handleSave = () => {
    const now = new Date();
    const v: UserVehicle = {
      id: seed?.id ?? crypto.randomUUID(),
      unitType,
      make: form.make ?? '',
      model: form.model ?? '',
      catalogId: catalogId || undefined,
      realKmPerLiter: Number(form.realKmPerLiter) || defaults.estKmPerLiter,
      fuelPricePerUnit: Number(form.fuelPricePerUnit) || settings?.gasolinePerLiter || 45,
      tireCost: Number(form.tireCost) || defaults.tireCostNIO,
      tireLifeKm: Number(form.tireLifeKm) || defaults.tireLifeKm,
      oilChangeCost: Number(form.oilChangeCost) || defaults.oilChangeCostNIO,
      oilChangeFreqKm: Number(form.oilChangeFreqKm) || defaults.oilChangeFreqKm,
      monthlyMaintenance: Number(form.monthlyMaintenance) || defaults.monthlyMaintenanceNIO,
      monthlyKm: Number(form.monthlyKm) || defaults.monthlyKm,
      vehicleValue: Number(form.vehicleValue) || defaults.vehicleValueNIO,
      usefulLifeKm: Number(form.usefulLifeKm) || defaults.usefulLifeKm,
      monthlyFixedCosts: Number(form.monthlyFixedCosts) || defaults.monthlyFixedCostsNIO,
      isActive: true,
      createdAt: seed?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(v);
  };

  const breakdown =
    settings &&
    calculateCostPerKm({
      fuelPricePerUnit: Number(form.fuelPricePerUnit) || settings.gasolinePerLiter,
      fuelEfficiency: Number(form.realKmPerLiter) || defaults.estKmPerLiter,
      tireCost: Number(form.tireCost) || defaults.tireCostNIO,
      tireLifeKm: Number(form.tireLifeKm) || defaults.tireLifeKm,
      oilChangeCost: Number(form.oilChangeCost) || defaults.oilChangeCostNIO,
      oilChangeFreqKm: Number(form.oilChangeFreqKm) || defaults.oilChangeFreqKm,
      monthlyMaintenance: Number(form.monthlyMaintenance) || defaults.monthlyMaintenanceNIO,
      monthlyKm: Number(form.monthlyKm) || defaults.monthlyKm,
      vehicleValue: Number(form.vehicleValue) || defaults.vehicleValueNIO,
      usefulLifeKm: Number(form.usefulLifeKm) || defaults.usefulLifeKm,
      monthlyFixedCosts: Number(form.monthlyFixedCosts) || defaults.monthlyFixedCostsNIO,
    });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 transition-colors">
              <EditorIcon size={18} />
            </span>
            {isNew ? t('Nuevo vehículo') : t('Editar vehículo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(['car', 'motorcycle'] as UnitType[]).map((ut) => {
              const TIcon = ut === 'car' ? AppIcons.car : AppIcons.motorcycle;
              return (
                <Button
                  key={ut}
                  variant={unitType === ut ? 'default' : 'outline'}
                  className="flex-1 press"
                  onClick={() => setUnitType(ut)}
                >
                  <TIcon size={18} />
                  {ut === 'car' ? t('Automóvil') : t('Motocicleta')}
                </Button>
              );
            })}
          </div>
          <SearchableSelect
            label={t('Marca y modelo')}
            options={catalogOptions}
            value={catalogId}
            onChange={handleCatalogSelect}
            placeholder={t('Toca para elegir del catálogo...')}
            searchPlaceholder={t('Buscar Toyota, Honda, Yamaha...')}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Rendimiento (km/L)"
              help="Km que recorres con un litro."
              value={form.realKmPerLiter}
              onChange={(v) => set({ realKmPerLiter: v })}
            />
            <NumberField
              label="Precio combustible (C$)"
              help="Precio por litro/galón hoy."
              value={form.fuelPricePerUnit}
              onChange={(v) => set({ fuelPricePerUnit: v })}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex w-full items-center justify-between rounded-lg border border-road-200 px-3 py-2.5 text-sm font-medium text-road-700"
          >
            {t('Ajustar costos detallados')}
            {showAdvanced ? (
              <AppIcons.chevronUp {...iconPropsSm} />
            ) : (
              <AppIcons.chevronDown {...iconPropsSm} />
            )}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-lg bg-road-50 p-3">
              <p className="text-xs text-road-500">
                {t('Si dejas un campo vacío, se usa el valor por defecto para {tipo}.', {
                  tipo: unitType === 'car' ? t('autos') : t('motos'),
                })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Costo de llantas (C$)"
                  help="Precio de un juego completo."
                  value={form.tireCost}
                  onChange={(v) => set({ tireCost: v })}
                />
                <NumberField
                  label="Duración de llantas (km)"
                  help="Km antes de cambiarlas."
                  value={form.tireLifeKm}
                  onChange={(v) => set({ tireLifeKm: v })}
                />
                <NumberField
                  label="Costo de aceite (C$)"
                  help="Por cada cambio de aceite."
                  value={form.oilChangeCost}
                  onChange={(v) => set({ oilChangeCost: v })}
                />
                <NumberField
                  label="Frecuencia de aceite (km)"
                  help="Cada cuántos km lo cambias."
                  value={form.oilChangeFreqKm}
                  onChange={(v) => set({ oilChangeFreqKm: v })}
                />
                <NumberField
                  label="Mantenimiento mensual (C$)"
                  help="Reparaciones promedio al mes."
                  value={form.monthlyMaintenance}
                  onChange={(v) => set({ monthlyMaintenance: v })}
                />
                <NumberField
                  label="Km por mes"
                  help="Cuántos km manejas al mes."
                  value={form.monthlyKm}
                  onChange={(v) => set({ monthlyKm: v })}
                />
                <NumberField
                  label="Valor del vehículo (C$)"
                  help="Cuánto vale hoy."
                  value={form.vehicleValue}
                  onChange={(v) => set({ vehicleValue: v })}
                />
                <NumberField
                  label="Vida útil restante (km)"
                  help="Km que le quedan al vehículo."
                  value={form.usefulLifeKm}
                  onChange={(v) => set({ usefulLifeKm: v })}
                />
                <NumberField
                  label="Costos fijos mensuales (C$)"
                  help="Seguro, parqueo, etc. al mes."
                  value={form.monthlyFixedCosts}
                  onChange={(v) => set({ monthlyFixedCosts: v })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {breakdown && (
        <Card className="border-brand-200 bg-brand-50">
          <CardContent className="space-y-4 pt-4">
            <div className="text-center">
              <p className="text-sm text-road-600">{t('Costo total por km')}</p>
              <p className="text-3xl font-bold text-brand-700">
                {formatCurrency(breakdown.totalPerKm, currency, { compact: true })}
                /km
              </p>
            </div>
            <CostBreakdownChart breakdown={breakdown} currency={currency} />
          </CardContent>
        </Card>
      )}

      <Button className="mt-4 w-full" size="lg" onClick={handleSave}>
        {isNew ? t('Guardar vehículo') : t('Guardar cambios')}
      </Button>
    </>
  );
}
