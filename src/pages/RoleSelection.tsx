/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { Bike, Users, ShieldCheck, ArrowRight, Sparkles, MapPin, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export default function RoleSelection() {
  const navigate = useNavigate();
  const { loginWithDemo } = useAuth();
  const [loadingRole, setLoadingRole] = React.useState<UserRole | null>(null);

  const handleQuickDemo = async (role: UserRole, targetRoute: string) => {
    setLoadingRole(role);
    try {
      await loginWithDemo(role);
      navigate(targetRoute);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-4 md:p-8 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-accent-500/10 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full flex flex-col items-center text-center relative z-10"
      >
        {/* Brand Icon & Heading */}
        <div className="inline-flex p-4 bg-brand-600 rounded-3xl shadow-2xl shadow-brand-500/30 mb-6">
          <Bike className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-none mb-3">
          Cha<span className="text-brand-500">Lo</span>
        </h1>
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs md:text-sm mb-2">
          Pathar Pratima • Sundarban Bike Taxi Network
        </p>
        <p className="text-slate-500 text-sm max-w-md mb-10">
          Direct peer-to-peer fare negotiation with real-time tracking across rural river hubs and railway connections.
        </p>

        {/* 3 Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-10 text-left">
          {/* Passenger Portal */}
          <div className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-[2.5rem] p-7 transition-all flex flex-col justify-between group hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-500/10">
            <div>
              <div className="p-4 bg-brand-500/10 text-brand-400 rounded-2xl w-fit mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-1">
                Passenger / আরোহী
              </div>
              <h3 className="text-xl font-black text-white mb-2">Book a Ride</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                Request local bike rides, set your own offered fare, and pick the best driver deal.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleQuickDemo(UserRole.USER, '/')}
                disabled={loadingRole !== null}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loadingRole === UserRole.USER ? 'Launching...' : 'Test Passenger'}</span>
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2.5 rounded-2xl font-bold text-xs uppercase transition-colors text-center"
              >
                Sign In with Google
              </button>
            </div>
          </div>

          {/* Driver Portal */}
          <div className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-[2.5rem] p-7 transition-all flex flex-col justify-between group hover:border-accent-500 hover:shadow-2xl hover:shadow-accent-500/10">
            <div>
              <div className="p-4 bg-accent-500/10 text-accent-400 rounded-2xl w-fit mb-5 group-hover:scale-110 transition-transform">
                <Bike className="w-7 h-7" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-accent-400 mb-1">
                Driver / চালক পোর্টাল
              </div>
              <h3 className="text-xl font-black text-white mb-2">Drive & Earn</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                Receive instant passenger alerts, counter-bid fares, manage 10% commission wallet, and navigate routes.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleQuickDemo(UserRole.DRIVER, '/dashboard')}
                disabled={loadingRole !== null}
                className="w-full bg-accent-500 hover:bg-accent-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loadingRole === UserRole.DRIVER ? 'Launching...' : 'Test Driver'}</span>
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2.5 rounded-2xl font-bold text-xs uppercase transition-colors text-center"
              >
                Driver Sign In
              </button>
            </div>
          </div>

          {/* Admin Command Center */}
          <div className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-[2.5rem] p-7 transition-all flex flex-col justify-between group hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/10">
            <div>
              <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit mb-5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                Admin / অ্যাডমিন কন্ট্রোল
              </div>
              <h3 className="text-xl font-black text-white mb-2">Admin Panel</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                Complete 12-section operations center: Live Driver Map, Wallets, Service Area geofences, Coupons, & Support.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleQuickDemo(UserRole.ADMIN, '/admin')}
                disabled={loadingRole !== null}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loadingRole === UserRole.ADMIN ? 'Launching...' : 'Test Admin'}</span>
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2.5 rounded-2xl font-bold text-xs uppercase transition-colors text-center"
              >
                Admin Google Login
              </button>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-3 gap-6 max-w-lg w-full border-t border-slate-800 pt-8">
          <div className="flex flex-col items-center gap-1">
            <MapPin className="w-5 h-5 text-brand-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pathar Pratima</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Instant Bidding</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">10% Commission</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
