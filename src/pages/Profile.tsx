import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserRole, RideStatus } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import {
  User,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  LogOut,
  Camera,
  ClipboardList,
  Edit3,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import DriverVerificationSection from '../components/DriverVerificationSection';

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Authoritative completed trips count
  const [totalCompletedTrips, setTotalCompletedTrips] = useState<number>(profile?.totalRides || 0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync edit name if profile displayName changes externally
  useEffect(() => {
    if (profile?.displayName && !isEditing) {
      setEditName(profile.displayName);
    }
  }, [profile?.displayName, isEditing]);

  // Real-time authoritative listener for completed rides belonging to authenticated customer
  useEffect(() => {
    if (!profile?.uid) return;

    const ridesQuery = query(
      collection(db, 'rides'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        let count = 0;
        const seenIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          if (seenIds.has(docSnap.id)) return;
          seenIds.add(docSnap.id);

          const data = docSnap.data();
          // Count only successfully COMPLETED rides. Do not count cancelled, rejected, etc.
          if (data.status === RideStatus.COMPLETED || data.status === 'COMPLETED') {
            count += 1;
          }
        });

        setTotalCompletedTrips(count);

        // Keep totalRides on user document synchronized if it differs
        if (profile.totalRides !== count) {
          updateDoc(doc(db, 'users', profile.uid), {
            totalRides: count
          }).catch(() => {
            // Non-blocking sync
          });
        }
      },
      (error) => {
        console.error('Error fetching customer completed rides:', error);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid, profile?.totalRides]);

  if (!profile) return null;

  // Process & compress uploaded image file (<800px, JPEG quality 0.8)
  const processAndCompressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload a valid image file (JPEG, PNG, WebP). / অনুগ্রহ করে একটি ছবি ফাইল আপলোড করুন।'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image size exceeds 5MB. Please choose a smaller photo. / ছবির আকার ৫ মেগাবাইটের কম হতে হবে।'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file. / ফাইল পড়তে ব্যর্থ হয়েছে।'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image file format. / ছবির ফরম্যাট অবৈধ।'));
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
            reject(new Error('Canvas rendering context error.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);

    try {
      const compressedDataUrl = await processAndCompressImage(file);
      setPreviewPhoto(compressedDataUrl);
      if (!isEditing) {
        setIsEditing(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error processing photo. / ছবি প্রসেস করতে ত্রুটি হয়েছে।');
    }
  };

  const handleStartEditing = () => {
    setEditName(profile.displayName || '');
    setPreviewPhoto(null);
    setFormError(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditName(profile.displayName || '');
    setPreviewPhoto(null);
    setFormError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) {
      setFormError('Customer name cannot be empty. / নাম খালি রাখা যাবে না।');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const updatedPhotoUrl = previewPhoto !== null ? previewPhoto : (profile.photoURL || '');

      // 1. Authoritative update in existing Firestore users collection
      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        displayName: trimmed,
        photoURL: updatedPhotoUrl,
        updatedAt: Date.now()
      });

      // 2. Synchronize Firebase Auth display identity if available
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: trimmed,
            ...(updatedPhotoUrl && !updatedPhotoUrl.startsWith('data:') ? { photoURL: updatedPhotoUrl } : {})
          });
        } catch (authErr) {
          console.warn('Firebase Auth updateProfile non-fatal warning:', authErr);
        }
      }

      setSuccessMessage('Profile updated successfully! / প্রোফাইল সফলভাবে আপডেট করা হয়েছে।');
      setIsEditing(false);
      setPreviewPhoto(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setFormError(err.message || 'Failed to save changes. Please try again. / প্রোফাইল সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  const currentDisplayPhoto = previewPhoto || profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'Passenger')}`;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 pb-12">
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Success Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Card */}
      <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 card-shadow border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-48 h-48 bg-brand-50 rounded-full -ml-24 -mt-24 opacity-50 group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-accent-50 rounded-full -mr-16 -mb-16 opacity-50 group-hover:scale-110 transition-transform duration-700" />
        
        {/* Avatar & Photo Selection */}
        <div className="relative mb-6 z-10">
          <div className="w-32 h-32 rounded-[2rem] overflow-hidden ring-8 ring-slate-50 shadow-2xl relative group/avatar bg-slate-100">
            <img 
              src={currentDisplayPhoto} 
              alt="Profile" 
              className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-105" 
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-brand-900/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center transition-all cursor-pointer text-white gap-1"
              title="Change Profile Photo / ছবি পরিবর্তন করুন"
            >
              <Camera className="w-7 h-7" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
            </button>
          </div>

          {/* Quick Camera Action Badge */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 bg-brand-600 hover:bg-brand-700 p-2.5 rounded-xl border-4 border-white shadow-lg text-white transition-transform active:scale-95 cursor-pointer"
            title="Upload New Photo / ছবি আপলোড করুন"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Name and Edit Form */}
        <div className="z-10 w-full max-w-md">
          {!isEditing ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{profile.displayName}</h2>
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Profile / প্রোফাইল এডিট"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>

              {/* Edit Profile CTA Button */}
              <button
                type="button"
                onClick={handleStartEditing}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 mt-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-black rounded-full border border-brand-200/60 transition-all active:scale-95 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile / প্রোফাইল এডিট</span>
              </button>

              <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400 font-medium text-sm mb-6">
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {profile.email}
                </span>
                {profile.phoneNumber && (
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    +91 {profile.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Inline Edit Profile Form */
            <form onSubmit={handleSaveProfile} className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-5 mb-6 text-left shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-brand-600" />
                  Edit Profile / প্রোফাইল এডিট
                </span>
                {previewPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPhoto(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Photo
                  </button>
                )}
              </div>

              {/* Photo Change Indicator */}
              <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={currentDisplayPhoto}
                    alt="Preview"
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                  />
                  <div>
                    <div className="text-xs font-black text-slate-900">Profile Photo / ছবি</div>
                    <div className="text-[11px] text-slate-500">
                      {previewPhoto ? 'New photo selected (Preview)' : 'JPG, PNG, or WebP'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Choose Photo
                </button>
              </div>

              {/* Customer Name Input */}
              <div className="mb-4">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Customer Name / গ্রাহকের পুরো নাম <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter your name"
                    disabled={isSaving}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60 transition-all"
                  />
                </div>
              </div>

              {/* Form Error Alert */}
              {formError && (
                <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons: Save & Cancel */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes / সেভ করুন</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditing}
                  disabled={isSaving}
                  className="py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel / বাতিল</span>
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Total Trips Card (Requirement 3: Authoritative Completed Trips, Requirement 4: Earnings Removed) */}
        <div className="w-full z-10">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group/stat hover:bg-white hover:shadow-xl transition-all flex items-center justify-between">
            <div className="text-left">
              <div className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                Total Trips • সম্পন্ন ট্রিপস
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Successfully completed rides with Chalo TOTO
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-slate-900 group-hover:text-brand-600 transition-colors uppercase">
                {totalCompletedTrips}
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                Completed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Verification & Role Status */}
      <div className="bg-white rounded-[2.5rem] p-8 card-shadow border border-slate-100">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 ml-2">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          Account & Role Authorization
        </h3>
        
        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md",
              profile.role === UserRole.ADMIN && "bg-slate-900",
              profile.role === UserRole.DRIVER && "bg-accent-500",
              profile.role === UserRole.USER && "bg-brand-600"
            )}>
              {profile.role === UserRole.ADMIN && <ShieldCheck className="w-6 h-6 text-emerald-400" />}
              {profile.role === UserRole.DRIVER && <ClipboardList className="w-6 h-6 text-white" />}
              {profile.role === UserRole.USER && <User className="w-6 h-6 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-slate-900">
                  {profile.role === UserRole.ADMIN && 'System Administrator (অ্যাডমিন)'}
                  {profile.role === UserRole.DRIVER && 'Verified Driver (অনুমোদিত চালক)'}
                  {profile.role === UserRole.USER && 'Registered Passenger (অনুমোদিত যাত্রী)'}
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-md">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {profile.role === UserRole.ADMIN && 'Full access to fleet management, wallets, and system settings.'}
                {profile.role === UserRole.DRIVER && 'Authorized for ride requests, GPS tracking, and wallet payouts.'}
                {profile.role === UserRole.USER && 'Authorized for ride bookings, fare negotiation, and live tracking.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="px-5 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 font-medium mt-4 ml-2">
          Strict role separation enforced. To switch between User, Driver, or Admin portals, please sign out and enter via the corresponding portal gateway.
        </p>
      </div>

      <AnimatePresence>
        {profile.role === UserRole.DRIVER && (
          <DriverVerificationSection />
        )}
      </AnimatePresence>

      {/* Logout */}
      <button 
        onClick={() => signOut()}
        className="w-full p-6 bg-slate-50 text-slate-400 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all mb-10 group cursor-pointer"
      >
        <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        Sign Out Securely
      </button>
    </div>
  );
}

