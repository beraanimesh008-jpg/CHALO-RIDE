/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { motion } from 'motion/react';
import {
  Users,
  Bike,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  MapPin,
  Clock,
  Shield
} from 'lucide-react';
import { cn } from '../lib/utils';

function getAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).\nএই ডোমেনটি Firebase-এর Authorized domains তালিকায় অনুমোদিত নয়।';
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
    loginDriverWithGoogle
  } = useAuth();

  // Mobile active tab: 'all' on larger screens, togglable on mobile
  const [activeMobileTab, setActiveMobileTab] = useState<'user' | 'driver'>('user');

  // Separate loading & error states for Customer and Driver
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);

  // If already authenticated with a role, redirect directly to their respective panel
  if (user && profile && !authLoading) {
    if (profile.role === UserRole.ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    if (profile.role === UserRole.DRIVER) {
      if (!profile.driverOnboardingComplete) {
        return <Navigate to="/driver-onboarding" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  // 1. Customer Login Handler
  const handleUserGoogleLogin = async () => {
    if (userLoading) return;
    setUserError(null);
    setUserLoading(true);
    try {
      await loginUserWithGoogle();
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Customer login error:', err);
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
      const driverProf = await loginDriverWithGoogle();
      // First-time driver without completed registration form goes to onboarding
      if (!driverProf.driverOnboardingComplete) {
        navigate('/driver-onboarding', { replace: true });
      } else {
        // Already registered driver logs straight in to Dashboard
        navigate('/dashboard', { replace: true });
      }
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

  return (
    <div className="min-h-screen bg-slate-900 py-4 px-3 sm:px-6 lg:px-8 flex flex-col justify-between items-center relative overflow-x-hidden">
      {/* Background ambient lighting glows */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* =========================================================================
          TOP BAR: BRAND LOGO (LEFT) & COMPACT ADMIN LOGIN (RIGHT)
         ========================================================================= */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between z-20 mb-3 sm:mb-5 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-600 rounded-xl shadow-md shadow-brand-600/30">
            <Bike className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-white tracking-tight">
              ChaLo <span className="text-brand-400">চলো</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Sundarban Ride Network
            </span>
          </div>
        </div>

        {/* Top-Right Small Compact Admin Login Option */}
        <Link
          to="/admin-login"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700/80 shadow-sm transition-all active:scale-95"
          title="Admin Panel Login / অ্যাডমিন লগইন"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Admin Login • অ্যাডমিন</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-4xl mx-auto z-10 my-auto py-1">
        {/* Compact Page Title */}
        <div className="text-center max-w-xl mx-auto mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            লগইন পোর্টাল <span className="text-brand-400 text-xl sm:text-2xl font-extrabold">• Login</span>
          </h1>
          <p className="text-slate-400 text-[11px] sm:text-xs font-medium mt-1">
            যাত্রী বা চালক হিসেবে লগইন করুন (Select your role)
          </p>
        </div>

        {/* Mobile Fast Tab Switcher (Visible on mobile screens to toggle with 1 click) */}
        <div className="md:hidden flex items-center p-1 bg-slate-800/90 rounded-2xl border border-slate-700/70 mb-4 max-w-xs mx-auto shadow-lg">
          <button
            type="button"
            onClick={() => setActiveMobileTab('user')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeMobileTab === 'user'
                ? "bg-emerald-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>যাত্রী (Passenger)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab('driver')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeMobileTab === 'driver'
                ? "bg-amber-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>চালক (Driver)</span>
          </button>
        </div>

        {/* =========================================================================
            2 COMPACT LOGIN PANELS: PASSENGER & DRIVER
           ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto items-stretch">
          
          {/* -----------------------------------------------------------------------
              PANEL 1: CUSTOMER / PASSENGER LOGIN (কাস্টমার লগইন)
             ----------------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "bg-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-100 flex flex-col justify-between relative group hover:border-emerald-200 transition-all",
              activeMobileTab !== 'user' && "hidden md:flex"
            )}
          >
            <div>
              {/* Badge & Top Icon */}
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                  <Users className="w-3 h-3" />
                  CUSTOMER • যাত্রী
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Users className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
              </div>

              {/* Title & Description */}
              <div className="mb-3.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Passenger Login
                </h2>
                <p className="text-xs font-bold text-emerald-600 mt-0.5">
                  যাত্রী হিসেবে রাইড বুক করুন
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                  টোটো ও বাইক রাইড বুকিং, লাইভ জিপিএস ট্র্যাকিং ও কম ভাড়া।
                </p>
              </div>

              {/* Compact Key Highlights */}
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] font-bold text-slate-600">
                <span className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  তাত্ক্ষণিক বুকিং
                </span>
                <span className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  লাইভ ট্র্যাকিং
                </span>
              </div>

              {/* Error Message */}
              {userError && (
                <div className="p-2.5 mb-3 bg-rose-50 text-rose-700 rounded-xl text-[11px] font-bold border border-rose-200 flex items-start gap-2 whitespace-pre-line leading-snug">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">{userError}</div>
                </div>
              )}

              {/* Customer Google Sign-In Button */}
              <button
                type="button"
                onClick={handleUserGoogleLogin}
                disabled={userLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-slate-900/15 transition-all flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50"
              >
                {userLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <img
                      src="https://www.google.com/favicon.ico"
                      alt="Google"
                      className="w-3.5 h-3.5 bg-white rounded-full p-0.5 shrink-0"
                    />
                    <span className="text-[11px] font-bold">
                      LOGIN WITH GOOGLE (যাত্রী)
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom Tag */}
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Book Bike & Toto</span>
              <span className="text-emerald-600 font-bold">Fast & Safe</span>
            </div>
          </motion.div>

          {/* -----------------------------------------------------------------------
              PANEL 2: DRIVER / FLEET LOGIN (ড্রাইভার লগইন)
             ----------------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className={cn(
              "bg-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-100 flex flex-col justify-between relative group hover:border-amber-200 transition-all",
              activeMobileTab !== 'driver' && "hidden md:flex"
            )}
          >
            <div>
              {/* Badge & Top Icon */}
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-200">
                  <Bike className="w-3 h-3" />
                  DRIVER • চালক
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Bike className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
              </div>

              {/* Title & Description */}
              <div className="mb-3.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Driver Login
                </h2>
                <p className="text-xs font-bold text-amber-600 mt-0.5">
                  চালক হিসেবে ট্রিপ গ্রহণ করুন
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                  অনুমোদিত চালক হিসেবে লাইভ ট্রিপ অ্যালার্ট ও ১০% কমিশন ওয়ালেট।
                </p>
              </div>

              {/* Compact Key Highlights */}
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] font-bold text-slate-600">
                <span className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-500" />
                  লাইভ ট্রিপ অ্যালার্ট
                </span>
                <span className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-500" />
                  ১০% কম কমিশন
                </span>
              </div>

              {/* Error Message */}
              {driverError && (
                <div className="p-2.5 mb-3 bg-rose-50 text-rose-700 rounded-xl text-[11px] font-bold border border-rose-200 flex items-start gap-2 whitespace-pre-line leading-snug">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">{driverError}</div>
                </div>
              )}

              {/* Driver Google Sign-In Button */}
              <button
                type="button"
                onClick={handleDriverGoogleLogin}
                disabled={driverLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-slate-900/15 transition-all flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50"
              >
                {driverLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <img
                      src="https://www.google.com/favicon.ico"
                      alt="Google"
                      className="w-3.5 h-3.5 bg-white rounded-full p-0.5 shrink-0"
                    />
                    <span className="text-[11px] font-bold">
                      LOGIN WITH GOOGLE (চালক)
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom Tag */}
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Authorized Drivers Fleet</span>
              <span className="text-amber-600 font-bold">10% Wallet</span>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto text-center py-2 text-slate-500 text-[11px] font-medium z-10 border-t border-slate-800/80 mt-3">
        ChaLo Toto & Bike Taxi • সুন্দরবন ও পাথরপ্রতিমা • সর্বস্বত্ব সংরক্ষিত
      </footer>
    </div>
  );
}
