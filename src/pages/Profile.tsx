import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { AnimatePresence } from 'motion/react';
import { User, Mail, Shield, ShieldCheck, LogOut, Camera, ClipboardList } from 'lucide-react';
import { cn } from '../lib/utils';
import DriverVerificationSection from '../components/DriverVerificationSection';

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 pb-12">
      {/* Profile Card */}
      <div className="bg-white rounded-[2.5rem] p-10 card-shadow border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-48 h-48 bg-brand-50 rounded-full -ml-24 -mt-24 opacity-50 group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-accent-50 rounded-full -mr-16 -mb-16 opacity-50 group-hover:scale-110 transition-transform duration-700" />
        
        <div className="relative mb-6 z-10">
          <div className="w-32 h-32 rounded-[2rem] overflow-hidden ring-8 ring-slate-50 shadow-2xl relative group/avatar">
            <img 
              src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
              alt="Profile" 
              className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" 
            />
            <button className="absolute inset-0 bg-brand-600/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all cursor-pointer">
              <Camera className="w-8 h-8 text-white" />
            </button>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-xl border-4 border-white shadow-lg">
            <Shield className="w-4 h-4 text-white" />
          </div>
        </div>
        
        <div className="z-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{profile.displayName}</h2>
          <p className="text-slate-400 font-medium flex items-center gap-2 justify-center mb-10">
            <Mail className="w-4 h-4" />
            {profile.email}
          </p>
        </div>
        
        <div className="flex gap-4 w-full z-10">
          <div className="flex-1 bg-slate-50 p-6 rounded-3xl border border-slate-100 group/stat hover:bg-white hover:shadow-xl transition-all">
            <div className="text-3xl font-black text-slate-900 mb-1 group-hover:text-brand-600 transition-colors uppercase">{profile.totalRides || 0}</div>
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Total Trips</div>
          </div>
           <div className="flex-1 bg-slate-50 p-6 rounded-3xl border border-slate-100 group/stat hover:bg-white hover:shadow-xl transition-all">
            <div className="text-3xl font-black text-slate-900 mb-1 group-hover:text-accent-500 transition-colors uppercase">₹0</div>
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Earnings</div>
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
            className="px-5 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2 self-stretch sm:self-auto justify-center"
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
        className="w-full p-6 bg-slate-50 text-slate-400 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all mb-10 group"
      >
        <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        Sign Out Securely
      </button>
    </div>
  );
}
