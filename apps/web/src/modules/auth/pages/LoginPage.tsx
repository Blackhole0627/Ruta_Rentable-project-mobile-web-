import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useAuthStore } from '@/core/store/useAuthStore';
import { AppIcons, iconPropsLg } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

type Mode = 'otp' | 'password' | 'signup';
type Step = 'email' | 'code';

export function LoginPage() {
  const navigate = useNavigate();
  const {
    requestOtp,
    verifyOtp,
    signInWithPassword,
    signUp,
    loginWithGoogle,
    isWorking,
    devCode,
    error,
    clearError,
  } = useAuthStore();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('password');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const gotoHome = () => {
    const role = useAuthStore.getState().session?.user.role;
    navigate(role === 'admin' ? '/admin' : '/', { replace: true });
  };

  const handleSendCode = async () => {
    clearError();
    if (!email.includes('@')) return;
    await requestOtp(email);
    if (!useAuthStore.getState().error) setStep('code');
  };

  const handleVerify = async () => {
    clearError();
    if (await verifyOtp(email, code.trim())) gotoHome();
  };

  const handlePasswordLogin = async () => {
    clearError();
    if (await signInWithPassword(email, password)) gotoHome();
  };

  const handleGoogle = async () => {
    clearError();
    // Mock returns true (immediate); real backend redirects to Google.
    if (await loginWithGoogle()) gotoHome();
  };

  const passwordsMatch = password === confirmPassword;
  const canSignUp =
    !!name.trim() && email.includes('@') && password.length >= 6 && passwordsMatch;

  const handleSignUp = async () => {
    clearError();
    if (!canSignUp) return;
    const result = await signUp(name, email, password);
    if (result === 'done') gotoHome();
    else if (result === 'otp') {
      // Email confirmation required — verify the code sent to the inbox.
      setMode('otp');
      setStep('code');
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep('email');
    setCode('');
    setPassword('');
    setConfirmPassword('');
    clearError();
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-road-900 px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-white">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500">
          <AppIcons.calculator {...iconPropsLg} className="text-white" />
        </span>
        <h1 className="mt-3 text-2xl font-bold">RutaRentable</h1>
        <p className="text-sm text-road-300">{t('Inicia sesión para sincronizar tus datos')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === 'signup'
              ? t('Crear cuenta')
              : mode === 'password'
                ? t('Entrar con contraseña')
                : step === 'email'
                  ? t('Entrar con tu correo')
                  : t('Verifica tu código')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'password' ? (
            <>
              <div>
                <Label htmlFor="email">{t('Correo electrónico')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">{t('Contraseña')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePasswordLogin}
                disabled={isWorking || !email.includes('@') || password.length < 6}
              >
                <AppIcons.lock size={18} />
                {isWorking ? t('Entrando…') : t('Iniciar sesión')}
              </Button>
              <button
                type="button"
                className="w-full text-sm font-medium text-brand-600 underline"
                onClick={() => switchMode('signup')}
              >
                {t('¿No tienes cuenta? Crear cuenta')}
              </button>
            </>
          ) : mode === 'signup' ? (
            <>
              <div>
                <Label htmlFor="name">{t('Nombre')}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('Tu nombre')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">{t('Correo electrónico')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">{t('Contraseña')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm">{t('Confirmar contraseña')}</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1 text-xs text-danger-500">
                    {t('Las contraseñas no coinciden.')}
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleSignUp}
                disabled={isWorking || !canSignUp}
              >
                <AppIcons.account size={18} />
                {isWorking ? t('Creando…') : t('Crear cuenta')}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-road-500 underline"
                onClick={() => switchMode('password')}
              >
                {t('Ya tengo cuenta')}
              </button>
            </>
          ) : step === 'email' ? (
            <>
              <div>
                <Label htmlFor="email">{t('Correo electrónico')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="mt-1"
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleSendCode}
                disabled={isWorking || !email.includes('@')}
              >
                <AppIcons.mail size={18} />
                {isWorking ? t('Enviando…') : t('Enviar código')}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-road-500 underline"
                onClick={() => switchMode('password')}
              >
                {t('Entrar con contraseña')}
              </button>
              <button
                type="button"
                className="w-full text-sm font-medium text-brand-600 underline"
                onClick={() => switchMode('signup')}
              >
                {t('¿No tienes cuenta? Crear cuenta')}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-road-600">
                {t('Enviamos un código a {email}. Revisa tu correo (y la carpeta de spam).', {
                  email,
                })}
              </p>
              {devCode && (
                <div className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
                  {t('Código')}: <strong className="tracking-widest">{devCode}</strong>
                </div>
              )}
              <div>
                <Label htmlFor="code">{t('Código')}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('Código de tu correo')}
                  className="mt-1 text-center text-2xl tracking-[0.35em]"
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleVerify}
                disabled={isWorking || code.length < 6}
              >
                {isWorking ? t('Verificando…') : t('Verificar e iniciar sesión')}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-road-500 underline"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  clearError();
                }}
              >
                {t('Usar otro correo')}
              </button>
            </>
          )}

          <div className="flex items-center gap-2 text-xs text-road-400">
            <span className="h-px flex-1 bg-road-200" />
            o
            <span className="h-px flex-1 bg-road-200" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isWorking}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-road-300 bg-white px-4 text-sm font-medium text-road-700 hover:bg-road-50 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.2-5.6l-6.6-5.4C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.4C40.9 36.7 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"/>
            </svg>
            {t('Continuar con Google')}
          </button>

          {error && <p className="text-sm text-danger-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
