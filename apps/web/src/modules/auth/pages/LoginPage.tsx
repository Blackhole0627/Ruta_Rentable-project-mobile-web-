import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useAuthStore } from '@/core/store/useAuthStore';
import { toast } from '@/core/store/useToastStore';
import { AppIcons, iconPropsLg } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

type Mode = 'password' | 'signup' | 'otp' | 'recover';
type Step = 'form' | 'code';

const RESEND_COOLDOWN = 30;

export function LoginPage() {
  const navigate = useNavigate();
  const {
    requestOtp,
    verifyOtp,
    signInWithPassword,
    signUp,
    resendVerification,
    updatePassword,
    recover,
    loginWithGoogle,
    isWorking,
    isMock,
    devCode,
    error,
    clearError,
  } = useAuthStore();
  const { t } = useI18n();

  const [mode, setMode] = useState<Mode>('password');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Tick down the resend cooldown once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const gotoHome = () => {
    const role = useAuthStore.getState().session?.user.role;
    navigate(role === 'admin' ? '/admin' : '/', { replace: true });
  };

  const startCooldown = () => setCooldown(RESEND_COOLDOWN);

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep('form');
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setCooldown(0);
    clearError();
  };

  const goToCode = () => {
    setCode('');
    setStep('code');
    startCooldown();
  };

  // ---- Form-step handlers ----
  const handlePasswordLogin = async () => {
    clearError();
    if (await signInWithPassword(email, password)) {
      toast.success(t('¡Bienvenido de nuevo!'));
      gotoHome();
    }
  };

  const passwordsMatch = password === confirmPassword;
  const canSignUp =
    !!name.trim() && email.includes('@') && password.length >= 6 && passwordsMatch;

  const handleSignUp = async () => {
    clearError();
    if (!canSignUp) return;
    const result = await signUp(name, email, password);
    if (result === 'done') {
      toast.success(t('¡Cuenta creada!'));
      gotoHome();
    } else if (result === 'otp') {
      toast.info(t('Te enviamos un código a tu correo.'));
      goToCode();
    }
  };

  const handleSendOtp = async () => {
    clearError();
    if (!email.includes('@')) return;
    await requestOtp(email);
    if (!useAuthStore.getState().error) goToCode();
  };

  const handleSendRecover = async () => {
    clearError();
    if (!email.includes('@')) return;
    await recover(email);
    if (!useAuthStore.getState().error) {
      toast.info(t('Te enviamos un código para restablecer tu contraseña.'));
      goToCode();
    }
  };

  // ---- Code-step handlers ----
  const purpose = mode === 'signup' ? 'signup' : mode === 'recover' ? 'recovery' : 'login';
  const isRecover = mode === 'recover';
  const canVerify =
    code.length >= 6 &&
    (!isRecover || (password.length >= 6 && passwordsMatch));

  const handleVerify = async () => {
    clearError();
    if (!canVerify) return;
    const ok = await verifyOtp(email, code.trim(), purpose);
    if (!ok) return;
    if (isRecover) {
      const updated = await updatePassword(password);
      if (!updated) return;
      toast.success(t('Contraseña actualizada.'));
    } else if (mode === 'signup') {
      toast.success(t('¡Correo verificado! Tu cuenta está lista.'));
    } else {
      toast.success(t('¡Bienvenido!'));
    }
    gotoHome();
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    clearError();
    const ok =
      mode === 'signup'
        ? await resendVerification(email)
        : mode === 'recover'
          ? (await recover(email), !useAuthStore.getState().error)
          : (await requestOtp(email), !useAuthStore.getState().error);
    if (ok) {
      toast.info(t('Código reenviado.'));
      startCooldown();
    }
  };

  const codeTitle =
    mode === 'signup'
      ? t('Verifica tu correo')
      : mode === 'recover'
        ? t('Restablece tu contraseña')
        : t('Verifica tu código');

  const formTitle =
    mode === 'signup'
      ? t('Crear cuenta')
      : mode === 'recover'
        ? t('Recuperar contraseña')
        : mode === 'otp'
          ? t('Entrar con tu correo')
          : t('Entrar con contraseña');

  return (
    <div className="flex min-h-screen flex-col justify-center bg-road-900 px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-white">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30">
          <AppIcons.calculator {...iconPropsLg} className="text-white" />
        </span>
        <h1 className="mt-3 text-2xl font-bold">RutaRentable</h1>
        <p className="text-sm text-road-300">{t('Inicia sesión para sincronizar tus datos')}</p>
      </div>

      <Card className="animate-slide-up-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {step === 'code' && (
              <button
                type="button"
                aria-label={t('Volver')}
                onClick={() => {
                  setStep('form');
                  setCode('');
                  clearError();
                }}
                className="-ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-road-500 hover:bg-road-100"
              >
                <AppIcons.back size={18} />
              </button>
            )}
            {step === 'code' ? codeTitle : formTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ----------------- CODE STEP (shared) ----------------- */}
          {step === 'code' ? (
            <>
              <p className="flex flex-wrap items-center gap-1 text-sm text-road-600">
                <AppIcons.mailCheck size={16} className="text-brand-600" />
                {t('Enviamos un código a')} <strong className="break-all">{email}</strong>
              </p>

              {(devCode || isMock) && (
                <div className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
                  {devCode ? (
                    <>
                      {t('Código')}: <strong className="tracking-widest">{devCode}</strong>
                    </>
                  ) : (
                    t('Modo demo: usa el código 000000')
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="code">{t('Código de 6 dígitos')}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="mt-1 text-center text-2xl tracking-[0.4em]"
                />
              </div>

              {isRecover && (
                <>
                  <div>
                    <Label htmlFor="newpw">{t('Nueva contraseña')}</Label>
                    <PasswordInput
                      id="newpw"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      showStrength
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmnew">{t('Confirmar contraseña')}</Label>
                    <PasswordInput
                      id="confirmnew"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    />
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <p className="mt-1 text-xs text-danger-500">
                        {t('Las contraseñas no coinciden.')}
                      </p>
                    )}
                  </div>
                </>
              )}

              <Button
                className="w-full press"
                size="lg"
                onClick={handleVerify}
                disabled={isWorking || !canVerify}
              >
                {isWorking ? (
                  <AppIcons.spinner size={18} className="animate-spin" />
                ) : (
                  <AppIcons.check size={18} />
                )}
                {isWorking
                  ? t('Verificando…')
                  : isRecover
                    ? t('Guardar contraseña')
                    : t('Verificar')}
              </Button>

              <button
                type="button"
                disabled={cooldown > 0 || isWorking}
                onClick={handleResend}
                className="w-full text-sm font-medium text-brand-600 underline disabled:text-road-400 disabled:no-underline"
              >
                {cooldown > 0
                  ? t('Reenviar código en {s}s', { s: cooldown })
                  : t('Reenviar código')}
              </button>
            </>
          ) : mode === 'password' ? (
            /* ----------------- PASSWORD LOGIN ----------------- */
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('Contraseña')}</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={() => switchMode('recover')}
                  >
                    {t('¿Olvidaste tu contraseña?')}
                  </button>
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                />
              </div>
              <Button
                className="w-full press"
                size="lg"
                onClick={handlePasswordLogin}
                disabled={isWorking || !email.includes('@') || password.length < 6}
              >
                {isWorking ? (
                  <AppIcons.spinner size={18} className="animate-spin" />
                ) : (
                  <AppIcons.lock size={18} />
                )}
                {isWorking ? t('Entrando…') : t('Iniciar sesión')}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-road-500 underline"
                onClick={() => switchMode('otp')}
              >
                {t('Entrar con un código por correo')}
              </button>
              <button
                type="button"
                className="w-full text-sm font-medium text-brand-600 underline"
                onClick={() => switchMode('signup')}
              >
                {t('¿No tienes cuenta? Crear cuenta')}
              </button>
            </>
          ) : mode === 'signup' ? (
            /* ----------------- SIGN UP ----------------- */
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
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                  showStrength
                />
              </div>
              <div>
                <Label htmlFor="confirm">{t('Confirmar contraseña')}</Label>
                <PasswordInput
                  id="confirm"
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
                className="w-full press"
                size="lg"
                onClick={handleSignUp}
                disabled={isWorking || !canSignUp}
              >
                {isWorking ? (
                  <AppIcons.spinner size={18} className="animate-spin" />
                ) : (
                  <AppIcons.account size={18} />
                )}
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
          ) : mode === 'recover' ? (
            /* ----------------- RECOVER (email step) ----------------- */
            <>
              <p className="text-sm text-road-600">
                {t('Escribe tu correo y te enviaremos un código para crear una nueva contraseña.')}
              </p>
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
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRecover()}
                />
              </div>
              <Button
                className="w-full press"
                size="lg"
                onClick={handleSendRecover}
                disabled={isWorking || !email.includes('@')}
              >
                {isWorking ? (
                  <AppIcons.spinner size={18} className="animate-spin" />
                ) : (
                  <AppIcons.key size={18} />
                )}
                {isWorking ? t('Enviando…') : t('Enviar código')}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-road-500 underline"
                onClick={() => switchMode('password')}
              >
                {t('Volver a iniciar sesión')}
              </button>
            </>
          ) : (
            /* ----------------- OTP LOGIN (email step) ----------------- */
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
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                />
              </div>
              <Button
                className="w-full press"
                size="lg"
                onClick={handleSendOtp}
                disabled={isWorking || !email.includes('@')}
              >
                {isWorking ? (
                  <AppIcons.spinner size={18} className="animate-spin" />
                ) : (
                  <AppIcons.mail size={18} />
                )}
                {isWorking ? t('Enviando…') : t('Enviar código')}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-road-500 underline"
                onClick={() => switchMode('password')}
              >
                {t('Entrar con contraseña')}
              </button>
            </>
          )}

          {/* ----------------- Google (hidden on code step) ----------------- */}
          {step === 'form' && (
            <>
              <div className="flex items-center gap-2 text-xs text-road-400">
                <span className="h-px flex-1 bg-road-200" />
                o
                <span className="h-px flex-1 bg-road-200" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  clearError();
                  if (await loginWithGoogle()) gotoHome();
                }}
                disabled={isWorking}
                className="press flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-road-300 bg-white px-4 text-sm font-medium text-road-700 hover:bg-road-50 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.2-5.6l-6.6-5.4C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.4C40.9 36.7 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
                </svg>
                {t('Continuar con Google')}
              </button>
            </>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-danger-500">
              <AppIcons.alert size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
