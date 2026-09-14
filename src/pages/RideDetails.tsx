import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Ride, RideStatus, UserRole } from '../types';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'motion/react';
import { Star, Phone, MessageSquare, Check, Loader2, ClipboardList, Users, ArrowLeft } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

export default function RideDetails() {
  const { rideId } = useParams<{ rideId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rideId) return;

    const rideUnsubscribe = onSnapshot(doc(db, 'rides', rideId), (doc) => {
      if (doc.exists()) {
        setRide({ id: doc.id, ...doc.data() } as Ride);
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    return () => {
      rideUnsubscribe();
    };
  }, [rideId, navigate]);

  const handleCancelRide = async () => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: RideStatus.CANCELLED,
        updatedAt: Date.now()
      });
      navigate('/');
    } catch (error) {
      console.error('Error cancelling ride:', error);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
    </div>
  );

  if (!ride) return null;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-12">
      {/* Back to Bookings Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/my-bookings')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Bookings • আমার বুকিং</span>
        </button>

        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
          #CL-{ride.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* Status Banner */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          "p-5 rounded-[2rem] flex items-center justify-between shadow-xl border-b-4",
          ride.status === RideStatus.SEARCHING ? "bg-brand-50 border-brand-200 text-brand-900" :
          ride.status === RideStatus.ACCEPTED ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
          ride.status === RideStatus.COMPLETED ? "bg-brand-100 border-brand-300 text-brand-900" :
          "bg-slate-50 border-slate-200 text-slate-800"
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-2 rounded-xl shrink-0",
            ride.status === RideStatus.SEARCHING ? "bg-brand-100" : "bg-white/50"
          )}>
            {ride.status === RideStatus.SEARCHING && <Loader2 className="w-5 h-5 animate-spin" />}
            {(ride.status === RideStatus.ACCEPTED || ride.status === RideStatus.COMPLETED) && <Check className="w-5 h-5" />}
          </div>
          <div>
            <span className="font-black uppercase tracking-[0.15em] text-[10px] block opacity-50 mb-0.5">
              Current Status
            </span>
            <span className="font-bold text-base">
              {ride.status === RideStatus.SEARCHING ? 'Finding your Rider...' : 
               ride.status === RideStatus.COMPLETED ? 'Ride Finished' :
               `Ride ${ride.status}`}
            </span>
            {ride.distance && (
              <span className="ml-3 font-black bg-white/40 text-slate-900 px-2 py-0.5 rounded-lg text-[10px] border border-black/5 uppercase tracking-wider">
                {ride.distance} km
              </span>
            )}
          </div>
        </div>
        {ride.status === RideStatus.SEARCHING && (
          <button 
            onClick={handleCancelRide} 
            className="bg-white/50 hover:bg-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
        )}
      </motion.div>

      {/* Ride Info Card */}
      <div className="bg-white rounded-[2.5rem] p-8 card-shadow border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 opacity-30" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 pb-8 border-b border-slate-50">
          <div className="space-y-6 flex-1">
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 mt-1 shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pickup Point</div>
                <div className="text-base font-bold text-slate-900 leading-tight">{ride.pickup.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-500/15 mt-1 shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Destination</div>
                <div className="text-base font-bold text-slate-900 leading-tight">{ride.drop.address}</div>
              </div>
            </div>
          </div>
          <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100 text-center md:text-right shrink-0">
            <div className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em] mb-1">Total Fare / মোট ভাড়া</div>
            <div className="text-3xl font-black text-brand-600 leading-none">{formatCurrency(ride.finalFare || ride.userOfferedFare)}</div>
            {ride.passengerCount && (
              <div className="mt-2 flex items-center justify-center md:justify-end gap-1 text-xs font-bold text-slate-700">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                <span>{ride.passengerCount} {ride.passengerCount === 1 ? 'Passenger' : 'Passengers'} / {ride.passengerCount} জন</span>
              </div>
            )}
            {ride.baseFare !== undefined && (
              <div className="text-[10px] text-slate-500 font-medium mt-1">
                Base ₹{ride.baseFare} {ride.passengerExtraCharge ? `+ Extra ₹${ride.passengerExtraCharge}` : '+ Extra ₹0'}
              </div>
            )}
          </div>
        </div>

        {[RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS].includes(ride.status) && ride.driverId && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-5">
              <img 
                src={ride.driverPhoto || `https://ui-avatars.com/api/?name=${ride.driverName || 'Driver'}&background=random`} 
                alt="Driver" 
                className="w-20 h-20 rounded-[1.5rem] object-cover border-4 border-slate-50 shadow-md" 
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-xl text-slate-900 tracking-tight">{ride.driverName || 'Suvo Rider'}</h3>
                  <div className="flex items-center gap-1.5 bg-accent-50 text-accent-600 px-3 py-1 rounded-xl">
                    <Star className="w-4 h-4 fill-accent-500" />
                    <span className="text-sm font-black">{ride.driverRating || '4.8'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-500">
                    {ride.bikeDetails?.model || 'Bike'} • <span className="text-slate-900 font-black">{ride.bikeDetails?.number || 'N/A'}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button className="group flex items-center justify-center gap-3 bg-slate-50 text-slate-900 py-4.5 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95">
                <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-brand-600" />
                Live Chat
              </button>
              {profile?.role === UserRole.DRIVER && ride.status === RideStatus.ACCEPTED ? (
                <button 
                  onClick={async () => {
                    await updateDoc(doc(db, 'rides', ride.id), { status: RideStatus.COMPLETED, updatedAt: Date.now() });
                  }}
                  className="flex items-center justify-center gap-3 bg-emerald-600 text-white py-4.5 rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Check className="w-5 h-5" />
                  Complete
                </button>
              ) : (
                <a 
                  href={`tel:${ride.driverPhone}`}
                  className="flex items-center justify-center gap-3 bg-brand-600 text-white py-4.5 rounded-2xl font-bold hover:bg-brand-700 shadow-xl shadow-brand-600/25 transition-all active:scale-95"
                >
                  <Phone className="w-5 h-5" />
                  Contact
                </a>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
