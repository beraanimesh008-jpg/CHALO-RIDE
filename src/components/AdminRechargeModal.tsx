/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  X, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Info,
  UserCheck
} from 'lucide-react';
import { processAdminManualRecharge, DEFAULT_COMMISSION_BLOCK_LIMIT } from '../lib/commissionService';
import { formatCurrency, cn } from '../lib/utils';
import { UserProfile } from '../types';

interface AdminRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: UserProfile | null;
  adminId: string;
  adminEmail?: string;
  onSuccess?: () => void;
}

export default function AdminRechargeModal({
  isOpen,
  onClose,
  driver,
  adminId,
  adminEmail,
  onSuccess
}: AdminRechargeModalProps) {
  const [rechargeAmount, setRechargeAmount] = useState<string>('100');
  const [note, setNote] = useState<string>('Admin manual cash collection / credit adjustment');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    amount: number;
    previousDue: number;
    remainingDue: number;
    isBlocked: boolean;
    isAdminSuspended: boolean;
  } | null>(null);

  // Commission details
  const currentCommissionDue = driver?.commissionBalance ?? 0;
  const blockLimit = driver?.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT;
  const isAdminSuspended = driver?.adminRideAccess === 'SUSPENDED';

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessResult(null);
      // Default to either current due or 100
      if (currentCommissionDue > 0) {
        setRechargeAmount(Math.min(currentCommissionDue, 100).toString());
      } else {
        setRechargeAmount('100');
      }
    }
  }, [isOpen, currentCommissionDue]);

  if (!isOpen || !driver) return null;

  const numericAmount = parseFloat(rechargeAmount) || 0;
  const projectedRemainingDue = Math.max(0, currentCommissionDue - numericAmount);
  const projectedIsCommissionBlocked = projectedRemainingDue >= blockLimit;
  const projectedCanReceiveRides = !projectedIsCommissionBlocked && !isAdminSuspended;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await processAdminManualRecharge({
        driverId: driver.uid,
        driverName: driver.displayName || 'Driver',
        amount: numericAmount,
        adminId,
        adminEmail,
        note
      });

      if (res.success) {
        setSuccessResult({
          amount: numericAmount,
          previousDue: res.previousDue,
          remainingDue: res.remainingDue,
          isBlocked: res.isBlocked,
          isAdminSuspended: res.isAdminSuspended
        });
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Failed to adjust driver balance');
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred during adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-brand-50 rounded-2xl text-brand-600 border border-brand-100">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Admin Manual Recharge
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              ম্যানুয়াল ড্রাইভার ব্যালেন্স রিচার্জ • No Payment Gateway
            </p>
          </div>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="space-y-6 py-2">
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-200 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-black text-emerald-950">
                Recharge Successful!
              </h4>
              <p className="text-xs font-semibold text-emerald-800">
                The driver's commission balance has been updated immediately.
              </p>

              <div className="bg-white/80 rounded-2xl p-4 text-left space-y-2.5 border border-emerald-100 text-xs font-bold mt-4">
                <div className="flex justify-between text-slate-600">
                  <span>Driver Name:</span>
                  <span className="text-slate-900 font-black">{driver.displayName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Commission Credited:</span>
                  <span className="text-emerald-600 font-black">+₹{successResult.amount}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Previous Due:</span>
                  <span className="text-slate-800 font-mono">₹{successResult.previousDue}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Remaining Commission Due:</span>
                  <span className="text-brand-700 font-black font-mono text-sm">₹{successResult.remainingDue}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span>Ride Access Status:</span>
                  {successResult.isAdminSuspended ? (
                    <span className="px-2.5 py-1 bg-rose-100 text-rose-700 font-black text-[10px] rounded-full uppercase">
                      SUSPENDED by Admin
                    </span>
                  ) : successResult.isBlocked ? (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-black text-[10px] rounded-full uppercase">
                      BLOCKED (Due ≥ ₹{blockLimit})
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-black text-[10px] rounded-full uppercase flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> ACTIVE / New Rides Allowed
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl transition-all shadow-md active:scale-95"
            >
              Done / বন্ধ করুন
            </button>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Driver Info Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900">{driver.displayName}</div>
                  <div className="text-[11px] text-slate-500 font-semibold font-mono">
                    {driver.phoneNumber || driver.driverMobile || 'No phone'} • {driver.bikeDetails?.number || 'No bike details'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Current Due
                  </span>
                  <span className={cn(
                    "text-lg font-black font-mono",
                    currentCommissionDue >= blockLimit ? "text-rose-600" : "text-slate-800"
                  )}>
                    -₹{currentCommissionDue}
                  </span>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 text-[10px] font-bold">
                <span className="text-slate-500">Block Threshold: ₹{blockLimit}</span>
                <span className="text-slate-300">•</span>
                {isAdminSuspended ? (
                  <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    Admin Ride Access: SUSPENDED
                  </span>
                ) : currentCommissionDue >= blockLimit ? (
                  <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    Ride Access: BLOCKED (Limit Exceeded)
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Ride Access: ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Recharge Amount Input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Recharge Amount (₹) / রিচার্জের পরিমাণ
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="Enter amount (e.g. 100)"
                  className="w-full pl-9 pr-4 py-3.5 bg-white border-2 border-slate-200 focus:border-brand-500 rounded-2xl font-black text-slate-900 text-lg outline-none transition-all shadow-sm"
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-4 gap-2 mt-2.5">
                {[50, 100, 200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRechargeAmount(amt.toString())}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black border transition-all",
                      numericAmount === amt 
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    ₹{amt}
                  </button>
                ))}
                {currentCommissionDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setRechargeAmount(currentCommissionDue.toString())}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black border transition-all",
                      numericAmount === currentCommissionDue
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                    )}
                  >
                    Full Due
                  </button>
                )}
              </div>
            </div>

            {/* Note / Remarks */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Audit Note / মন্তব্য (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Cash collected in office"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-brand-500 transition-all"
              />
            </div>

            {/* Projected Outcome Summary */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Commission Paid / Credited:</span>
                <span className="text-emerald-600 font-black">+{formatCurrency(numericAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Remaining Commission Due:</span>
                <span className="text-slate-900 font-black font-mono">
                  {formatCurrency(projectedRemainingDue)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-bold">
                <span className="text-slate-600">Projected Ride Access:</span>
                {isAdminSuspended ? (
                  <span className="text-rose-600 font-black text-[10px]">
                    Remains SUSPENDED by Admin
                  </span>
                ) : projectedCanReceiveRides ? (
                  <span className="text-emerald-700 font-black text-[10px] bg-emerald-50 px-2 py-0.5 rounded">
                    ACTIVE (Can Receive Rides)
                  </span>
                ) : (
                  <span className="text-rose-600 font-black text-[10px] bg-rose-50 px-2 py-0.5 rounded">
                    STILL BLOCKED (Due ≥ ₹{blockLimit})
                  </span>
                )}
              </div>
            </div>

            {isAdminSuspended && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Notice: This driver was manually suspended by Admin. Recharging clears the commission balance, but ride access will remain <strong>SUSPENDED</strong> until you click "Allow New Rides".
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all"
              >
                Cancel / বাতিল
              </button>
              <button
                type="submit"
                disabled={loading || numericAmount <= 0}
                className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit Recharge / রিচার্জ সাবমিট করুন</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
