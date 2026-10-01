/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Ride } from '../types';
import {
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Volume2,
  Navigation,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  startRideAlertSoundAndVibration,
  stopRideAlertSoundAndVibration,
  triggerBackgroundRideNotification
} from '../lib/rideAlertService';

interface NewRideAlertModalProps {
  ride: Ride | null;
  onAccept: (ride: Ride) => void;
  onReject: (ride: Ride) => void;
  isAccepting?: boolean;
  timeoutSeconds?: number;
}

export default function NewRideAlertModal({
  ride,
  onAccept,
  onReject,
  isAccepting = false,
  timeoutSeconds = 45
}: NewRideAlertModalProps) {
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);

  // Sound, vibration and background notification lifecycle
  useEffect(() => {
    if (!ride) {
      stopRideAlertSoundAndVibration();
      return;
    }

    // Reset countdown timer
    setTimeLeft(timeoutSeconds);

    // Start loud ringtone & device vibration
    startRideAlertSoundAndVibration();

    // If app is in background, trigger push notification
    if (typeof document !== 'undefined' && document.hidden) {
      triggerBackgroundRideNotification(ride);
    }

    // Countdown interval
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopRideAlertSoundAndVibration();
          onReject(ride);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      stopRideAlertSoundAndVibration();
    };
  }, [ride?.id]);

  if (!ride) return null;

  const fare = ride.finalFare || ride.acceptedFare || ride.userOfferedFare || 0;
  const commission = Math.round(fare * 0.1);
  const netEarnings = Math.max(0, fare - commission);
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / timeoutSeconds) * 100));

  const handleAcceptClick = () => {
    stopRideAlertSoundAndVibration();
    onAccept(ride);
  };

  const handleRejectClick = () => {
    stopRideAlertSoundAndVibration();
    onReject(ride);
  };

  const openGoogleMaps = (lat?: number, lng?: number) => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Background Pulse Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative border-2 border-emerald-500/40 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Animated Timeout Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 relative overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-1000 ease-linear",
              timeLeft > 15 ? "bg-emerald-500" : timeLeft > 7 ? "bg-amber-500" : "bg-rose-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/30 animate-bounce">
                  <Volume2 className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-300" />
                </span>
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-800/60 border border-white/20 text-[10px] font-black uppercase tracking-widest text-emerald-100 inline-block mb-1">
                  Incoming Booking • নতুন রাইড
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  NEW RIDE REQUEST!
                </h2>
                <p className="text-xs text-emerald-100/90 font-medium">
                  নতুন রাইড এসেছে • এখনই বুকিং গ্রহণ করুন
                </p>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex flex-col items-center bg-black/25 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/20 shrink-0">
              <div className="flex items-center gap-1 text-xs font-black">
                <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                <span className={cn(
                  "font-mono text-base font-black",
                  timeLeft <= 10 ? "text-amber-300 animate-pulse" : "text-white"
                )}>
                  {timeLeft}s
                </span>
              </div>
              <span className="text-[9px] font-bold text-emerald-200 uppercase tracking-wider">
                Timeout
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Fare Banner */}
          <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block">
                Total Ride Fare / মোট ভাড়া
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-950 tracking-tight">
                {formatCurrency(fare)}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                Net Take-Home: <strong>{formatCurrency(netEarnings)}</strong> (10% Comm: {formatCurrency(commission)})
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl border border-emerald-200 text-slate-800 text-xs font-bold shadow-sm">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>{ride.passengerCount || 1} Passenger{(ride.passengerCount || 1) > 1 ? 's' : ''}</span>
              </div>
              {(ride.routeDistanceKm || ride.distance) && (
                <div className="text-[11px] font-black text-slate-500 mt-1">
                  Distance: {ride.routeDistanceKm || ride.distance} KM
                </div>
              )}
            </div>
          </div>

          {/* Pickup & Destination Route Card */}
          <div className="bg-slate-50 rounded-3xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
            {/* Pickup */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Pickup Location / যাত্রী উঠার স্থান
                  </span>
                  {ride.pickup?.lat && (
                    <button
                      type="button"
                      onClick={() => openGoogleMaps(ride.pickup.lat, ride.pickup.lng)}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Map
                    </button>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5 break-words">
                  {ride.pickup?.address || 'Pickup point specified'}
                </p>
              </div>
            </div>

            {/* Connecting Line */}
            <div className="w-0.5 h-4 bg-slate-300 ml-4 border-l-2 border-dashed border-slate-400" />

            {/* Destination */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                    Destination / গন্তব্যস্থল
                  </span>
                  {ride.drop?.lat && (
                    <button
                      type="button"
                      onClick={() => openGoogleMaps(ride.drop.lat, ride.drop.lng)}
                      className="text-[10px] font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Map
                    </button>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5 break-words">
                  {ride.drop?.address || 'Destination specified'}
                </p>
              </div>
            </div>
          </div>

          {/* Passenger Info Card */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <img
                src={ride.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(ride.userName || 'Rider')}`}
                alt={ride.userName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <div className="text-xs font-black text-slate-900">{ride.userName || 'Local Passenger'}</div>
                <div className="text-[11px] text-slate-500 font-medium">Verified Chalo Rider</div>
              </div>
            </div>

            {ride.userPhone && (
              <a
                href={`tel:${ride.userPhone}`}
                className="p-2.5 bg-white text-slate-700 hover:text-emerald-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                title="Call Passenger"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px]">Call</span>
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons: Accept & Reject */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          {/* Reject Button */}
          <button
            type="button"
            onClick={handleRejectClick}
            disabled={isAccepting}
            className="sm:w-1/3 py-4 px-4 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border-2 border-slate-200 hover:border-rose-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 order-2 sm:order-1"
          >
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Reject / বাদ দিন</span>
          </button>

          {/* Accept Button */}
          <button
            type="button"
            onClick={handleAcceptClick}
            disabled={isAccepting}
            className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-xl shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 ring-4 ring-emerald-500/20 order-1 sm:order-2"
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Accepting Ride...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Accept Ride / রাইড গ্রহণ করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
