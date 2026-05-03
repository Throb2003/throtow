// app/src/pages/AdminLoginPage.tsx
// Accessible at: /admin/login
// Completely separate from the main landing page
// No links to this page exist anywhere on the public site

import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // If already logged in as admin, go straight to dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
    // If logged in but NOT admin, kick them out to home
    if (isAuthenticated && user?.role !== 'admin') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password, 'admin');
      // useEffect above handles the redirect
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020408',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          zIndex: 0,
        }}
      />

      {/* Amber glow top */}
      <div
        style={{
          position: 'absolute',
          top: '-200px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* Shield icon */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
              border: '1px solid rgba(245,158,11,0.25)',
              marginBottom: '20px',
            }}
          >
            <ShieldCheck size={28} color="#f59e0b" />
          </div>

          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.35em',
              color: '#f59e0b',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            ThroTow
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#f8fafc',
              margin: '0 0 8px',
              letterSpacing: '-0.5px',
            }}
          >
            Admin Portal
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Restricted access. Authorised personnel only.
          </p>
        </div>

        {/* Login card */}
        <div
          style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            padding: '32px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Error banner */}
          {error && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '20px',
              }}
            >
              <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '13px', color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={(e) => { void handleSubmit(e); }}>
            {/* Email field */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="admin-email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#94a3b8',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  color="#475569"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@throtow.com"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 40px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: '#f1f5f9',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.4)';
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="admin-password"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#94a3b8',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  color="#475569"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 40px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: '#f1f5f9',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.4)';
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%',
                padding: '12px',
                background:
                  loading || !email || !password
                    ? 'rgba(245,158,11,0.3)'
                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                color: loading || !email || !password ? '#78350f' : '#0f172a',
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Signing in...' : 'Access Admin Dashboard'}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#334155',
            marginTop: '24px',
          }}
        >
          This page is not linked from the public site.
          <br />
          Unauthorised access attempts are logged.
        </p>
      </div>
    </div>
  );
}

export default AdminLoginPage;