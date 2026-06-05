import { useEffect, useMemo, useState } from 'react';
import { getBackend } from '@/core/backend';
import type { AdminUserRow } from '@shared/types/admin.types';
import type { SubscriptionStatus } from '@shared/types/subscription.types';
import { DataTable, type Column } from '../components/DataTable';
import { Dialog } from '@/shared/components/ui/dialog';
import { Select } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { AppIcons } from '@/shared/constants/icons';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

const backend = getBackend();

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: 'Prueba',
  active: 'Activo',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: 'bg-brand-100 text-brand-800',
  trial: 'bg-road-100 text-road-700',
  overdue: 'bg-amber-100 text-amber-900',
  cancelled: 'bg-red-100 text-red-800',
};

function StatusChip({ status }: { status: SubscriptionStatus }) {
  const { t } = useI18n();
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLES[status])}>
      {t(STATUS_LABELS[status])}
    </span>
  );
}

export function AdminUsers() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  const reload = () => backend.adminListUsers().then(setUsers);
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, query, statusFilter]);

  const handleStatusChange = async (userId: string, status: SubscriptionStatus) => {
    await backend.adminUpdateUserStatus(userId, status);
    await reload();
    setSelected((s) => (s && s.id === userId ? { ...s, status } : s));
  };

  const handleMakeAdmin = async (userId: string) => {
    await backend.adminSetUserRole(userId, 'admin');
    await reload(); // promoted user leaves the driver list
    setSelected(null);
  };

  if (!users) return <LoadingSkeleton variant="table" />;

  const columns: Column<AdminUserRow>[] = [
    { key: 'name', header: 'Nombre', render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'email', header: 'Correo', render: (u) => <span className="text-road-500">{u.email}</span> },
    { key: 'currentPlan', header: 'Plan' },
    { key: 'status', header: 'Estado', render: (u) => <StatusChip status={u.status} /> },
    { key: 'tripsCount', header: 'Viajes', className: 'text-right' },
    {
      key: 'revenue',
      header: 'Ingresos',
      className: 'text-right',
      render: (u) => formatCurrency(u.revenue, 'NIO', { compact: true }),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">{t('Buscar')}</Label>
          <Input
            className="mt-1 h-10"
            placeholder={t('Nombre o correo…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">{t('Estado')}</Label>
          <Select
            className="mt-1 h-10 w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatus | 'all')}
          >
            <option value="all">{t('Todos')}</option>
            {(Object.keys(STATUS_LABELS) as SubscriptionStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABELS[s])}
              </option>
            ))}
          </Select>
        </div>
        <span className="ml-auto text-sm text-road-500">
          {t('{n} usuarios', { n: filtered.length })}
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(u) => u.id}
        onRowClick={setSelected}
        empty="No hay usuarios que coincidan"
      />

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-3 text-sm">
            <Row label={t('Correo')} value={selected.email} />
            <Row label={t('Teléfono')} value={selected.phone ?? '—'} />
            <Row label={t('Plan')} value={selected.currentPlan} />
            <Row label={t('Viajes')} value={String(selected.tripsCount)} />
            <Row
              label={t('Ingresos generados')}
              value={formatCurrency(selected.revenue, 'NIO', { compact: true })}
            />
            <Row label={t('Registrado')} value={formatDate(new Date(selected.registeredAt))} />
            <div>
              <Label className="text-xs">{t('Cambiar estado')}</Label>
              <Select
                className="mt-1"
                value={selected.status}
                onChange={(e) =>
                  handleStatusChange(selected.id, e.target.value as SubscriptionStatus)
                }
              >
                {(Object.keys(STATUS_LABELS) as SubscriptionStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS_LABELS[s])}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleMakeAdmin(selected.id)}
            >
              <AppIcons.shieldCheck size={18} /> {t('Hacer administrador')}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
              {t('Cerrar')}
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-road-100 pb-2">
      <span className="text-road-500">{label}</span>
      <span className="font-medium text-road-900">{value}</span>
    </div>
  );
}
