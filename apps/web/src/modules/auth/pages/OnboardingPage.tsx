import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useUserStore } from '@/core/store/useUserStore';
import type { Currency, FuelUnit } from '@shared/types/user.types';
import { AppIcons, iconPropsLg } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

const slides = [
  {
    icon: AppIcons.onboarding.route,
    title: '¿Cuánto ganas de verdad?',
    text: 'Calcula si un viaje es rentable antes de aceptarlo, incluyendo combustible, llantas, mantenimiento y más.',
  },
  {
    icon: AppIcons.onboarding.trend,
    title: 'Decide con datos',
    text: 'Semáforo claro: rentable, aceptable o no rentable. Sabrás el precio mínimo que debes cobrar.',
  },
  {
    icon: AppIcons.onboarding.shield,
    title: 'Tus datos, tu teléfono',
    text: 'Funciona sin internet. Todo se guarda en tu dispositivo de forma privada.',
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { setUser, completeOnboarding } = useUserStore();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('NIO');
  const [fuelUnit, setFuelUnit] = useState<FuelUnit>('liter');

  const isSetup = step >= slides.length;

  const handleFinish = async () => {
    if (!name.trim()) return;
    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      currency,
      fuelUnit,
      onboardingComplete: true,
      registeredAt: new Date(),
    };
    await setUser(user);
    await completeOnboarding();
    navigate('/');
  };

  if (isSetup) {
    return (
      <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-road-900 px-4 py-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative mx-auto mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-grad shadow-brand">
            <AppIcons.calculator size={19} className="text-white" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-white">
            Ruta<span className="text-brand-400">Rentable</span>
          </span>
        </div>
        <Card className="relative">
          <CardHeader>
            <CardTitle>{t('Configura tu perfil')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">{t('Tu nombre')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Juan"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('Moneda')}</Label>
              <div className="mt-2 flex gap-2">
                {(['NIO', 'USD'] as Currency[]).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={currency === c ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setCurrency(c)}
                  >
                    {c === 'NIO' ? t('Córdobas (C$)') : t('Dólares (US$)')}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t('Unidad de combustible')}</Label>
              <div className="mt-2 flex gap-2">
                {(['liter', 'gallon'] as FuelUnit[]).map((u) => (
                  <Button
                    key={u}
                    type="button"
                    variant={fuelUnit === u ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setFuelUnit(u)}
                  >
                    {u === 'liter' ? t('Litro') : t('Galón')}
                  </Button>
                ))}
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={handleFinish} disabled={!name.trim()}>
              {t('Empezar')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slide = slides[step];
  const Icon = slide.icon;

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-road-900 px-6 py-8 text-white">
      {/* Ambient emerald glow for depth. */}
      <div className="pointer-events-none absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-brand-700/20 blur-3xl" />

      <div className="relative flex justify-center pt-2">
        <button
          type="button"
          onClick={() => setStep(slides.length)}
          className="text-sm font-medium text-road-400 hover:text-white"
        >
          {t('Saltar')}
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-grad shadow-brand-lg ring-1 ring-white/10">
          <Icon {...iconPropsLg} className="text-white" style={{ width: 38, height: 38 }} />
        </span>
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">
          {t(slide.title)}
        </h1>
        <p className="mt-3 max-w-sm leading-relaxed text-road-300">{t(slide.text)}</p>
      </div>
      <div className="relative space-y-4">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-brand-400' : 'w-1.5 bg-road-600'}`}
            />
          ))}
        </div>
        <Button className="w-full" size="lg" onClick={() => setStep((s) => s + 1)}>
          {step < slides.length - 1 ? t('Siguiente') : t('Configurar')}
        </Button>
      </div>
    </div>
  );
}
