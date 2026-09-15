/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Ride, RideStatus } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Navigation, Phone, CheckCircle, Flag, MapPin, IndianRupee, ShieldAlert, ArrowRight } from 'lucide-react';
import { recordCompletedRideCommission } from '../lib/commissionService';
import { formatCurrency, cn } from '../lib/utils';
import GoogleMapView from './GoogleMapView';
import { calculateRoute, RouteResult } from '../lib/googleRouting';
import { useServiceAreaPolygon } from '../lib/serviceArea';
import { useAuth } from '../lib/AuthContext';

interface DriverNavigationMapProps {
  ride: Ride;
  onRideCompleted?: () => void;
  onRideCancelled?: () => void;
  driverLocation?: { lat: number; lng: number } | null;
}

export default function DriverNavigationMap({ ride, onRideCompleted, onRideCancelled, driverLocation }: DriverNavigationMapProps) {
  const { profile } = useAuth();
  const serviceArea = useServiceAreaPolygon();
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const activeDriverCoords = driverLocation || profile?.currentLocation || (ride.pickup ? { lat: ride.pickup.lat, lng: ride.pickup.lng } : null);

  // Target coordinates depend on status:
  // If ACCEPTED -> navigating to pickup
  // If ARRIVED / IN_PROGRESS -> navigating to drop
  const isEnRouteToPickup = ride.status === RideStatus.ACCEPTED;
  const targetCoords = isEnRouteToPickup ? ride.pickup : ride.drop;
  const targetAddress = isEnRouteToPickup ? ride.pickup.address : ride.drop.address;

  useEffect(() => {
    async function fetchRoute() {
      if (ride.pickup && ride.drop) {
        const origin = isEnRouteToPickup
          ? { lat: ride.pickup.lat + 0.005, lng: ride.pickup.lng + 0.005 } // driver starting near
          : ride.pickup;
        const res = await calculateRoute(origin, targetCoords);
        setRouteInfo(res);
      }
    }
    fetchRoute();
  }, [ride.status, ride.pickup.lat, ride.drop.lat]);

  const handleStatusProgress = async (nextStatus: RideStatus) => {
    setLoadingAction(true);
    try {
      const rideRef = doc(db, 'rides', ride.id);

      if (nextStatus === RideStatus.COMPLETED) {
        // First mark ride completed
        await updateDoc(rideRef, {
          status: RideStatus.COMPLETED,
          updatedAt: Date.now()
        });

        // Record 10% commission idempotently (guaranteed to run exactly once)
        await recordCompletedRideCommission(ride.id);

        if (onRideCompleted) onRideCompleted();
      } else {
        await updateDoc(rideRef, {
          status: nextStatus,
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Could not update ride status');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 overflow-hidden flex flex-col">
      {/* Turn-by-Turn Instruction Banner */}
      <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-500 text-white rounded-2xl animate-pulse">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-brand-400">
              {isEnRouteToPickup ? 'Heading to Pickup' : 'Heading to Destination'}
            </div>
            <div className="text-sm font-black truncate max-w-[240px] md:max-w-md">
              {targetAddress}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-black text-white">
            {routeInfo ? `${routeInfo.durationMinutes} min` : '...'}
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            {routeInfo ? `${routeInfo.distanceKm} km` : ''}
          </div>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="h-72 w-full relative">
        <GoogleMapView
          center={activeDriverCoords || targetCoords}
          zoom={14}
          servicePolygon={serviceArea.polygon}
          isServiceAreaEnabled={serviceArea.enabled}
          userLocation={activeDriverCoords}
          userLocationLabel="Driver Live Location / ড্রাইভার লাইভ অবস্থান"
          showLegend={true}
          pickup={ride.pickup}
          drop={ride.drop}
          routePolyline={routeInfo?.polylinePath}
          interactive={false}
          className="h-full w-full"
        />
      </div>

      {/* Trip Details & Driver Action Controls */}
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img
              src={ride.userPhoto || `https://ui-avatars.com/api/?name=${ride.userName}`}
              alt={ride.userName}
              className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
            />
            <div>
              <div className="text-sm font-black text-slate-900">{ride.userName}</div>
              <div className="text-xs text-slate-400 font-semibold">Rider</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {ride.userPhone && (
              <a
                href={`tel:${ride.userPhone}`}
                className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                title="Call Rider"
              >
                <Phone className="w-5 h-5" />
              </a>
            )}
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Agreed Fare</div>
              <div className="text-lg font-black text-brand-600">
                {formatCurrency(ride.acceptedFare || ride.userOfferedFare)}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Button based on status */}
        <div className="flex flex-col gap-2.5">
          {ride.status === RideStatus.ACCEPTED && (
            <button
              onClick={() => handleStatusProgress(RideStatus.ARRIVED)}
              disabled={loadingAction}
              className="w-full bg-accent-500 hover:bg-accent-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-accent-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              <span>I Have Arrived at Pickup / পিকআপে পৌঁছেছি</span>
            </button>
          )}

          {ride.status === RideStatus.ARRIVED && (
            <button
              onClick={() => handleStatusProgress(RideStatus.IN_PROGRESS)}
              disabled={loadingAction}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Navigation className="w-5 h-5" />
              <span>Start Trip With Passenger / যাত্রা শুরু করুন</span>
            </button>
          )}

          {ride.status === RideStatus.IN_PROGRESS && (
            <button
              onClick={() => handleStatusProgress(RideStatus.COMPLETED)}
              disabled={loadingAction}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>Complete Trip & Collect Fare ({formatCurrency(ride.finalFare || ride.acceptedFare || ride.userOfferedFare)})</span>
            </button>
          )}

          {(ride.status === RideStatus.ACCEPTED || ride.status === RideStatus.ARRIVED) && onRideCancelled && (
            <button
              onClick={onRideCancelled}
              disabled={loadingAction}
              className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-black text-xs uppercase tracking-wider transition-colors border border-rose-200/80 active:scale-95"
            >
              Cancel Ride / রাইড বাতিল করুন
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
