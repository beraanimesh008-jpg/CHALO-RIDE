/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wallet, ArrowDownRight, ArrowUpRight, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { DriverWallet, CommissionTransaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import CommissionPaymentModal from './CommissionPaymentModal';

interface DriverCommissionWalletProps {
  driverId: string;
  driverName: string;
}

export default function DriverCommissionWallet({ driverId, driverName }: DriverCommissionWalletProps) {
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    // Listen to wallet doc
    const walletRef = doc(db, 'wallets', driverId);
    const unsubWallet = onSnapshot(walletRef, (snap) => {
      if (snap.exists()) {
        setWallet(snap.data() as DriverWallet);
      } else {
        // Fallback default
        setWallet({
          driverId,
          driverName,
          balance: 200,
          totalEarned: 0,
          totalCommissionPaid: 0,
          pendingCommission: 0,
          isBlocked: false,
          updatedAt: Date.now()
        });
      }
      setLoading(false);
    });

    // Listen to commission transactions
    const txQuery = query(
      collection(db, 'commission_transactions'),
      where('driverId', '==', driverId),
      limit(20)
    );
    const unsubTx = onSnapshot(txQuery, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionTransaction));
      items.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(items);
    });

    return () => {
      unsubWallet();
      unsubTx();
    };
  }, [driverId, driverName]);

  const balance = wallet?.balance ?? 200;
  const isLowBalance = balance < 50;
  const isBlocked = balance < -100;

  return (
    <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Driver Wallet & Commission</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              10% Automatic Platform Commission
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/25 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Recharge</span>
        </button>
      </div>

      {/* Warning if balance is low or negative */}
      {isBlocked ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            Your wallet balance is below -₹100. New ride requests are temporarily paused. Please recharge now to continue accepting rides.
          </div>
        </div>
      ) : isLowBalance ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-bold">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            Your wallet balance is low ({formatCurrency(balance)}). Recharge now to prevent ride disruptions.
          </div>
        </div>
      ) : null}

      {/* Balance Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cn(
          "p-5 rounded-2xl border",
          balance >= 0 ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
        )}>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Wallet Balance
          </div>
          <div className={cn(
            "text-2xl font-black tracking-tight",
            balance >= 0 ? "text-emerald-700" : "text-rose-600"
          )}>
            {formatCurrency(balance)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Available for deductions</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Net Earnings
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(wallet?.totalEarned ?? 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Take-home earnings</div>
        </div>

        <div className="p-5 rounded-2xl bg-brand-50/40 border border-brand-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Commission Paid (10%)
          </div>
          <div className="text-2xl font-black text-brand-700 tracking-tight">
            {formatCurrency(wallet?.totalCommissionPaid ?? 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Platform service fee</div>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-700">
            Recent Wallet Activity
          </div>
          <span className="text-[10px] text-slate-400 font-bold">
            {transactions.length} Records
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto rounded-2xl border border-slate-100">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
              No recent commission transactions.
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    tx.type === 'WALLET_RECHARGE' ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"
                  )}>
                    {tx.type === 'WALLET_RECHARGE' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {tx.type === 'WALLET_RECHARGE' ? 'Wallet Recharge' : 'Ride Commission (10%)'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(tx.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} • {tx.paymentMethod || 'AUTO'}
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "text-xs font-black",
                  tx.type === 'WALLET_RECHARGE' ? "text-emerald-600" : "text-slate-800"
                )}>
                  {tx.type === 'WALLET_RECHARGE' ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CommissionPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        driverId={driverId}
        driverName={driverName}
        currentBalance={balance}
        onPaymentSuccess={(newBal) => {
          if (wallet) setWallet({ ...wallet, balance: newBal });
        }}
      />
    </div>
  );
}
