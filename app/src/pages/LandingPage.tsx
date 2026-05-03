import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Car, ShieldCheck, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

type RoleOption = 'customer' | 'driver' | 'mechanic';

const roleOptions: { value: RoleOption; label: string; description: string }[] = [
  {
    value: 'customer',
    label: 'Customer',
    description: 'Request towing, roadside help, and repairs from nearby providers.',
  },
  {
    value: 'driver',
    label: 'Driver',
    description: 'Accept towing and transport jobs and manage earnings from one dashboard.',
  },
  {
    value: 'mechanic',
    label: 'Mechanic',
    description: 'Receive repair requests, update availability, and support customers in real time.',
  },
];

const features = [
  {
    icon: Car,
    title: 'Fast roadside dispatch',
    description: 'Request towing and support from a live service network near your location.',
  },
  {
    icon: Wrench,
    title: 'Professional assistance',
    description: 'Connect with verified drivers and mechanics for on-demand help.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure account access',
    description: 'Sign in with your own credentials and manage requests from a protected dashboard.',
  },
];

const getDashboardPath = (role?: string) => {
  switch (role) {
    case 'driver':
      return '/driver';
    case 'mechanic':
      return '/mechanic';
    case 'admin':
      return '/admin';
    case 'customer':
    default:
      return '/customer';
  }
};

export function LandingPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, user } = useAuth();

  const [activePanel, setActivePanel] = useState<'login' | 'register'>('login');
  const [loginRole, setLoginRole] = useState<RoleOption>('customer');
  const [registerRole, setRegisterRole] = useState<RoleOption>('customer');

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDashboardPath(user?.role), { replace: true });
    }
  }, [isAuthenticated, navigate, user?.role]);

  const activeRoleCopy = useMemo(
    () => roleOptions.find((option) => option.value === (activePanel === 'login' ? loginRole : registerRole)),
    [activePanel, loginRole, registerRole],
  );

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      await login(loginForm.email.trim(), loginForm.password, loginRole);
      setFeedback({
        type: 'success',
        message: 'Signed in successfully. Redirecting to your dashboard...',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'We could not sign you in with those details. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (registerForm.password !== registerForm.confirmPassword) {
      setFeedback({
        type: 'error',
        message: 'Passwords do not match. Please confirm your password and try again.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await register({
        name: registerForm.name.trim(),
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim(),
        password: registerForm.password,
        role: registerRole,
      });

      setFeedback({
        type: 'success',
        message:
          'Your account has been created successfully. If email confirmation is enabled, please verify your inbox before signing in.',
      });

      setActivePanel('login');
      setLoginRole(registerRole);
      setLoginForm((current) => ({ ...current, email: registerForm.email.trim(), password: '' }));
      setRegisterForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'We could not create your account right now. Please review your details and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.15),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-sky-300">tHROTOW</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Roadside support made reliable</h1>
          </div>
          <Button
            variant="outline"
            className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
            onClick={() => setActivePanel((current) => (current === 'login' ? 'register' : 'login'))}
          >
            {activePanel === 'login' ? 'Create account' : 'Sign in'}
          </Button>
        </header>

        <main className="grid flex-1 gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-8">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-medium text-sky-200">
                Live dispatch for drivers, mechanics, and customers
              </span>
              <div className="space-y-4">
                <h2 className="max-w-2xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                  Request help, manage jobs, and keep every roadside response in one place.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  Use your secure account to request service, track response progress, and handle
                  payments without relying on demo credentials or placeholder workflows.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <Card
                    key={feature.title}
                    className="border-white/10 bg-white/5 text-slate-50 backdrop-blur"
                  >
                    <CardHeader>
                      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                      <CardDescription className="text-slate-300">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <Card className="border-white/10 bg-slate-900/80 text-slate-50 shadow-2xl shadow-slate-950/40 backdrop-blur">
              <CardHeader className="space-y-4">
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setActivePanel('login')}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activePanel === 'login'
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePanel('register')}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activePanel === 'register'
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Register
                  </button>
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    {activePanel === 'login' ? 'Welcome back' : 'Create your account'}
                  </CardTitle>
                  <CardDescription className="mt-2 text-slate-300">
                    {activeRoleCopy?.description}
                  </CardDescription>
                </div>
                {feedback ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      feedback.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                    }`}
                  >
                    {feedback.message}
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(activePanel === 'login' ? roleOptions : roleOptions).map((role) => {
                    const selected =
                      activePanel === 'login'
                        ? loginRole === role.value
                        : registerRole === role.value;

                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() =>
                          activePanel === 'login'
                            ? setLoginRole(role.value)
                            : setRegisterRole(role.value)
                        }
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? 'border-sky-400/50 bg-sky-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <p className="font-medium">{role.label}</p>
                        <p className="mt-1 text-xs text-slate-400">{role.description}</p>
                      </button>
                    );
                  })}
                </div>

                {activePanel === 'login' ? (
                  <form className="space-y-5" onSubmit={handleLogin}>
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email address</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="name@example.com"
                        value={loginForm.email}
                        onChange={(event) =>
                          setLoginForm((current) => ({ ...current, email: event.target.value }))
                        }
                        required
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(event) =>
                          setLoginForm((current) => ({ ...current, password: event.target.value }))
                        }
                        required
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-sky-500 text-white hover:bg-sky-400"
                      disabled={submitting}
                    >
                      {submitting ? 'Signing in...' : 'Sign in'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <form className="space-y-5" onSubmit={handleRegister}>
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full name</Label>
                      <Input
                        id="register-name"
                        placeholder="Enter your full name"
                        value={registerForm.name}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, name: event.target.value }))
                        }
                        required
                        className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="register-email">Email address</Label>
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="name@example.com"
                          value={registerForm.email}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          required
                          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-phone">Phone number</Label>
                        <Input
                          id="register-phone"
                          type="tel"
                          placeholder="+2547..."
                          value={registerForm.phone}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          required
                          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="register-password">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Create a secure password"
                          value={registerForm.password}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          required
                          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-confirm-password">Confirm password</Label>
                        <Input
                          id="register-confirm-password"
                          type="password"
                          placeholder="Repeat your password"
                          value={registerForm.confirmPassword}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              confirmPassword: event.target.value,
                            }))
                          }
                          required
                          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
                      disabled={submitting}
                    >
                      {submitting ? 'Creating account...' : 'Create account'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
export default LandingPage; 