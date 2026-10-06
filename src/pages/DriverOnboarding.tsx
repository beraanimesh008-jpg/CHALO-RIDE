import React, { useState, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db, doc, updateDoc, collection, addDoc } from '../lib/firebase';
import { motion } from 'motion/react';
import {
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Bike,
  Camera,
  IdCard,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { UserRole, DriverVerificationStatus } from '../types';

export default function DriverOnboarding() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const driverPhotoInputRef = useRef<HTMLInputElement>(null);
  const vehiclePhotoInputRef = useRef<HTMLInputElement>(null);

  const [isExiting, setIsExiting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields as requested: Driver Photo, Gari Photo, Driver Name, Mobile No, Aadhaar No
  const [name, setName] = useState(profile?.driverName || profile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.driverMobile || profile?.phoneNumber || '');
  const [aadhaarNumber, setAadhaarNumber] = useState(profile?.aadhaarNumber || '');
  const [driverPhoto, setDriverPhoto] = useState<string | null>(profile?.driverPhotoUrl || profile?.photoURL || null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(profile?.vehiclePhoto || null);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // If already onboarded, go directly to driver dashboard (do not reopen registration form)
  if (profile?.driverOnboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleExitToLogin = async () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          role: UserRole.USER,
          updatedAt: Date.now()
        }).catch((err) => console.warn('Could not reset role to user on exit:', err));
      }
      await signOut();
    } catch (err) {
      console.warn('Signout on exit error:', err);
    } finally {
      sessionStorage.removeItem('chalo_session_role');
      localStorage.removeItem('chalo_session_role');
      navigate('/login', { replace: true });
    }
  };

  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size too large. Please select an image under 5MB. / ফাইলের আকার ৫ মেগাবাইটের কম হতে হবে।');
        return;
      }

      setError('');
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setter(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const parts = raw.match(/.{1,4}/g) || [];
    setAadhaarNumber(parts.join(' '));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');

    if (!driverPhoto) {
      setError('Please upload your Driver Photo (Selfie) / ড্রাইভারের ছবি আপলোড করুন');
      return;
    }

    if (!vehiclePhoto) {
      setError('Please upload your Toto / Vehicle Photo / গাড়ির ছবি আপলোড করুন');
      return;
    }

    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your full name / ড্রাইভারের পুরো নাম লিখুন');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number / ১০ সংখ্যার মোবাইল নম্বর লিখুন');
      return;
    }

    if (cleanAadhaar.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar number / ১২ সংখ্যার আধার নম্বর লিখুন');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const now = Date.now();
      await updateDoc(doc(db, 'users', user.uid), {
        driverName: trimmedName,
        displayName: trimmedName,
        driverMobile: cleanPhone,
        phoneNumber: cleanPhone,
        driverPhotoUrl: driverPhoto,
        photoURL: driverPhoto,
        vehiclePhoto: vehiclePhoto,
        aadhaarNumber: cleanAadhaar,
        driverVerificationStatus: DriverVerificationStatus.PENDING_APPROVAL,
        driverOnboardingComplete: true,
        role: UserRole.DRIVER,
        isOnline: false,
        submittedAt: now,
        updatedAt: now
      });

      // Post an immediate verification request notification to Admin
      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'New Driver Approval Request / নতুন চালকের আবেদন',
          message: `${trimmedName} (Mobile: ${cleanPhone}) has submitted driver registration with Toto & Aadhaar details for Admin approval.`,
          type: 'ALERT',
          target: 'ALL',
          driverId: user.uid,
          createdAt: now,
          read: false
        });
      } catch (notifErr) {
        console.warn('Could not post admin notification alert:', notifErr);
      }

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Driver onboarding error:', err);
      setError('Failed to submit application. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 py-6 sm:py-10 px-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Prominent Outer Top Back Bar */}
      <div className="w-full max-w-xl mb-4 flex items-center justify-between z-20">
        <button
          type="button"
          onClick={handleExitToLogin}
          disabled={isExiting}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black border border-slate-700 shadow-xl transition-all active:scale-95 cursor-pointer backdrop-blur-sm group"
          title="Exit Registration / রেজিস্ট্রেশন থেকে ফিরে যান"
        >
          {isExiting ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          ) : (
            <ArrowLeft className="w-4 h-4 text-brand-400 group-hover:-translate-x-1 transition-transform" />
          )}
          <span>← Back to Login / লগইন সেকশনে ফিরে যান</span>
        </button>

        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Chalogo • Driver Onboarding
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden z-10"
      >
        <div className="text-center mb-6">
          <div className="inline-flex p-4 bg-brand-600 rounded-[2rem] shadow-xl shadow-brand-600/30 mb-4 transform -rotate-3 text-white">
            <Bike className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Driver Registration
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-semibold mt-1">
            নতুন চালক নিবন্ধন • তথ্য পূরণ করে অ্যাডমিন অনুমোদনের জন্য পাঠান
          </p>
        </div>

        {/* Informational Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-brand-50/70 border border-brand-200/80 text-brand-900 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold text-brand-800">
            <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
            <span>অ্যাডমিন অনুমোদন প্রক্রিয়া (Admin Verification Rule)</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            ফর্মটি জমা দিলে আপনার আবেদনটি অ্যাডমিন প্যানেলে যাবে। অ্যাডমিন আপনার ছবি, গাড়ির ছবি ও আধার নম্বর যাচাই করে অনুমোদন করলেই আপনি সরাসরি রাইড রিকোয়েস্ট গ্রহণ করতে পারবেন।
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photos Row: Driver Photo & Toto/Vehicle Photo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Driver Photo Upload */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>১. ড্রাইভারের ছবি (Photo) *</span>
                {driverPhoto && <span className="text-emerald-600 font-bold">✓ নির্বাচিত</span>}
              </label>
              <div
                onClick={() => driverPhotoInputRef.current?.click()}
                className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/40 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden group relative"
              >
                {driverPhoto ? (
                  <>
                    <img src={driverPhoto} className="w-full h-full object-cover" alt="Driver" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                      ছবি পরিবর্তন করুন
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-white rounded-xl shadow-xs text-slate-400 group-hover:text-brand-600 transition-colors">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 group-hover:text-brand-700">
                      ড্রাইভারের ছবি তুলুন বা বাছুন
                    </span>
                  </>
                )}
                <input
                  type="file"
                  ref={driverPhotoInputRef}
                  className="hidden"
                  accept="image/*"
                  capture="user"
                  onChange={(e) => handleFileChange(e, setDriverPhoto)}
                />
              </div>
            </div>

            {/* 2. Vehicle / Toto Photo Upload */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>২. গাড়ির ছবি (Toto Photo) *</span>
                {vehiclePhoto && <span className="text-emerald-600 font-bold">✓ নির্বাচিত</span>}
              </label>
              <div
                onClick={() => vehiclePhotoInputRef.current?.click()}
                className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/40 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden group relative"
              >
                {vehiclePhoto ? (
                  <>
                    <img src={vehiclePhoto} className="w-full h-full object-cover" alt="Vehicle" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                      ছবি পরিবর্তন করুন
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-white rounded-xl shadow-xs text-slate-400 group-hover:text-brand-600 transition-colors">
                      <Bike className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 group-hover:text-brand-700">
                      টোটো/গাড়ির ছবি আপলোড করুন
                    </span>
                  </>
                )}
                <input
                  type="file"
                  ref={vehiclePhotoInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setVehiclePhoto)}
                />
              </div>
            </div>
          </div>

          {/* 3. Driver Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
              ৩. ড্রাইভারের পুরো নাম (Driver Name) *
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
              <User className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="যেমন: অমল মণ্ডল (আপনার পুরো নাম)"
                className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-900 placeholder:text-slate-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 4. Mobile Number */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
              ৪. মোবাইল নম্বর (Mobile Number) *
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
              <Phone className="w-5 h-5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-bold text-sm">+91</span>
              <input
                type="tel"
                placeholder="10 সংখ্যার মোবাইল নম্বর"
                className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-900 placeholder:text-slate-400 font-mono tracking-wide"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>
          </div>

          {/* 5. Aadhaar Number */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
              ৫. আধার নম্বর (12-Digit Aadhaar No) *
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
              <IdCard className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="XXXX XXXX XXXX (১২ সংখ্যার আধার নম্বর)"
                className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-900 placeholder:text-slate-400 font-mono tracking-wider"
                value={aadhaarNumber}
                onChange={handleAadhaarChange}
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !driverPhoto ||
              !vehiclePhoto ||
              !name.trim() ||
              phoneNumber.replace(/\D/g, '').length < 10 ||
              aadhaarNumber.replace(/\D/g, '').length < 12
            }
            className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-brand-600/25"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting Request... / জমা দেওয়া হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>Submit for Admin Approval / জমা দিন</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
