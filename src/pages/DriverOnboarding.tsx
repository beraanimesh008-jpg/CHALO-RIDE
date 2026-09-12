import React, { useState, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Phone, ArrowRight, Loader2, Bike, Camera, Building, CreditCard, IdCard } from 'lucide-react';
import { UserRole } from '../types';

export default function DriverOnboarding() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const vehicleFileInputRef = useRef<HTMLInputElement>(null);
  const aadhaarFileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(profile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(profile?.vehiclePhoto || null);
  const [aadhaarPhoto, setAadhaarPhoto] = useState<string | null>(profile?.aadhaarPhoto || null);
  const [accountNumber, setAccountNumber] = useState(profile?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(profile?.ifscCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.driverOnboardingComplete) return <Navigate to="/dashboard" replace />;

  const handleVehiclePhotoClick = () => {
    vehicleFileInputRef.current?.click();
  };

  const handleAadhaarPhotoClick = () => {
    aadhaarFileInputRef.current?.click();
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
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compressing to 70% quality JPEG
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File is too large. Please select an image under 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setter(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!vehiclePhoto) {
      setError('Please upload a vehicle photo');
      return;
    }

    if (!aadhaarPhoto) {
      setError('Please upload an Aadhaar card photo');
      return;
    }

    if (!accountNumber || !ifscCode) {
      setError('Please provide bank details');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        phoneNumber: phoneNumber,
        vehiclePhoto: vehiclePhoto,
        aadhaarPhoto: aadhaarPhoto,
        accountNumber: accountNumber,
        ifscCode: ifscCode,
        driverOnboardingComplete: true,
        role: UserRole.DRIVER,
        updatedAt: Date.now()
      });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Driver onboarding error:', err);
      setError('Failed to update driver profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-accent-50 rounded-full blur-3xl opacity-60"></div>
        
        <div className="relative">
          <div className="text-center mb-8">
            <div className="inline-flex p-5 bg-accent-500 rounded-[2rem] shadow-xl shadow-accent-500/30 mb-6 transform rotate-6">
              <Bike className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Driver Registration</h1>
            <p className="text-slate-500 text-sm font-medium">Join our fleet and start earning today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vehicle Photo Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicle Photo</label>
                <div 
                  onClick={handleVehiclePhotoClick}
                  className="w-full aspect-[4/3] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent-400 hover:bg-accent-50 transition-all overflow-hidden group"
                >
                  {vehiclePhoto ? (
                    <img src={vehiclePhoto} className="w-full h-full object-cover" alt="Vehicle" />
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-accent-500 transition-colors">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-accent-600 transition-colors">Vehicle Photo</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={vehicleFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setVehiclePhoto)}
                  />
                </div>
              </div>

              {/* Aadhaar Photo Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Aadhaar Card Photo</label>
                <div 
                  onClick={handleAadhaarPhotoClick}
                  className="w-full aspect-[4/3] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent-400 hover:bg-accent-50 transition-all overflow-hidden group"
                >
                  {aadhaarPhoto ? (
                    <img src={aadhaarPhoto} className="w-full h-full object-cover" alt="Aadhaar" />
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-accent-500 transition-colors">
                        <IdCard className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-accent-600 transition-colors">Aadhaar Card</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={aadhaarFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setAadhaarPhoto)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Driver Name</label>
                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-accent-300 focus-within:ring-8 focus-within:ring-accent-500/5 transition-all">
                  <User className="w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Your full name" 
                    className="bg-transparent border-none outline-none w-full text-lg font-bold text-slate-900 placeholder:text-slate-300"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-accent-300 focus-within:ring-8 focus-within:ring-accent-500/5 transition-all">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-slate-400 font-bold">+91</span>
                    <input 
                      type="tel" 
                      placeholder="10 digit number" 
                      className="bg-transparent border-none outline-none w-full text-lg font-bold text-slate-900 placeholder:text-slate-300"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Number</label>
                  <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-accent-300 focus-within:ring-8 focus-within:ring-accent-500/5 transition-all">
                    <CreditCard className="w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Bank Account No" 
                      className="bg-transparent border-none outline-none w-full text-lg font-bold text-slate-900 placeholder:text-slate-300"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IFSC Code</label>
                  <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-accent-300 focus-within:ring-8 focus-within:ring-accent-500/5 transition-all">
                    <Building className="w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="IFSC Code" 
                      className="bg-transparent border-none outline-none w-full text-lg font-bold text-slate-900 placeholder:text-slate-300"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-rose-500 text-xs font-bold text-center">{error}</p>
            )}

            <button 
              type="submit"
              disabled={loading || !name || phoneNumber.length < 10 || !vehiclePhoto || !aadhaarPhoto || !accountNumber || !ifscCode}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-accent-500 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Driver Setup <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
