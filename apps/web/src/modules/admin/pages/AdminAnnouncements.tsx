import { useEffect, useState } from 'react';
import { getBackend } from '@/core/backend';
import type { Announcement, AnnouncementTarget } from '@shared/types/admin.types';
import type { SubscriptionStatus } from '@shared/types/subscription.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { formatDate } from '@/shared/utils/formatters';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { errMessage } from '@/shared/utils/errorMessage';

const backend = getBackend();

type TargetKind = 'all' | 'plan' | 'status';

function describeTarget(t: AnnouncementTarget): string {
  if (t.kind === 'all') return 'Todos los usuarios';
  if (t.kind === 'plan') return `Plan: ${t.plan}`;
  return `Estado: ${t.status}`;
}

export function AdminAnnouncements() {
  const { t } = useI18n();
  const [list, setList] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetKind, setTargetKind] = useState<TargetKind>('all');
  const [plan, setPlan] = useState('basic');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [schedule, setSchedule] = useState('');
  const [sending, setSending] = useState(false);

  const [now] = useState(() => Date.now());

  const reload = () => backend.adminListAnnouncements().then(setList);
  useEffect(() => {
    reload();
  }, []);

  const buildTarget = (): AnnouncementTarget => {
    if (targetKind === 'plan') return { kind: 'plan', plan };
    if (targetKind === 'status') return { kind: 'status', status };
    return { kind: 'all' };
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const now = new Date().toISOString();
      await backend.adminCreateAnnouncement({
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim(),
        target: buildTarget(),
        sendAt: schedule ? new Date(schedule).toISOString() : now,
        createdAt: now,
      });
      setTitle('');
      setBody('');
      setSchedule('');
      await reload();
      toast.success(schedule ? t('Anuncio programado') : t('Anuncio enviado'));
    } catch (err) {
      toast.error(errMessage(err, t('No se pudo enviar el anuncio.')));
    } finally {
      setSending(false);
    }
  };

  if (!list) return <LoadingSkeleton variant="page" />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AppIcons.announce size={18} /> {t('Nuevo anuncio')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t('Título')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>{t('Mensaje')}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
          </div>
          <div>
            <Label>{t('Destinatarios')}</Label>
            <Select value={targetKind} onChange={(e) => setTargetKind(e.target.value as TargetKind)}>
              <option value="all">{t('Todos los usuarios')}</option>
              <option value="plan">{t('Por plan')}</option>
              <option value="status">{t('Por estado')}</option>
            </Select>
          </div>
          {targetKind === 'plan' && (
            <div>
              <Label>{t('Plan')}</Label>
              <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="free">Gratis</option>
                <option value="basic">Básico</option>
                <option value="pro">Pro</option>
                <option value="coop">Cooperativa</option>
              </Select>
            </div>
          )}
          {targetKind === 'status' && (
            <div>
              <Label>{t('Estado')}</Label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
              >
                <option value="trial">{t('Prueba')}</option>
                <option value="active">{t('Activo')}</option>
                <option value="overdue">{t('Vencido')}</option>
                <option value="cancelled">{t('Cancelado')}</option>
              </Select>
            </div>
          )}
          <div>
            <Label>{t('Programar (opcional)')}</Label>
            <Input
              type="datetime-local"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={send} disabled={sending || !title || !body}>
            {sending ? t('Enviando…') : schedule ? t('Programar anuncio') : t('Enviar ahora')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Historial de anuncios')}</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="py-8 text-center text-road-400">{t('Aún no hay anuncios')}</p>
          ) : (
            <ul className="space-y-3">
              {list.map((a) => {
                const scheduled = new Date(a.sendAt).getTime() > now;
                return (
                  <li key={a.id} className="rounded-lg border border-road-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{a.title}</p>
                      <span
                        className={
                          scheduled
                            ? 'shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900'
                            : 'shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800'
                        }
                      >
                        {scheduled ? t('Programado') : t('Enviado')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-road-600">{a.body}</p>
                    <p className="mt-2 text-xs text-road-400">
                      {describeTarget(a.target)} · {formatDate(new Date(a.sendAt))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
