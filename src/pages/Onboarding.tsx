import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, Phone, ArrowRight, Loader2, Bike } from 'lucide-react';

export default function Onboarding() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.onboardingComplete) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        phoneNumber: phoneNumber,
        onboardingComplete: true,
        updatedAt: Date.now()
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-50 rounded-full blur-3xl opacity-60"></div>
        
        <div className="relative">
          <div className="text-center mb-8">
            <div className="inline-flex p-5 bg-brand-600 rounded-[2rem] shadow-xl shadow-brand-600/30 mb-6 transform -rotate-6">
              <Bike className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Complete Profile</h1>
            <p className="text-slate-500 text-sm font-medium">Just two more steps to start your journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-brand-300 focus-within:ring-8 focus-within:ring-brand-500/5 transition-all">
                <User className="w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Enter your name" 
                  className="bg-transparent border-none outline-none w-full text-lg font-bold text-slate-900 placeholder:text-slate-300"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
              <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-brand-300 focus-within:ring-8 focus-within:ring-brand-500/5 transition-all">
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

            {error && (
              <p className="text-rose-500 text-xs font-bold text-center animate-shake">{error}</p>
            )}

            <button 
              type="submit"
              disabled={loading || !name || phoneNumber.length < 10}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Setup <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
