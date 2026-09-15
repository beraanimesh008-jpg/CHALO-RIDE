/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Ride, RideStatus } from '../types';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList,
  MapPin,
  Clock,
  IndianRupee,
  Navigation,
  Phone,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Car,
  ChevronRight,
  RotateCcw,
  X,
  Compass,
  Star,
  Bike
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import GoogleMapView, { MapCoords } from './GoogleMapView';
import { calculateRoute, RouteResult } from '../lib/googleRouting';
import { useServiceAreaPolygon } from '../lib/serviceArea';

interface MyBookingsSectionProps {
  onSwitchToBooking?: () => void;
  highlightRideId?: string | null;
}

type FilterTab = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

// Helper to format timestamps gracefully
function formatBookingTime(timestamp?: number): string {
  if (!timestamp) return 'Recently';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeStr}`;
}

// Status details helper with bilingual text and color themes
function getStatusBadgeConfig(status: RideStatus) {
  switch (status) {
    case RideStatus.SEARCHING:
      return {
        labelEn: 'Searching for Driver',
        labelBn: 'ড্রাইভার খোঁজা হচ্ছে',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        dotBg: 'bg-amber-500',
        icon: Loader2,
        isSpin: true,
        badgeType: 'active'
      };
    case RideStatus.NEGOTIATING:
      return {
        labelEn: 'Negotiating',
        labelBn: 'দরদাম চলছে',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        dotBg: 'bg-blue-500',
        icon: Clock,
        isSpin: false,
        badgeType: 'active'
      };
    case RideStatus.ACCEPTED:
      return {
        labelEn: 'Driver Accepted',
        labelBn: 'ড্রাইভার গ্রহণ করেছে',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        dotBg: 'bg-emerald-500',
        icon: CheckCircle2,
        isSpin: false,
        badgeType: 'active'
      };
    case RideStatus.ARRIVED:
      return {
        labelEn: 'Driver Arriving',
        labelBn: 'ড্রাইভার আসছে',
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        text: 'text-sky-800',
        dotBg: 'bg-sky-500',
        icon: Navigation,
        isSpin: false,
        badgeType: 'active'
      };
    case RideStatus.IN_PROGRESS:
      return {
        labelEn: 'Ride Started',
        labelBn: 'রাইড শুরু হয়েছে',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-800',
        dotBg: 'bg-indigo-500',
        icon: Compass,
        isSpin: false,
        badgeType: 'active'
      };
    case RideStatus.COMPLETED:
      return {
        labelEn: 'Ride Completed',
        labelBn: 'রাইড সম্পন্ন',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        dotBg: 'bg-emerald-600',
        icon: CheckCircle2,
        isSpin: false,
        badgeType: 'completed'
      };
    case RideStatus.CANCELLED:
    default:
      return {
        labelEn: 'Cancelled',
        labelBn: 'বাতিল',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-800',
        dotBg: 'bg-rose-500',
        icon: XCircle,
        isSpin: false,
        badgeType: 'cancelled'
      };
  }
}

export default function MyBookingsSection({ onSwitchToBooking, highlightRideId }: MyBookingsSectionProps) {
  const { profile } = useAuth();
  const serviceArea = useServiceAreaPolygon();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ACTIVE');
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);
  const [trackingRide, setTrackingRide] = useState<Ride | null>(null);
  const [trackingRoute, setTrackingRoute] = useState<RouteResult | null>(null);
  const [driverLiveLocation, setDriverLiveLocation] = useState<MapCoords | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Auto switch tab if a specific ride is highlighted
  useEffect(() => {
    if (highlightRideId && rides.length > 0) {
      const target = rides.find((r) => r.id === highlightRideId);
      if (target) {
        if (target.status === RideStatus.COMPLETED) {
          setActiveTab('COMPLETED');
        } else if (target.status === RideStatus.CANCELLED) {
          setActiveTab('CANCELLED');
        } else {
          setActiveTab('ACTIVE');
        }
      }
    }
  }, [highlightRideId, rides]);

  // 1. Real-time Firestore Listener for Logged-in User's Rides
  useEffect(() => {
    if (!profile?.uid) {
      setRides([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ridesQuery = query(
      collection(db, 'rides'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const userRides: Ride[] = [];
        snapshot.forEach((docSnap) => {
          userRides.push({ id: docSnap.id, ...docSnap.data() } as Ride);
        });

        // Client-side sort by newest first (descending timestamp)
        userRides.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRides(userRides);
        setLoading(false);

        // Keep active tracked ride synced in real-time if it's currently open
        if (trackingRide) {
          const updatedTracked = userRides.find((r) => r.id === trackingRide.id);
          if (updatedTracked) {
            setTrackingRide(updatedTracked);
          }
        }
      },
      (error) => {
        console.error('Error fetching user bookings:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid, trackingRide?.id]);

  // 2. Track assigned driver live location when tracking modal is open
  useEffect(() => {
    if (!trackingRide?.driverId) {
      setDriverLiveLocation(null);
      return;
    }

    const unsubDriver = onSnapshot(
      doc(db, 'users', trackingRide.driverId),
      (driverDoc) => {
        if (driverDoc.exists()) {
          const dData = driverDoc.data();
          if (dData.currentLocation) {
            setDriverLiveLocation({
              lat: dData.currentLocation.lat,
              lng: dData.currentLocation.lng
            });
          }
        }
      },
      (err) => console.warn('Driver live location listener error:', err)
    );

    return () => unsubDriver();
  }, [trackingRide?.driverId]);

  // 3. Compute route polyline for the tracking modal
  useEffect(() => {
    if (!trackingRide?.pickup || !trackingRide?.drop) {
      setTrackingRoute(null);
      return;
    }

    let isMounted = true;
    calculateRoute(
      { lat: trackingRide.pickup.lat, lng: trackingRide.pickup.lng },
      { lat: trackingRide.drop.lat, lng: trackingRide.drop.lng }
    ).then((route) => {
      if (isMounted) {
        setTrackingRoute(route);
      }
    }).catch((err) => {
      console.warn('Failed to calculate tracking route:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [trackingRide?.id]);

  // 4. Cancel Ride Action
  const handleCancelRide = async (rideId: string) => {
    setCancelError(null);
    setCancellingRideId(rideId);

    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: RideStatus.CANCELLED,
        updatedAt: Date.now()
      });
      setCancellingRideId(null);
      if (trackingRide?.id === rideId) {
        setTrackingRide(null);
      }
    } catch (err: any) {
      console.error('Error cancelling ride:', err);
      setCancelError(err?.message || 'Failed to cancel ride. / রাইড বাতিল করা যায়নি।');
      setCancellingRideId(null);
    }
  };

  // Status counts for tab badges
  const activeStatuses = [RideStatus.SEARCHING, RideStatus.NEGOTIATING, RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS];
  const activeCount = rides.filter((r) => activeStatuses.includes(r.status)).length;
  const completedCount = rides.filter((r) => r.status === RideStatus.COMPLETED).length;
  const cancelledCount = rides.filter((r) => r.status === RideStatus.CANCELLED).length;

  // Filtered list
  const filteredRides = rides.filter((r) => {
    if (activeTab === 'ACTIVE') return activeStatuses.includes(r.status);
    if (activeTab === 'COMPLETED') return r.status === RideStatus.COMPLETED;
    if (activeTab === 'CANCELLED') return r.status === RideStatus.CANCELLED;
    return true;
  });

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-5 pb-10">
      {/* Header & Title */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              My Bookings • আমার বুকিং
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Real-time status of your active and previous ride requests
          </p>
        </div>

        {onSwitchToBooking && (
          <button
            type="button"
            onClick={onSwitchToBooking}
            className="self-start sm:self-auto px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Car className="w-4 h-4" />
            <span>Book New Ride / নতুন রাইড বুকিং</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: 'ACTIVE', label: 'Active / সক্রিয়', count: activeCount },
          { key: 'COMPLETED', label: 'Completed / সম্পন্ন', count: completedCount },
          { key: 'CANCELLED', label: 'Cancelled / বাতিল', count: cancelledCount }
        ].map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as FilterTab)}
              className={cn(
                "px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 border",
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cancellation Error Banner */}
      {cancelError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-900 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{cancelError}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/90 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading your bookings / বুকিং লোড হচ্ছে...
          </span>
        </div>
      ) : filteredRides.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-10 sm:p-14 border border-slate-200/90 shadow-sm text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <ClipboardList className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="max-w-xs">
            <h3 className="text-base font-bold text-slate-900">
              {activeTab === 'ACTIVE'
                ? 'No Active Bookings • কোনো সক্রিয় বুকিং নেই'
                : activeTab === 'COMPLETED'
                ? 'No Completed Rides • কোনো সম্পন্ন রাইড নেই'
                : 'No Cancelled Rides • কোনো বাতিল রাইড নেই'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {activeTab === 'ACTIVE'
                ? 'When you request a ride, you can track driver arrival and live status here.'
                : activeTab === 'COMPLETED'
                ? 'Your completed rides history will be listed here.'
                : 'Any cancelled ride requests will appear here.'}
            </p>
          </div>
          {onSwitchToBooking && (
            <button
              type="button"
              onClick={onSwitchToBooking}
              className="mt-2 px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-lg shadow-brand-600/25 flex items-center gap-2 transition-all active:scale-95"
            >
              <Car className="w-4 h-4" />
              <span>Book a Ride Now / এখনই রাইড বুক করুন</span>
            </button>
          )}
        </div>
      ) : (
        /* Bookings List */
        <div className="space-y-4">
          {filteredRides.map((ride) => {
            const statusConfig = getStatusBadgeConfig(ride.status);
            const StatusIcon = statusConfig.icon;
            const isActive = activeStatuses.includes(ride.status);
            const canCancel = [RideStatus.SEARCHING, RideStatus.NEGOTIATING, RideStatus.ACCEPTED].includes(ride.status);
            const isHighlighted = highlightRideId === ride.id;

            return (
              <motion.div
                key={ride.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  "bg-white rounded-3xl border shadow-sm transition-all overflow-hidden",
                  isHighlighted ? "ring-2 ring-brand-500 border-brand-300" : "border-slate-200/90",
                  isActive ? "shadow-md hover:border-slate-300" : "hover:border-slate-300"
                )}
              >
                {/* Top Status Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    {/* Status Badge */}
                    <div
                      className={cn(
                        "px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold shrink-0",
                        statusConfig.bg,
                        statusConfig.border,
                        statusConfig.text
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full shrink-0", statusConfig.dotBg, isActive && "animate-ping")} />
                      <StatusIcon className={cn("w-3.5 h-3.5 shrink-0", statusConfig.isSpin && "animate-spin")} />
                      <span>{statusConfig.labelEn}</span>
                      <span className="opacity-70 font-medium">({statusConfig.labelBn})</span>
                    </div>

                    {/* Ride ID Tag */}
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200/80">
                      #CL-{ride.id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  {/* Booking Date & Time */}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatBookingTime(ride.createdAt)}</span>
                  </div>
                </div>

                {/* Main Card Body */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Route Timeline: Pickup & Drop */}
                  <div className="space-y-3 relative">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-200 pointer-events-none" />

                    {/* Pickup */}
                    <div className="flex items-start gap-3 relative">
                      <div className="w-6 h-6 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <div className="w-2 h-2 rounded-full bg-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                          Pickup • পিকআপ পয়েন্ট
                        </span>
                        <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                          {ride.pickup.address}
                        </p>
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="flex items-start gap-3 relative">
                      <div className="w-6 h-6 rounded-full bg-rose-50 border-2 border-rose-500 flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <MapPin className="w-3 h-3 text-rose-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                          Destination • গন্তব্য
                        </span>
                        <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                          {ride.drop.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid: Passengers, Distance, Fare, Payment */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 text-xs">
                    {/* Passengers */}
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3 h-3 text-brand-600" />
                        Passengers
                      </span>
                      <span className="text-sm font-black text-slate-900 mt-0.5">
                        {ride.passengerCount || 1} {(ride.passengerCount || 1) === 1 ? 'Person' : 'Persons'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {ride.passengerCount || 1} জন যাত্রী
                      </span>
                    </div>

                    {/* Distance */}
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-brand-600" />
                        Distance
                      </span>
                      <span className="text-sm font-black text-slate-900 mt-0.5">
                        {ride.distance || ride.routeDistanceKm || 0} km
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        দূরত্ব
                      </span>
                    </div>

                    {/* Final Fare */}
                    <div className="bg-brand-50/70 p-2.5 rounded-2xl border border-brand-100 flex flex-col">
                      <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1">
                        <IndianRupee className="w-3 h-3 text-brand-700" />
                        Final Fare
                      </span>
                      <span className="text-base font-black text-brand-900 mt-0.5">
                        ₹{ride.finalFare || ride.acceptedFare || ride.userOfferedFare || 0}
                      </span>
                      <span className="text-[9px] text-brand-600 font-medium">
                        {ride.baseFare !== undefined ? `Base ₹${ride.baseFare} + ₹${ride.passengerExtraCharge || 0}` : 'মোট ভাড়া'}
                      </span>
                    </div>

                    {/* Payment Method */}
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Payment Method
                      </span>
                      <span className="text-xs font-black text-slate-900 mt-0.5">
                        Cash on Trip
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        নগদ ক্যাশ
                      </span>
                    </div>
                  </div>

                  {/* Assigned Driver Card (If assigned) */}
                  {ride.driverId && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={ride.driverPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(ride.driverName || 'Driver')}&background=0D9488&color=fff`}
                          alt={ride.driverName || 'Driver'}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {ride.driverName || 'Assigned Driver'}
                            </span>
                            {ride.driverRating && (
                              <div className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200">
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                <span>{ride.driverRating}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <Bike className="w-3 h-3 text-slate-400" />
                            <span>{ride.bikeDetails?.model || 'Bike'} • {ride.bikeDetails?.number || 'Verified'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Call Button */}
                      {ride.driverPhone && (
                        <a
                          href={`tel:${ride.driverPhone}`}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
                          title="Call Driver"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Call Driver</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {/* Track Button (For active rides or completed inspection) */}
                      <button
                        type="button"
                        onClick={() => setTrackingRide(ride)}
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm",
                          isActive
                            ? "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        )}
                      >
                        <Navigation className="w-4 h-4" />
                        <span>{isActive ? 'Track Driver / ম্যাপে ট্র্যাক করুন' : 'View Route on Map / রুট দেখুন'}</span>
                      </button>
                    </div>

                    {/* Cancel Button (If active & cancellable) */}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to cancel this ride request? / আপনি কি সত্যিই এই রাইড রিকোয়েস্টটি বাতিল করতে চান?')) {
                            handleCancelRide(ride.id);
                          }
                        }}
                        disabled={cancellingRideId === ride.id}
                        className="px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {cancellingRideId === ride.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Cancel Ride / বাতিল করুন</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. REUSABLE LIVE GOOGLE MAP TRACKING MODAL (REUSING EXISTING GOOGLE MAP)  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {trackingRide && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-700">
                      Live Ride Tracking • লাইভ ট্র্যাকিং
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      #CL-{trackingRide.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5">
                    {getStatusBadgeConfig(trackingRide.status).labelEn} • {getStatusBadgeConfig(trackingRide.status).labelBn}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setTrackingRide(null)}
                  className="p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-500 border border-slate-200 transition-colors"
                  title="Close / বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Live Map Area (Reuses GoogleMapView with exact service area, polyline, and driver marker) */}
              <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-100">
                <GoogleMapView
                  center={
                    driverLiveLocation
                      ? driverLiveLocation
                      : { lat: trackingRide.pickup.lat, lng: trackingRide.pickup.lng }
                  }
                  zoom={13}
                  pickup={{ lat: trackingRide.pickup.lat, lng: trackingRide.pickup.lng }}
                  drop={{ lat: trackingRide.drop.lat, lng: trackingRide.drop.lng }}
                  servicePolygon={serviceArea.polygon}
                  isServiceAreaEnabled={serviceArea.enabled}
                  routePolyline={trackingRoute?.polylinePath || []}
                  drivers={
                    driverLiveLocation && trackingRide.driverId
                      ? [
                          {
                            id: trackingRide.driverId,
                            lat: driverLiveLocation.lat,
                            lng: driverLiveLocation.lng,
                            name: trackingRide.driverName || 'Driver',
                            model: trackingRide.bikeDetails?.model || 'Bike',
                            isOnline: true
                          }
                        ]
                      : []
                  }
                  disableProviderToggle={true}
                  showLegend={false}
                  interactive={true}
                  className="w-full h-full"
                />
              </div>

              {/* Modal Body: Addresses & Driver Details */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                {/* Route Summary */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Pickup</span>
                      <p className="font-bold text-slate-800 truncate">{trackingRide.pickup.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Drop</span>
                      <p className="font-bold text-slate-800 truncate">{trackingRide.drop.address}</p>
                    </div>
                  </div>
                </div>

                {/* Driver Info in Modal */}
                {trackingRide.driverId ? (
                  <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={trackingRide.driverPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(trackingRide.driverName || 'Driver')}&background=0D9488&color=fff`}
                        alt={trackingRide.driverName || 'Driver'}
                        className="w-12 h-12 rounded-2xl object-cover border border-emerald-200 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-slate-900">{trackingRide.driverName}</span>
                          {trackingRide.driverRating && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-500" />
                              {trackingRide.driverRating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">
                          {trackingRide.bikeDetails?.model || 'Bike'} • {trackingRide.bikeDetails?.number || 'Verified'}
                        </p>
                      </div>
                    </div>

                    {trackingRide.driverPhone && (
                      <a
                        href={`tel:${trackingRide.driverPhone}`}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 shrink-0"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                    <span>Searching nearby drivers in Pathar Pratima. You will be notified instantly when a driver accepts.</span>
                  </div>
                )}

                {/* Fare and Close */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Fare / মোট ভাড়া</span>
                    <span className="text-lg font-black text-slate-900">
                      ₹{trackingRide.finalFare || trackingRide.acceptedFare || trackingRide.userOfferedFare || 0}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTrackingRide(null)}
                    className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-95"
                  >
                    Close Tracking / বন্ধ করুন
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
