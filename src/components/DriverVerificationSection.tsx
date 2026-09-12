/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import {
  DriverVerificationStatus,
  validateAadhaar,
  validateDriverMobile,
  maskAadhaar
} from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertCircle,
  Camera,
  CheckCircle2,
  Upload,
  User,
  Phone,
  CreditCard,
  X,
  AlertTriangle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface DriverVerificationSectionProps {
  onSuccess?: () => void;
  compactMode?: boolean;
}

export default function DriverVerificationSection({
  onSuccess,
  compactMode = false
}: DriverVerificationSectionProps) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = profile?.driverVerificationStatus || DriverVerificationStatus.INCOMPLETE;

  // Form states initialized with existing verified data
  const [driverName, setDriverName] = useState(profile?.driverName || profile?.displayName || '');
  const [driverMobile, setDriverMobile] = useState(
    profile?.driverMobile || profile?.phoneNumber || ''
  );
  const [aadhaarNumber, setAadhaarNumber] = useState(profile?.aadhaarNumber || '');
  const [driverPhotoUrl, setDriverPhotoUrl] = useState<string | null>(
    profile?.driverPhotoUrl || profile?.photoURL || null
  );

  const [isEditing, setIsEditing] = useState(
    status === DriverVerificationStatus.INCOMPLETE || status === DriverVerificationStatus.REJECTED
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compress image to reasonable resolution (<800px) and clean JPEG
  const processAndCompressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload a valid image file (JPEG, PNG, WebP). / অনুগ্রহ করে একটি ছবি আপলোড করুন।'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image size exceeds 5MB. Please choose a smaller photo. / ছবির আকার ৫ মেগাবাইটের কম হতে হবে।'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file. / ফাইল লোড করতে সমস্যা হয়েছে।'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image file format. / অবৈধ ছবি ফাইল।'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context error.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    try {
      const compressed = await processAndCompressImage(file);
      setDriverPhotoUrl(compressed);
    } catch (err: any) {
      setFormError(err.message || 'Error processing photo. Please try another image.');
    }
  };

  const formatAadhaarInput = (value: string) => {
    // Only digits, maximum 12 digits
    const digitsOnly = value.replace(/\D/g, '').slice(0, 12);
    // Format as XXXX XXXX XXXX
    const parts = digitsOnly.match(/.{1,4}/g) || [];
    return parts.join(' ');
  };

  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatAadhaarInput(raw);
    setAadhaarNumber(formatted);
  };

  const handleSubmitForApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setFormError(null);
    setSuccessMessage(null);

    // 1. Mandatory Name Validation
    const trimmedName = driverName.trim();
    if (!trimmedName) {
      setFormError('Driver Name is mandatory. / ড্রাইভারের নাম আবশ্যক।');
      return;
    }

    // 2. Mandatory Mobile Validation
    const mobileValidation = validateDriverMobile(driverMobile);
    if (!mobileValidation.isValid) {
      setFormError(mobileValidation.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    // 3. Mandatory Aadhaar Validation
    const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, '');
    const aadhaarValidation = validateAadhaar(cleanAadhaar);
    if (!aadhaarValidation.isValid) {
      setFormError(aadhaarValidation.error || 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }

    // 4. Mandatory Driver Photo Validation
    if (!driverPhotoUrl) {
      setFormError('Driver Photo is mandatory. Please upload a clear photo. / ড্রাইভারের ছবি আবশ্যক।');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = Date.now();
      const updatedFields = {
        driverVerificationStatus: DriverVerificationStatus.PENDING_APPROVAL,
        driverName: trimmedName,
        displayName: trimmedName,
        driverMobile: driverMobile.trim(),
        phoneNumber: driverMobile.trim(),
        aadhaarNumber: cleanAadhaar,
        driverPhotoUrl: driverPhotoUrl,
        photoURL: driverPhotoUrl,
        submittedAt: now,
        updatedAt: now,
        // Block receiving rides while pending
        isOnline: false,
        driverOnboardingComplete: true
      };

      // Save directly to the existing Driver user document in Firestore
      await updateDoc(doc(db, 'users', profile.uid), updatedFields);

      // Create Admin notification request
      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'New Driver Approval Request / নতুন Driver Approval Request এসেছে',
          message: `${trimmedName} (Mobile: ${driverMobile.trim()}) has submitted driver verification for Admin approval.`,
          type: 'ALERT',
          target: 'ALL',
          createdAt: now,
          read: false,
          driverId: profile.uid
        });
      } catch (notifErr) {
        console.warn('Could not post notification alert:', notifErr);
      }

      setSuccessMessage(
        'Your profile has been submitted for Admin approval.\nআপনার প্রোফাইল Admin approval-এর জন্য জমা হয়েছে।'
      );
      setIsEditing(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error submitting driver verification:', err);
      setFormError(
        err.message || 'Failed to submit profile for approval. Please check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-[2.5rem] border border-slate-100 card-shadow overflow-hidden transition-all',
        compactMode ? 'p-6' : 'p-8 md:p-10'
      )}
    >
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Driver Verification <span className="text-brand-600">/ ড্রাইভার ভেরিফিকেশন</span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Mandatory KYC and Admin approval required before receiving ride requests
          </p>
        </div>

        {/* Status Pill */}
        <div>
          {status === DriverVerificationStatus.APPROVED && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Verified & Approved / অনুমোদিত</span>
            </div>
          )}

          {status === DriverVerificationStatus.PENDING_APPROVAL && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black animate-pulse">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pending Admin Approval / Admin Approval-এর অপেক্ষায়</span>
            </div>
          )}

          {status === DriverVerificationStatus.REJECTED && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Profile Rejected / প্রোফাইল অনুমোদিত হয়নি</span>
            </div>
          )}

          {status === DriverVerificationStatus.INCOMPLETE && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl text-xs font-black">
              <AlertCircle className="w-4 h-4 text-slate-500" />
              <span>Profile Incomplete / প্রোফাইল অসম্পূর্ণ</span>
            </div>
          )}
        </div>
      </div>

      {/* Rejection Alert Box */}
      {status === DriverVerificationStatus.REJECTED && (
        <div className="mt-6 p-5 bg-rose-50 border border-rose-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-black text-rose-900">
                Your driver profile was rejected / আপনার ড্রাইভার প্রোফাইল অনুমোদিত হয়নি
              </h4>
              <p className="text-xs text-rose-800 mt-1 font-medium">
                {profile?.rejectionReason ? (
                  <>
                    <strong className="font-bold">Reason: </strong>
                    {profile.rejectionReason}
                  </>
                ) : (
                  'Please update the required information and resubmit. প্রয়োজনীয় তথ্য সংশোধন করে আবার জমা দিন।'
                )}
              </p>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md active:scale-95"
                >
                  Edit Profile & Resubmit / তথ্য সংশোধন করে জমা দিন
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Approval Notice */}
      {status === DriverVerificationStatus.PENDING_APPROVAL && !isEditing && (
        <div className="mt-6 p-6 bg-blue-50/70 border border-blue-200 rounded-3xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Clock className="w-5 h-5 animate-spin text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-blue-900">
                Your profile has been submitted for Admin approval.
              </h4>
              <p className="text-xs text-blue-800 mt-1 font-medium leading-relaxed">
                আপনার প্রোফাইল Admin approval-এর জন্য জমা হয়েছে।
                Our administrative team is reviewing your details (Photo, Name, Mobile, and Aadhaar).
                New ride requests will be unlocked as soon as your account is approved.
              </p>
              {profile?.submittedAt && (
                <p className="text-[10px] text-blue-600 font-bold mt-2">
                  Submitted on: {new Date(profile.submittedAt).toLocaleString()}
                </p>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Update Information / তথ্য পরিবর্তন করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approved State Summary */}
      {status === DriverVerificationStatus.APPROVED && !isEditing && (
        <div className="mt-6 p-6 bg-emerald-50/60 border border-emerald-200 rounded-3xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-emerald-950">
                  Driver Identity Verified & Approved / চালক অনুমোদিত
                </h4>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-black rounded-md uppercase">
                  Active Fleet
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 font-medium">
                You are fully eligible to receive and accept NEW ride requests across the designated Chalo service area.
              </p>

              {/* Masked Data Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-emerald-200/60">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800/70 block">
                    Driver Name
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {profile?.driverName || profile?.displayName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800/70 block">
                    Mobile Number
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {profile?.driverMobile || profile?.phoneNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800/70 block">
                    Aadhaar (Protected)
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    {maskAadhaar(profile?.aadhaarNumber)}
                  </span>
                </div>
              </div>

              {profile?.approvedAt && (
                <p className="text-[10px] text-emerald-700 font-semibold mt-3">
                  Approved on: {new Date(profile.approvedAt).toLocaleDateString()} by {profile.approvedBy || 'Admin'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold text-emerald-900 whitespace-pre-line">{successMessage}</p>
        </div>
      )}

      {/* Form Errors */}
      {formError && (
        <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-xs font-bold text-rose-800 whitespace-pre-line">{formError}</p>
        </div>
      )}

      {/* Mandatory Verification Form */}
      <AnimatePresence>
        {isEditing && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmitForApproval}
            className="mt-8 space-y-6 overflow-hidden"
          >
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium leading-relaxed">
              <strong>Mandatory Requirements / আবশ্যক শর্তাবলী:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                <li>All 4 fields are mandatory for Admin verification.</li>
                <li>Driver Name must match official ID.</li>
                <li>Driver Mobile must be an active 10-digit reachable number.</li>
                <li>Driver Aadhaar must be valid 12 digits (securely masked when displayed).</li>
                <li>Driver Photo must be a clear front-facing portrait photo.</li>
              </ul>
            </div>

            {/* Field 4: Driver Photo Upload & Preview */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-brand-600" />
                  4. Driver Photo / ড্রাইভারের ছবি <span className="text-rose-500">*</span>
                </span>
                {driverPhotoUrl && (
                  <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Photo Selected
                  </span>
                )}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                {/* Photo Preview */}
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner bg-slate-100 shrink-0 group">
                  {driverPhotoUrl ? (
                    <img
                      src={driverPhotoUrl}
                      alt="Driver Photo Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[9px] font-bold">No Photo</span>
                    </div>
                  )}

                  {driverPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setDriverPhotoUrl(null)}
                      className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition-colors"
                      title="Remove Photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Upload Action */}
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-3 bg-white hover:bg-brand-50 text-slate-800 hover:text-brand-600 border border-slate-200 hover:border-brand-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 mx-auto sm:mx-0 active:scale-95"
                  >
                    <Upload className="w-4 h-4 text-brand-600" />
                    <span>Upload Photo / ছবি আপলোড করুন</span>
                  </button>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Supports JPG, PNG, WebP (Max 5MB). Please upload a clear, front-facing face photo.
                  </p>
                </div>
              </div>
            </div>

            {/* Field 1: Driver Name */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 px-1">
                <User className="w-4 h-4 text-brand-600" />
                1. Driver Name / ড্রাইভারের নাম <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                <User className="w-5 h-5 text-slate-300 shrink-0" />
                <input
                  type="text"
                  placeholder="Enter full legal name (e.g. Subrata Das)"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            {/* Field 2: Driver Mobile Number */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 px-1">
                <Phone className="w-4 h-4 text-brand-600" />
                2. Driver Mobile Number / ড্রাইভারের মোবাইল নম্বর <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                <span className="text-xs font-black text-slate-400 select-none">+91</span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  value={driverMobile}
                  onChange={(e) => setDriverMobile(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            {/* Field 3: Driver Aadhaar Number */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-brand-600" />
                  3. Driver Aadhaar Number / ড্রাইভারের আধার নম্বর <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">12 Digits (Protected)</span>
              </label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
                <CreditCard className="w-5 h-5 text-slate-300 shrink-0" />
                <input
                  type="text"
                  placeholder="1234 5678 9012"
                  value={aadhaarNumber}
                  onChange={handleAadhaarChange}
                  maxLength={14} // 12 digits + 2 spaces
                  className="w-full bg-transparent outline-none text-sm font-mono font-bold text-slate-900 placeholder:text-slate-300 tracking-wider"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium px-1">
                Privacy Protected: Aadhaar is masked in regular displays as •••• •••• 1234 and never exposed publicly.
              </p>
            </div>

            {/* Submit Action */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:flex-1 py-4 px-6 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-brand-600/25 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Profile...</span>
                  </>
                ) : (
                  <>
                    <span>Submit for Approval / অ্যাপ্রুভালের জন্য জমা দিন</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {status !== DriverVerificationStatus.INCOMPLETE && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
