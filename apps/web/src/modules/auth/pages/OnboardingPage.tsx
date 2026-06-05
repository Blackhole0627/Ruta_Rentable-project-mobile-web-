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
      <div className="flex min-h-screen flex-col justify-center bg-road-900 px-4 py-8">
        <Card>
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
    <div className="flex min-h-screen flex-col justify-between bg-road-900 px-6 py-12 text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Icon {...iconPropsLg} className="mb-6 h-16 w-16 text-brand-500" style={{ width: 64, height: 64 }} />
        <h1 className="text-2xl font-bold">{t(slide.title)}</h1>
        <p className="mt-4 max-w-sm text-road-300">{t(slide.text)}</p>
      </div>
      <div className="space-y-4">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${i === step ? 'bg-brand-500' : 'bg-road-600'}`}
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
