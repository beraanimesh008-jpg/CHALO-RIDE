/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  History, 
  MapPin, 
  Users, 
  Calendar, 
  Clock, 
  IndianRupee, 
  CheckCircle2, 
  XCircle, 
  Navigation, 
  CreditCard,
  Percent,
  Search,
  Filter
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ride, RideStatus } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DriverRideHistoryProps {
  driverId: string;
}

export default function DriverRideHistory({ driverId }: DriverRideHistoryProps) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      // Sort newest first
      allRides.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRides(allRides);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching driver ride history:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [driverId]);

  const filteredRides = rides.filter(ride => {
    if (filter === 'COMPLETED') return ride.status === RideStatus.COMPLETED;
    if (filter === 'CANCELLED') return ride.status === RideStatus.CANCELLED;
    return true;
  });

  return (
    <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Ride History
              <span className="text-xs font-bold text-slate-400">/ রাইড হিস্ট্রি</span>
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              Previous ride requests, fares earned and 10% commission deductions
            </p>
          </div>
        </div>

        {/* Filter Chips: All, Completed, Cancelled */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-center">
          {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                filter === tab
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {tab === 'ALL' ? 'All / সব' : tab === 'COMPLETED' ? 'Completed / সম্পন্ন' : 'Cancelled / বাতিল'}
            </button>
          ))}
        </div>
      </div>

      {/* Ride Cards List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold">
          Loading previous ride records...
        </div>
      ) : filteredRides.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold">
          {filter === 'ALL' 
            ? "No ride history found. Completed trips will appear here." 
            : `No ${filter.toLowerCase()} rides found.`}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRides.map((ride) => {
            const fare = ride.finalFare || ride.acceptedFare || ride.userOfferedFare || 0;
            const commission = ride.commissionAmount || Math.round(fare * 0.10);
            const rideDate = new Date(ride.createdAt || Date.now());

            return (
              <div 
                key={ride.id}
                className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all card-shadow flex flex-col gap-4"
              >
                {/* Top bar: Ride ID, Status, Date & Time */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                      #{ride.id.slice(0, 8)}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Customer: {ride.userName || 'Passenger'}
                    </span>
                    {ride.userPhone && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({ride.userPhone})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{rideDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <Clock className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                      <span>{rideDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border",
                      ride.status === RideStatus.COMPLETED
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : ride.status === RideStatus.CANCELLED
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-blue-100 text-blue-800 border-blue-300"
                    )}>
                      {ride.status}
                    </span>
                  </div>
                </div>

                {/* Middle: Pickup and Drop Locations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 mt-1 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pickup</span>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{ride.pickup?.address || 'Pickup location'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20 mt-1 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Destination</span>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{ride.drop?.address || 'Drop-off location'}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom: Metrics Grid (Passenger count, Distance, Fare, Payment Method, 10% Commission) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-200/60 bg-white p-3 rounded-xl">
                  {/* Passenger count */}
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Passengers</span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      {ride.passengerCount || 1} Person
                    </span>
                  </div>

                  {/* Distance */}
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Distance</span>
                    <span className="text-xs font-bold text-slate-700">
                      {ride.routeDistanceKm ? `${ride.routeDistanceKm.toFixed(1)} km` : ride.distance || 'N/A'}
                    </span>
                  </div>

                  {/* Final Fare */}
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Final Fare</span>
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(fare)}
                    </span>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Payment</span>
                    <span className="text-xs font-bold text-slate-700">
                      {ride.paymentMethod || 'Cash / নগদ'}
                    </span>
                  </div>

                  {/* 10% Commission */}
                  <div>
                    <span className="text-[9px] font-black uppercase text-brand-700 block">10% Commission</span>
                    <span className={cn(
                      "text-xs font-black",
                      ride.status === RideStatus.COMPLETED ? "text-brand-700" : "text-slate-400"
                    )}>
                      {ride.status === RideStatus.COMPLETED ? `₹${commission}` : '₹0 (Cancelled)'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
