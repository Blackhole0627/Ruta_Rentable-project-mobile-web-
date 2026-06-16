# RutaRentable

Calculadora de rentabilidad de viajes para conductores en Nicaragua (taxi, moto-taxi, InDrive, Uber, delivery).

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn-style UI
- **Estado:** Zustand
- **Almacenamiento V1:** IndexedDB (Dexie.js) — offline-first
- **Backend (Stage 2):** Supabase (PostgreSQL + Auth)
- **Mobile:** Capacitor v5 (PWA → Android APK)

## Repositorios

| Repo | Uso |
|------|-----|
| **RutaRentable** (este) | Monorepo completo (docs, supabase, apps/web) |
| **[RutaRentable-frontend](https://github.com/hassaankhalid225/RutaRentable-frontend)** | Solo frontend — **deploy en Vercel** |

> El frontend desplegable está en `d:\Website\RutaRentable-frontend` (repo independiente, raíz = Vite).

## Estructura

```
RutaRentable/
├── apps/web/          # App React (conductor PWA)
├── shared/            # Modelo financiero y tipos compartidos
└── supabase/          # Migraciones y seed (Stage 2)
```

## Inicio rápido

```bash
cd apps/web
npm install
npm run dev
```

O usa el repo frontend standalone:

```bash
cd ../RutaRentable-frontend
npm install
npm run dev
```

Abre http://localhost:5173

## Flujo V1

1. **Bienvenida** — onboarding (nombre, moneda, unidad de combustible)
2. **Mi vehículo** — catálogo NI (50 autos + 40 motos), costo por km
3. **Calcular** — semáforo de rentabilidad, tarifa mínima, guardar viaje
4. **Historial** — filtros y totales
5. **Reportes** — gráficos diarios/semanales/mensuales
6. **Ajustes** — combustible, umbrales, comisiones

## Stage 2 (v2) — cuentas, nube y panel admin

Stage 2 está implementado sobre la app local V1, **listo para funcionar sin
credenciales** gracias a un backend mock con datos de demostración.

- **Cuentas + OTP** — login por correo con código (`/entrar`), recuperación,
  cerrar sesión y eliminar cuenta (`/cuenta`).
- **Sincronización offline-first** — Dexie local ↔ nube con merge por
  `updatedAt` y cola de eliminaciones (`core/sync/syncEngine.ts`). Re-sincroniza
  al recuperar conexión.
- **Conductor S2** — múltiples vehículos con vehículo activo, editar/eliminar
  viajes, filtros por plataforma y rango de fechas, punto de equilibrio mensual.
- **Suscripciones** — límite gratuito (5 cálculos), planes Básico/Pro/Cooperativa,
  pago simulado e historial (`/suscripcion`).
- **Panel admin** (`/admin`, solo rol admin) — métricas de negocio, tabla de
  usuarios, planes/precios, parámetros globales, catálogo y anuncios.

### Backend: mock vs. Supabase real

El selector vive en `core/backend/` (`getBackend()`):

- **Sin credenciales** (placeholders en `.env`): usa el **mock** (Dexie
  `RutaRentableCloudDB`) con conductores, pagos y catálogo de demo. Ideal para
  desarrollo y demo.
- **Con credenciales reales** en `.env` (`VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`): usa `SupabaseBackend`. En el SQL Editor del
  proyecto Supabase nuevo, ejecuta **una sola vez**
  `supabase/migrations/001_full_setup.sql` y despliega las Edge Functions de
  `supabase/functions/`.

Define los correos admin con `VITE_ADMIN_EMAILS` (por defecto
`admin@rutarentable.com`). En el mock, cualquier código OTP funciona con el
valor mostrado en pantalla o el universal `000000`.

## Build producción

```bash
cd apps/web
npm run build
npm run preview
```

## Android (Capacitor)

```bash
cd apps/web
npm run build
npx cap add android
npx cap sync
npx cap open android
```

## Documentación

- `RutaRentable_Master_Prompt.md` — especificación técnica completa
- `requirement(yamamoto) (1).docx` — PRD funcional

<!-- Repo access verified by owner (Blackhole0627) - no app impact -->
