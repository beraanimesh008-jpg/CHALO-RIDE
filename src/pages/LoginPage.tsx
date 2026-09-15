/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { motion } from 'motion/react';
import {
  Users,
  Bike,
  ShieldCheck,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';

function getAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains). Please add this domain to continue.\nএই ডোমেনটি Firebase-এর Authorized domains তালিকায় অনুমোদিত নয়।';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is not enabled in Firebase Console (Authentication > Sign-in method).\nFirebase-এ Google Sign-In চালু করা নেই।';
  }
  if (code === 'auth/popup-blocked') {
    return 'Google login popup was blocked by your browser. Please allow popups and try again.\nব্রাউজারে Google Login পপআপ ব্লক করা হয়েছে। পপআপ অনুমোদন করে আবার চেষ্টা করুন।';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection failed. Please check your internet connection and try again.\nনেটওয়ার্ক সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন।';
  }
  if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
    return 'Google login popup was closed. Please try again.\nলগইন উইন্ডো বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }
  return err?.message || 'Google sign-in failed. Please try again.\nগুগল লগইন ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    loading: authLoading,
    loginUserWithGoogle,
    loginDriverWithGoogle,
    loginAdminWithCredentials
  } = useAuth();

  // Separate loading & error states for each section
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);

  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // If already authenticated with a verified role, redirect directly to their panel
  if (user && profile && !authLoading) {
    if (profile.role === UserRole.ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    if (profile.role === UserRole.DRIVER) {
      return <Navigate to="/dashboard" replace />;
    }
    if (!profile.onboardingComplete || !profile.phoneNumber) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // 1. User Login Handler
  const handleUserGoogleLogin = async () => {
    if (userLoading) return;
    setUserError(null);
    setUserLoading(true);
    try {
      const userProfile = await loginUserWithGoogle();
      if (!userProfile.onboardingComplete || !userProfile.phoneNumber) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('User login error:', err);
      if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
        setUserError('Google login was cancelled. / গুগল লগইন বাতিল করা হয়েছে।');
      } else {
        setUserError(getAuthErrorMessage(err));
      }
    } finally {
      setUserLoading(false);
    }
  };

  // 2. Driver Login Handler
  const handleDriverGoogleLogin = async () => {
    if (driverLoading) return;
    setDriverError(null);
    setDriverLoading(true);
    try {
      await loginDriverWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Driver login error:', err);
      if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
        setDriverError('Google login was cancelled. / গুগল লগইন বাতিল করা হয়েছে।');
      } else {
        setDriverError(getAuthErrorMessage(err));
      }
    } finally {
      setDriverLoading(false);
    }
  };

  // 3. Admin Login Handler
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLoading) return;
    setAdminError(null);

    if (!adminId.trim() || !adminPassword.trim()) {
      setAdminError('Please enter both Admin ID/Email and Password.\nAdmin ID এবং Password প্রদান করুন।');
      return;
    }

    setAdminLoading(true);
    try {
      await loginAdminWithCredentials(adminId.trim(), adminPassword);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      console.error('Admin authentication error:', err);
      setAdminError('Invalid Admin ID or Password.\nভুল Admin ID অথবা Password।');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background ambient lighting glows */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Page Brand Header */}
      <div className="text-center max-w-2xl mx-auto mb-10 z-10">
        <div className="inline-flex p-4 bg-brand-600 rounded-[2rem] shadow-2xl shadow-brand-600/30 mb-4 transform -rotate-2 hover:rotate-0 transition-transform">
          <Bike className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none">
          ChaLo <span className="text-brand-500">চলো</span>
        </h1>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
          Pathar Pratima • Local Rural Bike Taxi Network
        </p>
        <p className="text-slate-300 text-xs sm:text-sm font-medium mt-1">
          সুন্দরবন টোটো ও বাইক ট্যাক্সি পরিষেবা
        </p>
      </div>

      {/* 3 SEPARATE SECTIONS ON THE SAME LINE / ROW */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 z-10 items-stretch">
        
        {/* =========================================================================
            SECTION 1: USER PANEL (ইউজার প্যানেল)
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-[2.5rem] p-7 sm:p-8 shadow-2xl border border-slate-100 flex flex-col justify-between relative group hover:shadow-brand-500/10 hover:border-brand-100 transition-all"
        >
          <div>
            {/* Top Icon Badge */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Bike className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Brand Title */}
            <div className="text-center mb-5">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                ChaLo <span className="text-brand-600">চলো</span>
              </h2>
              <p className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest mt-1">
                PATHAR PRATIMA • LOCAL BIKE TAXI
              </p>
            </div>

            {/* Panel Pill Badge */}
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black uppercase tracking-wider border border-emerald-100">
                <Users className="w-3.5 h-3.5" />
                USER PANEL / ইউজার প্যানেল
              </div>
            </div>

            {/* Section Heading & Description */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-black text-slate-900">Passenger Login</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Book bike rides, negotiate fares, and track drivers in real time across Pathar Pratima.
              </p>
            </div>

            {/* Error Notification */}
            {userError && (
              <div className="p-3.5 mb-5 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-start gap-2.5 whitespace-pre-line leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{userError}</div>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleUserGoogleLogin}
              disabled={userLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {userLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0"
                  />
                  <span className="text-[11px] leading-tight text-center">
                    CONTINUE WITH GOOGLE / গুগুল দিয়ে চালিয়ে যান
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Bottom Info Boxes */}
          <div className="pt-6 mt-6 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Fare System</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">Fair Distance Rules</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Service Zone</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">Pathar Pratima & Islands</div>
            </div>
          </div>
        </motion.div>

        {/* =========================================================================
            SECTION 2: DRIVER PANEL (ড্রাইভার প্যানেল)
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-[2.5rem] p-7 sm:p-8 shadow-2xl border border-slate-100 flex flex-col justify-between relative group hover:shadow-accent-500/10 hover:border-amber-100 transition-all"
        >
          <div>
            {/* Top Icon Badge */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Bike className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Brand Title */}
            <div className="text-center mb-5">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                ChaLo <span className="text-amber-500">চলো</span>
              </h2>
              <p className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest mt-1">
                PATHAR PRATIMA • LOCAL BIKE TAXI
              </p>
            </div>

            {/* Panel Pill Badge */}
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 text-amber-800 rounded-full text-[11px] font-black uppercase tracking-wider border border-amber-200">
                <Bike className="w-3.5 h-3.5" />
                DRIVER PANEL / ড্রাইভার প্যানেল
              </div>
            </div>

            {/* Section Heading & Description */}
            <div className="text-center mb-4">
              <h3 className="text-xl font-black text-slate-900">Driver Login</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Receive live trip alerts, accept counter bids, and view your 10% commission wallet.
              </p>
            </div>

            {/* Authorized Drivers Notice */}
            <div className="p-3 mb-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 mb-0.5 text-amber-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Authorized Drivers Only • অনুমোদিত চালক
              </div>
              Sign in with your registered Google email authorized by ChaLo admin.
            </div>

            {/* Error Notification */}
            {driverError && (
              <div className="p-3.5 mb-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-start gap-2.5 whitespace-pre-line leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{driverError}</div>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleDriverGoogleLogin}
              disabled={driverLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {driverLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Verifying Driver Authorization...</span>
                </>
              ) : (
                <>
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0"
                  />
                  <span className="text-[11px] leading-tight text-center">
                    CONTINUE WITH GOOGLE / গুগুল দিয়ে চালিয়ে যান
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Bottom Info Boxes */}
          <div className="pt-6 mt-6 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Fleet Access</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">10% Wallet Commission</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">GPS Tracking</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">Live Local Routes</div>
            </div>
          </div>
        </motion.div>

        {/* =========================================================================
            SECTION 3: ADMIN PANEL (অ্যাডমিন প্যানেল)
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white rounded-[2.5rem] p-7 sm:p-8 shadow-2xl border border-slate-100 flex flex-col justify-between relative group hover:shadow-emerald-500/10 hover:border-emerald-100 transition-all"
        >
          <div>
            {/* Top Icon Badge */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/25">
                <ShieldCheck className="w-8 h-8 text-emerald-400" strokeWidth={2.5} />
              </div>
            </div>

            {/* Brand Title */}
            <div className="text-center mb-5">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                ChaLo <span className="text-emerald-600">চলো</span>
              </h2>
              <p className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest mt-1">
                PATHAR PRATIMA • LOCAL BIKE TAXI
              </p>
            </div>

            {/* Panel Pill Badge */}
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 text-slate-800 rounded-full text-[11px] font-black uppercase tracking-wider border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ADMIN PANEL / অ্যাডমিন প্যানেল
              </div>
            </div>

            {/* Section Heading & Description */}
            <div className="text-center mb-4">
              <h3 className="text-xl font-black text-slate-900">Admin Login</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Operational governance, driver authorization, tariff rules, and system oversight.
              </p>
            </div>

            {/* Error Notification */}
            {adminError && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-start gap-2.5 whitespace-pre-line leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{adminError}</div>
              </div>
            )}

            {/* Admin ID + Password Form */}
            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                  Admin ID / Email / অ্যাডমিন আইডি
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    placeholder="beraanimesh008@gmail.com"
                    disabled={adminLoading}
                    autoComplete="username"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                  Password / পাসওয়ার্ড
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={adminLoading}
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-2"
              >
                {adminLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Signing in Admin...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px]">SIGN IN AS ADMIN / অ্যাডমিন লগইন</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bottom Info Boxes */}
          <div className="pt-6 mt-6 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Security</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">Credentials Required</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Control</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">Full Operations</div>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Footer System Note */}
      <div className="mt-8 text-center text-[11px] text-slate-400 font-medium">
        ChaLo Pathar Pratima • Strict Role Isolation Enforced
      </div>
    </div>
  );
}
