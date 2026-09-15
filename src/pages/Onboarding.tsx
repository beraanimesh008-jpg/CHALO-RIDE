/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Phone, ArrowRight, Loader2, Bike, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function Onboarding() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.displayName || user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  // Not logged in -> return to login
  if (!user) return <Navigate to="/login" replace />;

  // If already completed onboarding, go straight to home (User Panel)
  if (profile?.onboardingComplete && profile?.phoneNumber) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (!trimmedName || trimmedName.length < 2) {
      setError('অনুগ্রহ করে আপনার সঠিক নাম লিখুন / Please enter your valid full name.');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError('অনুগ্রহ করে সঠিক ১০ সংখ্যার মোবাইল নম্বর দিন / Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: trimmedName,
        phoneNumber: cleanPhone,
        onboardingComplete: true,
        updatedAt: Date.now()
      });

      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError('তথ্য সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন। / Failed to save details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-7 sm:p-10 shadow-2xl relative overflow-hidden border border-slate-100 z-10"
      >
        <div className="relative">
          {/* Top Brand & Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-brand-600 rounded-[2rem] shadow-xl shadow-brand-600/30 mb-3 transform -rotate-3">
              <Bike className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Passenger Details • আরোহীর তথ্য
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1 leading-relaxed">
              প্রথমবার লগইন করার জন্য আপনার নাম ও মোবাইল নম্বর প্রদান করুন।
            </p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Please enter your name and mobile number to complete first-time login.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Full Name • আপনার সম্পূর্ণ নাম <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3.5 px-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                <User className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="আপনার সম্পূর্ণ নাম লিখুন / Enter your full name"
                  className="bg-transparent border-none outline-none w-full text-base font-bold text-slate-900 placeholder:text-slate-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Mobile Number Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">
                Mobile Number • মোবাইল নম্বর <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                <span className="text-slate-600 font-black text-sm border-r border-slate-300 pr-2">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="১০ সংখ্যার মোবাইল নম্বর"
                  className="bg-transparent border-none outline-none w-full text-base font-bold text-slate-900 placeholder:text-slate-400 tracking-wider"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium ml-1 block">
                রাইডের সময় ড্রাইভার যোগাযোগের জন্য এই নম্বর ব্যবহৃত হবে
              </span>
            </div>

            {/* Information Notice */}
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2.5 text-emerald-800 text-[11px] font-semibold leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                এটি শুধুমাত্র প্রথমবার লগইনের জন্য প্রযোজ্য। পরবর্তীতে লগইন করলে এই তথ্য আর চাওয়া হবে না।
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !name.trim() || phoneNumber.replace(/\D/g, '').length !== 10}
              className="w-full bg-brand-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>Submit Details • সাবমিট করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
