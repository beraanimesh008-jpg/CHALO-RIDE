/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QrCode, Smartphone, Landmark, Banknote, ShieldCheck, CheckCircle2, Loader2, X } from 'lucide-react';
import { rechargeDriverWallet } from '../lib/commissionService';
import { formatCurrency, cn } from '../lib/utils';

interface CommissionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  currentBalance: number;
  onPaymentSuccess: (newBalance: number) => void;
}

export default function CommissionPaymentModal({
  isOpen,
  onClose,
  driverId,
  driverName,
  currentBalance,
  onPaymentSuccess
}: CommissionPaymentModalProps) {
  const [amount, setAmount] = useState<number>(200);
  const [method, setMethod] = useState<'UPI' | 'NET_BANKING' | 'CASH'>('UPI');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePay = async () => {
    if (amount <= 0) return;
    setProcessing(true);

    try {
      // Simulate real-time gateway verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      const result = await rechargeDriverWallet(driverId, driverName, amount, method);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onPaymentSuccess(result.newBalance);
          setSuccess(false);
          onClose();
        }, 1200);
      } else {
        alert('Failed to process wallet payment. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Payment processing error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative border border-slate-100 overflow-hidden">
        <button
          onClick={onClose}
          disabled={processing}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Recharge Successful!</h3>
            <p className="text-xs font-semibold text-slate-500">
              {formatCurrency(amount)} added to your ChaLo Driver Wallet.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3.5 bg-brand-50 text-brand-600 rounded-2xl shadow-sm">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">Driver Wallet Recharge</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  ChaLo Commission Hub
                </p>
              </div>
            </div>

            {/* Current Balance Banner */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Balance</div>
                <div className={cn(
                  "text-xl font-black",
                  currentBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {formatCurrency(currentBalance)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Commission Rate</div>
                <div className="text-xs font-black text-slate-700">10% per ride</div>
              </div>
            </div>

            {/* Quick Amount Selection */}
            <div className="mb-6">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Select Recharge Amount
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[100, 200, 500, 1000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={cn(
                      "py-2.5 rounded-xl font-black text-xs transition-all border",
                      amount === val
                        ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/20 scale-105"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min="50"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Enter custom amount"
              />
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'UPI', label: 'UPI / QR', icon: Smartphone },
                  { id: 'NET_BANKING', label: 'Net Banking', icon: Landmark },
                  { id: 'CASH', label: 'Hub Cash', icon: Banknote },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id as any)}
                    className={cn(
                      "p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all",
                      method === m.id
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated UPI Scan */}
            {method === 'UPI' && (
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 mb-6 flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-emerald-100">
                  <QrCode className="w-10 h-10 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-xs font-black text-slate-800">UPI ID: chalo.admin@upi</div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                    Instant Auto-Credit enabled for Sundarban drivers
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={processing || amount <= 0}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-brand-600/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authorizing {formatCurrency(amount)}...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Recharge {formatCurrency(amount)}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
