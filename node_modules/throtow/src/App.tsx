// app/src/App.tsx
// CHANGE FROM YOUR ORIGINAL: Added /admin/login route + AdminLoginPage import
// Everything else is exactly the same as your original

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

// Landing Page
import LandingPage from '@/pages/LandingPage';

// ✅ NEW — Admin login page (separate from LandingPage)
import { AdminLoginPage } from '@/pages/AdminLoginPage';

// Dashboard Components (unchanged)
import { CustomerDashboard, CustomerRequests, CustomerPayments, CustomerSupport } from '@/pages/dashboards/CustomerDashboard';
import { DriverDashboard, DriverJobs, DriverMyJobs, DriverEarnings, DriverSupport } from '@/pages/dashboards/DriverDashboard';
import { MechanicDashboard, MechanicJobs, MechanicMyJobs, MechanicEarnings, MechanicSupport } from '@/pages/dashboards/MechanicDashboard';
import {
  AdminDashboard,
  AdminUsers,
  AdminRequests,
  AdminPayments,
  AdminAnalytics,
  AdminSettings
} from '@/pages/dashboards/AdminDashboard';

// ─── Protected Route (unchanged) ─────────────────────────────────────────────
function ProtectedRoute({
  children,
  allowedRoles
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    // ✅ Admin gets sent to their own login page, others to landing page
    if (allowedRoles.includes('admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user?.role || '')) {
    return <Navigate to={`/${user?.role}`} replace />;
  }

  return <>{children}</>;
}

// ─── Role redirect (unchanged) ───────────────────────────────────────────────
function RoleRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/${user?.role}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public Routes ── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LandingPage />} />
      <Route path="/register" element={<LandingPage />} />

      {/* ✅ NEW — Separate admin login page, not linked from anywhere */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* ── Customer Routes (unchanged) ── */}
      <Route path="/customer" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
      <Route path="/customer/requests" element={<ProtectedRoute allowedRoles={['customer']}><CustomerRequests /></ProtectedRoute>} />
      <Route path="/customer/payments" element={<ProtectedRoute allowedRoles={['customer']}><CustomerPayments /></ProtectedRoute>} />
      <Route path="/customer/support" element={<ProtectedRoute allowedRoles={['customer']}><CustomerSupport /></ProtectedRoute>} />

      {/* ── Driver Routes (unchanged) ── */}
      <Route path="/driver" element={<ProtectedRoute allowedRoles={['driver']}><DriverDashboard /></ProtectedRoute>} />
      <Route path="/driver/jobs" element={<ProtectedRoute allowedRoles={['driver']}><DriverJobs /></ProtectedRoute>} />
      <Route path="/driver/my-jobs" element={<ProtectedRoute allowedRoles={['driver']}><DriverMyJobs /></ProtectedRoute>} />
      <Route path="/driver/earnings" element={<ProtectedRoute allowedRoles={['driver']}><DriverEarnings /></ProtectedRoute>} />
      <Route path="/driver/support" element={<ProtectedRoute allowedRoles={['driver']}><DriverSupport /></ProtectedRoute>} />

      {/* ── Mechanic Routes (unchanged) ── */}
      <Route path="/mechanic" element={<ProtectedRoute allowedRoles={['mechanic']}><MechanicDashboard /></ProtectedRoute>} />
      <Route path="/mechanic/jobs" element={<ProtectedRoute allowedRoles={['mechanic']}><MechanicJobs /></ProtectedRoute>} />
      <Route path="/mechanic/my-jobs" element={<ProtectedRoute allowedRoles={['mechanic']}><MechanicMyJobs /></ProtectedRoute>} />
      <Route path="/mechanic/earnings" element={<ProtectedRoute allowedRoles={['mechanic']}><MechanicEarnings /></ProtectedRoute>} />
      <Route path="/mechanic/support" element={<ProtectedRoute allowedRoles={['mechanic']}><MechanicSupport /></ProtectedRoute>} />

      {/* ── Admin Routes ── */}
      {/* ✅ Admin routes now redirect to /admin/login if not authenticated */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/requests" element={<ProtectedRoute allowedRoles={['admin']}><AdminRequests /></ProtectedRoute>} />
      <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminPayments /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />

      {/* ── Redirects ── */}
      <Route path="/dashboard" element={<RoleRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
