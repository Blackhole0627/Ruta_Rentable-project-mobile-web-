import { NavLink } from 'react-router-dom';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const items: NavItem[] = [
  { to: '/admin', label: 'Panel', icon: AppIcons.dashboard, end: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: AppIcons.users },
  { to: '/admin/planes', label: 'Planes', icon: AppIcons.billing },
  { to: '/admin/pagos', label: 'Pagos', icon: AppIcons.crown },
  { to: '/admin/parametros', label: 'Parámetros', icon: AppIcons.settings },
  { to: '/admin/catalogo', label: 'Catálogo', icon: AppIcons.catalog },
  { to: '/admin/anuncios', label: 'Anuncios', icon: AppIcons.announce },
];

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-brand-500 text-white'
                : 'text-road-300 hover:bg-road-800 hover:text-white',
            )
          }
        >
          <Icon size={20} strokeWidth={1.75} />
          {!collapsed && <span>{t(label)}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
