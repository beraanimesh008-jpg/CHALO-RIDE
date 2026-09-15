/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  IndianRupee, 
  ArrowUpRight, 
  CreditCard,
  Percent,
  Clock,
  MapPin,
  Users
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Ride, RideStatus, UserProfile, CommissionTransaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import CommissionPaymentModal from './CommissionPaymentModal';
import { DEFAULT_COMMISSION_BLOCK_LIMIT } from '../lib/commissionService';

interface DriverTodayEarningsProps {
  driverId: string;
  driverName: string;
}

export default function DriverTodayEarnings({ driverId, driverName }: DriverTodayEarningsProps) {
  const [driverProfile, setDriverProfile] = useState<UserProfile | null>(null);
  const [todayRides, setTodayRides] = useState<Ride[]>([]);
  const [todayCommissionPaid, setTodayCommissionPaid] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    // 1. Listen to Driver Profile
    const userRef = doc(db, 'users', driverId);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setDriverProfile(snap.data() as UserProfile);
      }
    });

    // 2. Fetch today's completed rides
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();

    const ridesQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId),
      where('status', '==', RideStatus.COMPLETED)
    );

    const unsubRides = onSnapshot(ridesQuery, (snap) => {
      const completed: Ride[] = [];
      snap.docs.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Ride;
        const time = data.updatedAt || data.createdAt || 0;
        if (time >= todayTimestamp) {
          completed.push(data);
        }
      });
      completed.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setTodayRides(completed);
      setLoading(false);
    });

    // 3. Fetch today's commission payments via Cashfree
    const txQuery = query(
      collection(db, 'commission_transactions'),
      where('driverId', '==', driverId),
      where('type', '==', 'COMMISSION_PAYMENT')
    );

    const unsubTx = onSnapshot(txQuery, (snap) => {
      let paidToday = 0;
      snap.docs.forEach((d) => {
        const tx = d.data() as CommissionTransaction;
        if (tx.timestamp >= todayTimestamp && tx.status === 'COMPLETED') {
          paidToday += tx.amount;
        }
      });
      setTodayCommissionPaid(paidToday);
    });

    return () => {
      unsubUser();
      unsubRides();
      unsubTx();
    };
  }, [driverId]);

  // Aggregate Calculations
  const todayCompletedCount = todayRides.length;
  const todayTotalRideFare = todayRides.reduce((sum, r) => sum + (r.finalFare || r.acceptedFare || r.userOfferedFare || 0), 0);
  const todayCommission = todayRides.reduce((sum, r) => sum + (r.commissionAmount || Math.round((r.finalFare || r.acceptedFare || r.userOfferedFare || 0) * 0.10)), 0);
  const currentCommissionDue = driverProfile?.commissionBalance ?? 0;
  const commissionBlockLimit = driverProfile?.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT;
  const todayNetEarnings = todayTotalRideFare - todayCommission;

  return (
    <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Today's Earnings
              <span className="text-xs font-bold text-slate-400">/ আজকের আয়</span>
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              Live summary of today's completed rides, fare collected & 10% commission
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <CreditCard className="w-4 h-4" />
          <span>Pay Commission / কমিশন পরিশোধ</span>
        </button>
      </div>

      {/* 5 Core Metrics Cards (Requirement 10) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Today's Completed Rides */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Completed Rides
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {todayCompletedCount}
          </div>
          <div className="text-[10px] text-brand-600 font-bold mt-1">
            Trips completed today
          </div>
        </div>

        {/* 2. Today's Total Ride Fare */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Total Ride Fare
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(todayTotalRideFare)}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            Gross passenger fare
          </div>
        </div>

        {/* 3. Today's Commission (10%) */}
        <div className="bg-brand-50/50 p-4 rounded-2xl border border-brand-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-brand-800 mb-1">
            Today's Commission (10%)
          </div>
          <div className="text-2xl font-black text-brand-700 tracking-tight">
            {formatCurrency(todayCommission)}
          </div>
          <div className="text-[10px] text-brand-600 font-bold mt-1">
            Payable to ChaLo
          </div>
        </div>

        {/* 4. Today's Commission Paid */}
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-1">
            Commission Paid Today
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {formatCurrency(todayCommissionPaid)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">
            Via Cashfree
          </div>
        </div>

        {/* 5. Today's Commission Due */}
        <div className={cn(
          "p-4 rounded-2xl border",
          currentCommissionDue >= commissionBlockLimit ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-100"
        )}>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Current Commission Due
          </div>
          <div className={cn(
            "text-2xl font-black tracking-tight",
            currentCommissionDue >= commissionBlockLimit ? "text-rose-600" : "text-slate-900"
          )}>
            {formatCurrency(currentCommissionDue)}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            Block limit: ₹{commissionBlockLimit}
          </div>
        </div>
      </div>

      {/* Net Take-Home Statement */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Net Estimated Take-Home Earnings (Today)
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            {formatCurrency(todayNetEarnings)}
          </div>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Customer's payment remains with you. The 10% commission ({formatCurrency(todayCommission)}) is tracked separately.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Ride Access Status</span>
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-black uppercase inline-block",
            currentCommissionDue >= commissionBlockLimit
              ? "bg-rose-500 text-white"
              : "bg-emerald-500 text-white"
          )}>
            {currentCommissionDue >= commissionBlockLimit ? 'BLOCKED' : 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Today's Completed Trips List */}
      <div>
        <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-600" />
          Today's Completed Trips ({todayCompletedCount})
        </h4>

        {todayRides.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-slate-100">
            No completed rides yet today. Completed trips will appear here with 10% commission breakdowns.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
            {todayRides.map((ride) => {
              const fare = ride.finalFare || ride.acceptedFare || ride.userOfferedFare || 0;
              const comm = ride.commissionAmount || Math.round(fare * 0.10);
              const time = new Date(ride.updatedAt || ride.createdAt || Date.now());

              return (
                <div key={ride.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        #{ride.id.slice(0, 8)}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {ride.userName || 'Passenger'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>Pickup: {ride.pickup?.address?.slice(0, 30)}...</span>
                      <span>→</span>
                      <span>Drop: {ride.drop?.address?.slice(0, 30)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{formatCurrency(fare)}</div>
                      <div className="text-[10px] text-brand-700 font-bold">
                        10% Comm: ₹{comm}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200">
                      Completed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommissionPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        driverId={driverId}
        driverName={driverName}
        commissionDue={currentCommissionDue}
        commissionBlockLimit={commissionBlockLimit}
      />
    </div>
  );
}
