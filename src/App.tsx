/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { UserRole } from './types';
import Layout from './Layout';
import { motion } from 'motion/react';

// Pages
import Home from './pages/Home';
import DriverDashboard from './pages/DriverDashboard';
import AdminPanel from './pages/AdminPanel';
import Profile from './pages/Profile';
import RideDetails from './pages/RideDetails';
import Onboarding from './pages/Onboarding';
import DriverOnboarding from './pages/DriverOnboarding';
import AdminLogin from './pages/AdminLogin';
import LoginPage from './pages/LoginPage';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

// Full screen loading indicator
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 bg-brand-600 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-600/30">
          <span className="text-white font-black text-2xl tracking-tighter">CL</span>
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          Loading ChaLo...
        </span>
      </motion.div>
    </div>
  );
}

/**
 * 1. USER PANEL ROUTE GUARD:
 * Allows ONLY authenticated accounts with role === USER (passengers).
 * Drivers are redirected to /dashboard.
 * Admins are redirected to /admin.
 */
function UserRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login?tab=user" replace />;

  if (profile) {
    if (profile.role === UserRole.DRIVER) {
      return <Navigate to="/dashboard" replace />;
    }
    if (profile.role === UserRole.ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    if (!profile.onboardingComplete) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <Layout>{children}</Layout>;
}

/**
 * 2. DRIVER PANEL ROUTE GUARD:
 * Allows ONLY verified, authorized accounts with role === DRIVER.
 * Regular users are redirected to / (user panel).
 * Admins are redirected to /admin.
 */
function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login?tab=driver" replace />;

  if (profile) {
    if (profile.role === UserRole.ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    if (profile.role !== UserRole.DRIVER) {
      return <Navigate to="/" replace />;
    }
    if (!profile.driverOnboardingComplete) {
      return <Navigate to="/driver-onboarding" replace />;
    }
  }

  return <Layout>{children}</Layout>;
}

/**
 * 3. ADMIN PANEL ROUTE GUARD:
 * Allows ONLY authenticated administrators with role === ADMIN.
 * Regular users are redirected to / (user panel).
 * Drivers are redirected to /dashboard.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/admin-login" replace />;

  if (profile) {
    if (profile.role === UserRole.DRIVER) {
      return <Navigate to="/dashboard" replace />;
    }
    if (profile.role !== UserRole.ADMIN) {
      return <Navigate to="/" replace />;
    }
  }

  return <Layout>{children}</Layout>;
}

/**
 * 4. SHARED AUTHENTICATED ROUTE:
 * Accessible to any logged in user regardless of role (Profile, Ride monitoring).
 */
function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public & Authentication Gateways */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/user-login" element={<Navigate to="/login?tab=user" replace />} />
          <Route path="/driver-login" element={<Navigate to="/login?tab=driver" replace />} />
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* Onboarding */}
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/driver-onboarding" element={<DriverOnboarding />} />

          {/* 1. User Panel */}
          <Route
            path="/"
            element={
              <UserRoute>
                <Home />
              </UserRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <UserRoute>
                <Home initialTab="bookings" />
              </UserRoute>
            }
          />

          {/* 2. Driver Panel */}
          <Route
            path="/dashboard"
            element={
              <DriverRoute>
                <DriverDashboard />
              </DriverRoute>
            }
          />

          {/* 3. Admin Panel */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            }
          />

          {/* Shared Authenticated Pages */}
          <Route
            path="/profile"
            element={
              <AuthenticatedRoute>
                <Profile />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/ride/:rideId"
            element={
              <AuthenticatedRoute>
                <RideDetails />
              </AuthenticatedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
