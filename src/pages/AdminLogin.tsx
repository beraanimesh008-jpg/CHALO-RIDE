/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ShieldCheck, Lock, User, AlertCircle, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdminWithCredentials } = useAuth();
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminId.trim() || !password.trim()) {
      setError('Please enter both Admin ID/Email and Password.');
      return;
    }

    setLoading(true);
    try {
      await loginAdminWithCredentials(adminId.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      console.error('Admin authentication error:', err);
      // Requirement 15: If Admin credentials are incorrect, show exact message
      setError('Invalid Admin ID or Password.\nভুল Admin ID অথবা Password।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-8 md:p-10 relative z-10 flex flex-col">
        {/* Back to Portal selection */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 mb-6 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Portals / সমস্ত পোর্টাল</span>
        </Link>

        {/* Shield Icon Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            ChaLo Sundarban System
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Admin Login
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            অ্যাডমিন প্যানেল লগইন • Governance & Operations
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="w-full p-4 mb-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-left animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 font-bold leading-relaxed whitespace-pre-line">
              {error}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
              Admin ID or Email / অ্যাডমিন আইডি
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
                disabled={loading}
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
              Password / পাসওয়ার্ড
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
                className="w-full pl-10 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Sign In as Admin / অ্যাডমিন লগইন</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Protected Admin Gateway • ChaLo Pathar Pratima
          </p>
        </div>
      </div>
    </div>
  );
}
