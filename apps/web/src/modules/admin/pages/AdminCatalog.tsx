import { useEffect, useMemo, useState } from 'react';
import { getBackend } from '@/core/backend';
import type { CatalogVehicle, UnitType, FuelType } from '@shared/types/vehicle.types';
import { DataTable, type Column } from '../components/DataTable';
import { Dialog } from '@/shared/components/ui/dialog';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { errMessage } from '@/shared/utils/errorMessage';

const backend = getBackend();

const FUEL_LABELS: Record<FuelType, string> = {
  gasoline: 'Gasolina',
  diesel: 'Diésel',
  electric: 'Eléctrico',
};

export function AdminCatalog() {
  const { t } = useI18n();
  const [items, setItems] = useState<CatalogVehicle[] | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<UnitType | 'all'>('all');
  const [editing, setEditing] = useState<CatalogVehicle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogVehicle | null>(null);

  const reload = () => backend.adminListCatalog().then(setItems);
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((v) => {
      if (typeFilter !== 'all' && v.type !== typeFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return `${v.make} ${v.model}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, query, typeFilter]);

  if (!items) return <LoadingSkeleton variant="table" />;

  const startNew = () =>
    setEditing({
      id: crypto.randomUUID(),
      type: 'car',
      make: '',
      model: '',
      fuelType: 'gasoline',
      estKmPerLiter: 12,
    });

  const columns: Column<CatalogVehicle>[] = [
    {
      key: 'type',
      header: 'Tipo',
      render: (v) => (v.type === 'car' ? t('Auto') : t('Moto')),
    },
    { key: 'make', header: 'Marca', render: (v) => <span className="font-medium">{v.make}</span> },
    { key: 'model', header: 'Modelo' },
    { key: 'fuelType', header: 'Combustible', render: (v) => t(FUEL_LABELS[v.fuelType]) },
    { key: 'estKmPerLiter', header: 'km/L', className: 'text-right' },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (v) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            aria-label={t('Editar')}
            className="text-road-500 hover:text-road-900"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(v);
            }}
          >
            <AppIcons.edit size={16} />
          </button>
          <button
            type="button"
            aria-label={t('Eliminar')}
            className="text-danger-500 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(v);
            }}
          >
            <AppIcons.trash size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label className="text-xs">{t('Buscar')}</Label>
          <Input
            className="mt-1 h-10"
            placeholder={t('Marca o modelo…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">{t('Tipo')}</Label>
          <Select
            className="mt-1 h-10 w-40"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as UnitType | 'all')}
          >
            <option value="all">{t('Todos')}</option>
            <option value="car">{t('Automóviles')}</option>
            <option value="motorcycle">{t('Motocicletas')}</option>
          </Select>
        </div>
        <Button className="ml-auto" onClick={startNew}>
          <AppIcons.plus size={18} /> {t('Agregar')}
        </Button>
      </div>

      <p className="text-sm text-road-500">{t('{n} vehículos en el catálogo', { n: filtered.length })}</p>

      <DataTable columns={columns} rows={filtered} getRowKey={(v) => v.id} />

      <CatalogEditor
        key={editing?.id ?? 'none'}
        entry={editing}
        onClose={() => setEditing(null)}
        onSave={async (v) => {
          try {
            await backend.adminUpsertCatalog(v);
            await reload();
            setEditing(null);
          } catch (err) {
            toast.error(errMessage(err, t('No se pudo guardar el vehículo')));
          }
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('Eliminar del catálogo')}
        message={t('¿Eliminar "{name}" del catálogo?', {
          name: pendingDelete ? `${pendingDelete.make} ${pendingDelete.model}`.trim() : '',
        })}
        confirmLabel={t('Eliminar')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await backend.adminDeleteCatalog(pendingDelete.id);
            await reload();
            toast.success(t('Vehículo eliminado del catálogo'));
          } catch (err) {
            toast.error(errMessage(err, t('No se pudo eliminar el vehículo')));
          } finally {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}

function CatalogEditor({
  entry,
  onClose,
  onSave,
}: {
  entry: CatalogVehicle | null;
  onClose: () => void;
  onSave: (v: CatalogVehicle) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CatalogVehicle | null>(entry);
  if (!draft) return null;

  const update = (patch: Partial<CatalogVehicle>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Dialog open={!!entry} onClose={onClose} title={t('Vehículo del catálogo')}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('Tipo')}</Label>
            <Select value={draft.type} onChange={(e) => update({ type: e.target.value as UnitType })}>
              <option value="car">{t('Automóvil')}</option>
              <option value="motorcycle">{t('Motocicleta')}</option>
            </Select>
          </div>
          <div>
            <Label>{t('Combustible')}</Label>
            <Select
              value={draft.fuelType}
              onChange={(e) => update({ fuelType: e.target.value as FuelType })}
            >
              <option value="gasoline">{t('Gasolina')}</option>
              <option value="diesel">{t('Diésel')}</option>
              <option value="electric">{t('Eléctrico')}</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('Marca')}</Label>
            <Input value={draft.make} onChange={(e) => update({ make: e.target.value })} />
          </div>
          <div>
            <Label>{t('Modelo')}</Label>
            <Input value={draft.model} onChange={(e) => update({ model: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>{t('Rendimiento estimado (km/L)')}</Label>
          <Input
            type="number"
            value={draft.estKmPerLiter}
            onChange={(e) => update({ estKmPerLiter: Number(e.target.value) })}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => onSave(draft)}
          disabled={!draft.make.trim() || !draft.model.trim() || !(draft.estKmPerLiter > 0)}
        >
          {t('Guardar')}
        </Button>
      </div>
    </Dialog>
  );
}
