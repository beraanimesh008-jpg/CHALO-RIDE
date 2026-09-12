import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { Ride, RideStatus, UserRole, DriverVerificationStatus } from '../types';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Navigation, MapPin, IndianRupee, Bell, Power, TrendingUp, History, Star, ChevronRight, ClipboardList, Loader2, Phone, Bike, Wallet, Compass, ShieldCheck, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Users, X, Clock, ShieldAlert } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import DriverCommissionWallet from '../components/DriverCommissionWallet';
import DriverNavigationMap from '../components/DriverNavigationMap';
import GoogleMapView from '../components/GoogleMapView';
import DriverVerificationSection from '../components/DriverVerificationSection';
import { isWithinServicePolygon, useServiceAreaPolygon } from '../lib/serviceArea';
import { recordRideCommission } from '../lib/commissionService';

export default function DriverDashboard() {
  const { profile } = useAuth();
  const serviceArea = useServiceAreaPolygon();
  const [rides, setRides] = useState<Ride[]>([]);
  const verificationStatus = profile?.driverVerificationStatus || DriverVerificationStatus.INCOMPLETE;
  const isApproved = verificationStatus === DriverVerificationStatus.APPROVED;
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'earnings'>('available');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(
    profile?.currentLocation || null
  );
  const [showDriverMap, setShowDriverMap] = useState(true);

  // Sync isOnline with profile
  useEffect(() => {
    if (profile?.isOnline !== undefined) {
      setIsOnline(profile.isOnline);
    }
  }, [profile?.isOnline]);

  // Live GPS Tracking for Driver
  useEffect(() => {
    if (!profile || profile.role !== UserRole.DRIVER) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverLocation(loc);
          updateDoc(doc(db, 'users', profile.uid), {
            currentLocation: loc,
            updatedAt: Date.now()
          }).catch(() => {});
        },
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true }
      );

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverLocation(loc);
          updateDoc(doc(db, 'users', profile.uid), {
            currentLocation: loc,
            updatedAt: Date.now()
          }).catch(() => {});
        },
        (err) => console.warn('WatchPosition error:', err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [profile?.uid]);

  const driverLat = driverLocation?.lat ?? profile?.currentLocation?.lat ?? 21.796;
  const driverLng = driverLocation?.lng ?? profile?.currentLocation?.lng ?? 88.358;
  const driverGeofenceCheck = isWithinServicePolygon(driverLat, driverLng, serviceArea.polygon, serviceArea.enabled);
  const isDriverInside = driverGeofenceCheck.inService;

  useEffect(() => {
    if (!profile || profile.role !== UserRole.DRIVER) return;

    // Listen for accepted rides assigned to this driver
    // CRITICAL ACTIVE RIDE EXCEPTION:
    // If a driver already accepted or started a ride, do NOT cancel or interrupt that active ride
    // just because the driver moves outside the polygon.
    const activeQuery = query(
      collection(db, 'rides'), 
      where('driverId', '==', profile.uid),
      where('status', 'in', [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS])
    );

    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      if (!snapshot.empty) {
        const rideData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ride;
        setActiveRide(rideData);
      } else {
        setActiveRide(null);
      }
    });

    return () => unsubscribeActive();
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== UserRole.DRIVER) return;

    // CRITICAL: Block NEW ride dispatch for any driver not in APPROVED status
    if (profile.driverVerificationStatus !== DriverVerificationStatus.APPROVED) {
      setRides([]);
      return;
    }

    if (!isOnline) {
      setRides([]);
      return;
    }

    // CRITICAL REQUIREMENT:
    // When a driver accepts a ride request, as long as that ride is NOT completed or cancelled,
    // NO new ride requests should be shown. Only when completed or cancelled will new rides be shown.
    if (activeRide) {
      setRides([]);
      return;
    }

    // Geofence enforcement: If driver is outside the polygon, block new ride requests
    if (serviceArea.enabled && !isDriverInside) {
      setRides([]);
      return;
    }

    const q = query(collection(db, 'rides'), where('status', '==', RideStatus.SEARCHING));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      // Geofence filter: only show rides whose pickup is within the ChaLo polygon
      const validRides = ridesData.filter((ride) => {
        if (!serviceArea.enabled) return true;
        if (!ride.pickup || typeof ride.pickup.lat !== 'number' || typeof ride.pickup.lng !== 'number') return true;
        return isWithinServicePolygon(ride.pickup.lat, ride.pickup.lng, serviceArea.polygon, serviceArea.enabled).inService;
      });
      setRides(validRides);
    }, (error) => {
      console.error("Rides snapshot error:", error);
    });

    return () => unsubscribe();
  }, [profile, isOnline, serviceArea, isDriverInside, activeRide]);

  const toggleOnline = async () => {
    if (!profile) return;

    // Check verification status before allowing driver to go online
    if (profile.driverVerificationStatus !== DriverVerificationStatus.APPROVED) {
      setShowVerificationModal(true);
      return;
    }

    const newStatus = !isOnline;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: newStatus
      });
      // The local setIsOnline will be updated by the useEffect syncing with profile
    } catch (error) {
      console.error('Error toggling online status:', error);
      alert('Failed to update online status. Please try again.');
    }
  };

  const handleMakeOffer = async (ride: Ride) => {
    if (!profile) return;

    if (activeRide) {
      alert('You already have an active ride in progress. Please complete or cancel it before accepting a new ride.\nআপনার ইতিমধ্যে একটি সক্রিয় রাইড চলছে। নতুন রাইড নেওয়ার আগে বর্তমান রাইডটি শেষ বা বাতিল করুন।');
      return;
    }

    if (profile.driverVerificationStatus !== DriverVerificationStatus.APPROVED) {
      setShowVerificationModal(true);
      return;
    }

    if (serviceArea.enabled && !isDriverInside) {
      alert('Outside Chalo Service Area / Chalo-এর সার্ভিস এলাকার বাইরে\n\nYou cannot accept new ride requests while outside the service area.');
      return;
    }

    setLoadingAction(ride.id);
    
    const offeredFare = ride.finalFare || ride.userOfferedFare; 

    try {
      // 1. Try "Quick Accept" first (direct acceptance)
      await updateDoc(doc(db, 'rides', ride.id), {
        status: RideStatus.ACCEPTED,
        driverId: profile.uid,
        driverName: profile.displayName || 'Driver',
        driverPhoto: profile.photoURL || '',
        driverRating: profile.rating || 5,
        driverPhone: profile.phoneNumber || '',
        bikeDetails: profile.bikeDetails || { model: 'Bike', number: 'N/A' },
        acceptedFare: offeredFare,
        updatedAt: Date.now()
      });
      // Set active ride locally immediately so new ride feed pauses instantly
      setActiveRide({
        ...ride,
        status: RideStatus.ACCEPTED,
        driverId: profile.uid,
        driverName: profile.displayName || 'Driver',
        driverPhoto: profile.photoURL || '',
        driverPhone: profile.phoneNumber || '',
        acceptedFare: offeredFare,
        updatedAt: Date.now()
      });
      setRides([]);
      alert('Ride Accepted! / রাইড গৃহীত হয়েছে!');
    } catch (error: any) {
      console.log('Direct accept failed (likely permissions or taken), trying to send offer:', error);
      
      try {
        // 2. Fallback to sending an offer (Interest)
        const offerData = {
          driverId: profile.uid,
          driverName: profile.displayName || 'Driver',
          driverPhoto: profile.photoURL || '',
          driverRating: profile.rating || 5,
          driverPhone: profile.phoneNumber || '',
          driverLocation: { lat: 21.85, lng: 88.37 }, 
          offeredFare: offeredFare,
          bikeDetails: profile.bikeDetails || { model: 'Bike', number: 'N/A' },
          timestamp: Date.now()
        };

        await setDoc(doc(db, 'rides', ride.id, 'offers', profile.uid), offerData);
        alert('Interest sent! Waiting for rider to accept or call.');
      } catch (innerError: any) {
        console.error('Error making offer:', innerError);
        alert(`This ride is no longer available.`);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateRideStatus = async (rideId: string, status: RideStatus) => {
    setLoadingAction(rideId);
    try {
      if (status === RideStatus.COMPLETED && activeRide) {
        const fare = activeRide.finalFare || activeRide.acceptedFare || activeRide.userOfferedFare;
        if (activeRide.driverId) {
          await recordRideCommission(
            activeRide.driverId,
            activeRide.driverName || 'Driver',
            activeRide.id,
            fare
          );
        }
      }
      await updateDoc(doc(db, 'rides', rideId), {
        status,
        updatedAt: Date.now()
      });
      if (status === RideStatus.COMPLETED) {
        setActiveRide(null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelRide = async (rideId: string) => {
    setLoadingAction(rideId);
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: RideStatus.SEARCHING,
        driverId: deleteField(),
        driverName: deleteField(),
        driverPhoto: deleteField(),
        driverRating: deleteField(),
        driverPhone: deleteField(),
        bikeDetails: deleteField(),
        acceptedFare: deleteField(),
        updatedAt: Date.now()
      });
      setActiveRide(null);
      alert('Ride cancelled. You are now available to receive new rides.\nরাইড বাতিল করা হয়েছে। এখন আপনি আবার নতুন রাইড পাবেন।');
    } catch (error: any) {
      console.error('Error cancelling ride:', error);
      alert('Failed to cancel ride: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingAction(null);
    }
  };

  const openInGoogleMaps = (lat: number, lng: number, label: string) => {
    // This format is highly compatible across mobile devices and opens directly to coordinates
    const url = `https://www.google.com/maps?q=${lat},${lng}&label=${encodeURIComponent(label)}`;
    window.open(url, '_blank');
  };

  if (profile?.role !== UserRole.DRIVER) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Driver <span className="text-brand-600">Portal</span></h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 border",
              serviceArea.enabled
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            )}>
              <Compass className="w-3 h-3 text-brand-600" />
              {serviceArea.enabled ? (serviceArea.bengaliName || serviceArea.name) : 'Geofencing Off'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
            <button 
              onClick={toggleOnline}
              className={cn(
                "px-5 py-2 rounded-[0.85rem] font-bold text-sm transition-all flex items-center gap-2",
                isOnline ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-white animate-pulse" : "bg-slate-300")} />
              GO ONLINE
            </button>
            <button 
              onClick={toggleOnline}
              className={cn(
                "px-5 py-2 rounded-[0.85rem] font-bold text-sm transition-all",
                !isOnline ? "bg-slate-900 text-white shadow-lg" : "text-slate-400"
              )}
            >
              OFFLINE
            </button>
          </div>
        </div>
      </div>

      {/* Driver Verification Status Banner */}
      {!isApproved && (
        <div className={cn(
          "p-6 rounded-[2.5rem] border transition-all card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-5",
          verificationStatus === DriverVerificationStatus.REJECTED
            ? "bg-rose-50/80 border-rose-200"
            : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
            ? "bg-blue-50/80 border-blue-200"
            : "bg-amber-50/80 border-amber-200"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
              verificationStatus === DriverVerificationStatus.REJECTED
                ? "bg-rose-600 text-white"
                : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
                ? "bg-blue-600 text-white"
                : "bg-amber-500 text-white"
            )}>
              {verificationStatus === DriverVerificationStatus.REJECTED ? (
                <ShieldAlert className="w-6 h-6" />
              ) : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL ? (
                <Clock className="w-6 h-6 animate-pulse" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                  verificationStatus === DriverVerificationStatus.REJECTED
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                )}>
                  {verificationStatus === DriverVerificationStatus.REJECTED
                    ? "Profile Rejected / প্রোফাইল অনুমোদিত হয়নি"
                    : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
                    ? "Pending Admin Approval / Admin Approval-এর অপেক্ষায়"
                    : "Profile Incomplete / প্রোফাইল অসম্পূর্ণ"}
                </span>
                <span className="text-xs font-black text-slate-800">
                  New Rides Blocked
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900">
                Complete your profile and wait for Admin approval before receiving rides.
              </h4>
              <p className="text-xs text-brand-700 font-bold mt-0.5">
                রাইড পাওয়ার আগে প্রোফাইল সম্পূর্ণ করে Admin approval-এর জন্য অপেক্ষা করুন।
              </p>

              {verificationStatus === DriverVerificationStatus.REJECTED && profile?.rejectionReason && (
                <p className="text-xs text-rose-800 font-medium mt-1">
                  <strong>Rejection Reason:</strong> {profile.rejectionReason}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowVerificationModal(true)}
            className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-xs font-black uppercase tracking-wider shadow-sm transition-all shrink-0 active:scale-95"
          >
            {verificationStatus === DriverVerificationStatus.REJECTED
              ? "Update & Resubmit / সংশোধন করুন"
              : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
              ? "View Submitted Details"
              : "Complete Profile / প্রোফাইল পূরণ করুন"}
          </button>
        </div>
      )}

      {/* Header Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today Earnings', value: '₹1,240', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Total Rides', value: '12', icon: ClipboardList, color: 'text-brand-600', bg: 'bg-brand-50' },
          { label: 'Rating', value: '4.8', icon: Star, color: 'text-accent-500', bg: 'bg-accent-50' },
          { label: 'Available Balance', value: '₹450', icon: IndianRupee, color: 'text-brand-600', bg: 'bg-brand-50' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 card-shadow group hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-2 rounded-xl shrink-0 transition-colors", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="text-2xl font-black text-slate-900 group-hover:text-brand-600 transition-colors">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Active Ride Navigation Section */}
      <AnimatePresence>
        {activeRide && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-2"
          >
            <DriverNavigationMap
              ride={activeRide}
              onRideCompleted={() => setActiveRide(null)}
              onRideCancelled={() => handleCancelRide(activeRide.id)}
              driverLocation={driverLocation}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Area Geofencing & Live Driver Map Section */}
      <div className={cn(
        "rounded-[2.5rem] p-6 border transition-all card-shadow overflow-hidden relative",
        serviceArea.enabled
          ? isDriverInside
            ? "bg-emerald-50/70 border-emerald-200"
            : "bg-rose-50/90 border-rose-300"
          : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
              serviceArea.enabled
                ? isDriverInside
                  ? "bg-emerald-500 text-white shadow-emerald-500/30"
                  : "bg-rose-600 text-white shadow-rose-600/30 animate-pulse"
                : "bg-slate-400 text-white"
            )}>
              {serviceArea.enabled ? (
                isDriverInside ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )
              ) : (
                <Compass className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  "text-sm font-black tracking-tight",
                  serviceArea.enabled
                    ? isDriverInside
                      ? "text-emerald-950"
                      : "text-rose-950"
                    : "text-slate-700"
                )}>
                  {serviceArea.enabled ? (
                    isDriverInside ? (
                      "Inside Service Area / সার্ভিস এলাকার মধ্যে"
                    ) : (
                      "Outside Chalo Service Area / Chalo-এর সার্ভিস এলাকার বাইরে"
                    )
                  ) : (
                    "Service Area Geofencing Disabled"
                  )}
                </span>
                <span className={cn(
                  "text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                  isDriverInside
                    ? "bg-emerald-200/70 text-emerald-900"
                    : "bg-rose-200/80 text-rose-900 animate-pulse"
                )}>
                  {isDriverInside ? "Eligible for New Rides" : "New Rides Restricted"}
                </span>
              </div>
              <p className={cn(
                "text-xs mt-1 font-medium max-w-xl",
                isDriverInside ? "text-emerald-800" : "text-rose-800 font-semibold"
              )}>
                {serviceArea.enabled ? (
                  isDriverInside ? (
                    "Driver is within the approved polygon boundary. You are eligible to see and accept new incoming ride requests."
                  ) : (
                    "Driver is currently outside the designated service area polygon. You cannot view or accept new ride bookings until you re-enter the boundary."
                  )
                ) : (
                  "Geofencing polygon validation is turned off in admin settings."
                )}
              </p>
              {typeof driverLat === 'number' && typeof driverLng === 'number' && (
                <div className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-2">
                  <span>Live GPS: {driverLat.toFixed(5)}° N, {driverLng.toFixed(5)}° E</span>
                  <span className="text-slate-300">•</span>
                  <span>Zone: {serviceArea.name}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowDriverMap(!showDriverMap)}
            className="flex items-center gap-2 self-start sm:self-center px-4 py-2.5 rounded-xl bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 text-xs font-bold transition-all shadow-sm shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-brand-600" />
            <span>{showDriverMap ? "Hide Polygon Map" : "View Service Area Map"}</span>
            {showDriverMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Live Driver Map Canvas with Polygon */}
        {showDriverMap && (
          <div className="mt-5 rounded-2xl overflow-hidden border border-slate-200/80 shadow-inner h-72 w-full relative">
            <GoogleMapView
              center={{ lat: driverLat, lng: driverLng }}
              zoom={13}
              servicePolygon={serviceArea.polygon}
              isServiceAreaEnabled={serviceArea.enabled}
              userLocation={{ lat: driverLat, lng: driverLng }}
              userLocationLabel="Driver Live Location / ড্রাইভার লাইভ অবস্থান"
              showLegend={true}
              interactive={true}
              className="h-full w-full"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 overflow-hidden">
        {/* Sub-Nav Tabs */}
        <div className="flex border-b border-slate-50 p-2">
          <button 
            onClick={() => setActiveTab('available')}
            className={cn(
              "flex-1 py-4 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              activeTab === 'available' ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Bell className={cn("w-4 h-4", activeTab === 'available' && !activeRide ? "animate-bounce" : "")} />
            <span>{activeRide ? 'LIVE REQUESTS (ON TRIP)' : 'LIVE REQUESTS'}</span>
            {!activeRide && rides.length > 0 && (
              <span className="bg-brand-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {rides.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('earnings')}
            className={cn(
              "flex-1 py-4 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              activeTab === 'earnings' ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <History className="w-4 h-4" />
            HISTORY
          </button>
        </div>

        {/* Dynamic Content */}
        <div className="p-6">
          {activeTab === 'available' ? (
            <AnimatePresence>
              {!isApproved ? (
                <div className="text-center py-20 px-8">
                  <div className="w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 bg-amber-50 text-amber-600 ring-8 ring-amber-500/10">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-4 border bg-amber-50 text-amber-900 border-amber-200">
                    {verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
                      ? "Pending Admin Approval / Admin Approval-এর অপেক্ষায়"
                      : verificationStatus === DriverVerificationStatus.REJECTED
                      ? "Profile Rejected / প্রোফাইল অনুমোদিত হয়নি"
                      : "Profile Incomplete / প্রোফাইল অসম্পূর্ণ"}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 max-w-lg mx-auto">
                    Complete your profile and wait for Admin approval before receiving rides.
                  </h3>
                  <p className="text-brand-700 text-sm max-w-lg mx-auto font-medium mb-3">
                    রাইড পাওয়ার আগে প্রোফাইল সম্পূর্ণ করে Admin approval-এর জন্য অপেক্ষা করুন।
                  </p>
                  <p className="text-slate-400 text-xs max-w-md mx-auto mb-6">
                    Mandatory 4 fields (Driver Name, Mobile Number, Aadhaar Number, and Driver Photo) must be submitted and approved by the Chalo Admin before you can receive new ride requests.
                  </p>
                  <button
                    onClick={() => setShowVerificationModal(true)}
                    className="px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-brand-600/25 active:scale-95"
                  >
                    {verificationStatus === DriverVerificationStatus.REJECTED
                      ? "Update & Resubmit Profile / তথ্য সংশোধন করে জমা দিন"
                      : verificationStatus === DriverVerificationStatus.PENDING_APPROVAL
                      ? "View / Edit Submitted Details"
                      : "Complete Driver Profile / প্রোফাইল পূরণ করুন"}
                  </button>
                </div>
              ) : !isOnline ? (
                <div className="text-center py-24 px-8">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Power className="w-10 h-10 text-slate-200" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">You're Offline</h3>
                  <p className="text-slate-400 font-medium">Toggle the switch above to start receiving ride requests.</p>
                </div>
              ) : activeRide ? (
                <div className="text-center py-20 px-8">
                  <div className="w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 bg-brand-50 text-brand-600 ring-8 ring-brand-500/10">
                    <Bike className="w-10 h-10 animate-pulse" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-4 border bg-brand-50 text-brand-900 border-brand-200">
                    Active Trip in Progress / সক্রিয় রাইড চলছে
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 max-w-lg mx-auto">
                    Servicing Ride for {activeRide.userName}
                  </h3>
                  <p className="text-brand-700 text-sm max-w-lg mx-auto font-medium mb-3">
                    বর্তমান রাইড সম্পন্ন (Complete) বা বাতিল (Cancel) না করা পর্যন্ত নতুন কোনো রাইডের অনুরোধ আসবে না।
                  </p>
                  <p className="text-slate-400 text-xs max-w-md mx-auto mb-6">
                    New ride requests are paused during your active journey. Once you finish or cancel the active trip, new requests will appear here immediately.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200">
                    <Clock className="w-4 h-4 text-brand-600" />
                    <span>Fare: {formatCurrency(activeRide.finalFare || activeRide.acceptedFare || activeRide.userOfferedFare)} • Passengers: {activeRide.passengerCount || 1} • Status: {activeRide.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ) : serviceArea.enabled && !isDriverInside ? (
                <div className="text-center py-20 px-8">
                  <div className="bg-rose-50 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-rose-500 ring-8 ring-rose-500/10">
                    <AlertTriangle className="w-10 h-10 text-rose-600 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Outside Chalo Service Area / Chalo-এর সার্ভিস এলাকার বাইরে
                  </h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto font-medium mb-5">
                    You cannot view or accept new ride requests while outside the designated boundary. Please move inside the Kakdwip / Namkhana service area to resume receiving rides.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-800 rounded-xl text-xs font-black border border-rose-200">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <span>Return inside the service polygon to accept new rides</span>
                  </div>
                </div>
              ) : rides.length === 0 ? (
                <div className="text-center py-24 px-8">
                  <div className="bg-brand-50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <Navigation className="w-10 h-10 text-brand-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Searching for Rides...</h3>
                  <p className="text-slate-400 font-medium">Keep app open to catch the latest requests in your area.</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {rides.map((ride) => (
                    <motion.div 
                      key={ride.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-6">
                             <img src={ride.userPhoto || `https://ui-avatars.com/api/?name=${ride.userName}`} className="w-12 h-12 rounded-2xl border-2 border-white shadow-md object-cover" />
                             <div>
                               <span className="block text-sm font-bold text-slate-900">{ride.userName}</span>
                               <div className="flex flex-wrap items-center gap-2 mt-1">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">RIDER REQUEST</span>
                                 {ride.distance && (
                                   <span className="text-[10px] font-black bg-brand-50 text-brand-600 px-2 py-0.5 rounded-lg border border-brand-100/50">
                                     {ride.distance} KM
                                   </span>
                                 )}
                                 <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-200/60 flex items-center gap-1">
                                   <Users className="w-3 h-3 text-blue-600" />
                                   Passengers: {ride.passengerCount || 1} / যাত্রী: {ride.passengerCount || 1} জন
                                 </span>
                                 {ride.userPhone && (
                                   <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                     {ride.userPhone}
                                   </span>
                                 )}
                               </div>
                             </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-start gap-4">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 mt-1 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PICKUP</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800 line-clamp-1">{ride.pickup.address}</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openInGoogleMaps(ride.pickup.lat, ride.pickup.lng, 'Pickup');
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded-lg text-brand-600 transition-colors"
                                    title="View on Map"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="w-px h-4 bg-slate-200 ml-[5px] my-1 border-l border-dashed" />
                            <div className="flex items-start gap-4">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/15 mt-1 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DROP</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800 line-clamp-1">{ride.drop.address}</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openInGoogleMaps(ride.drop.lat, ride.drop.lng, 'Drop-off');
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded-lg text-brand-600 transition-colors"
                                    title="View on Map"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center md:items-end justify-between bg-white md:bg-transparent p-4 md:p-0 rounded-2xl border border-slate-100 md:border-none">
                          <div className="text-center md:text-right mb-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-1">Fare / ভাড়া</span>
                            <div className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(ride.finalFare || ride.userOfferedFare)}</div>
                            <div className="text-xs font-bold text-slate-600 mt-1 flex items-center justify-center md:justify-end gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              <span>Passengers: {ride.passengerCount || 1} / যাত্রী: {ride.passengerCount || 1} জন</span>
                            </div>
                            {ride.baseFare !== undefined && (
                              <div className="text-[10px] text-slate-400 font-medium">
                                Base ₹{ride.baseFare} + Extra ₹{ride.passengerExtraCharge || 0}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 w-full md:w-auto">
                            <button 
                              onClick={() => handleMakeOffer(ride)}
                              disabled={loadingAction === ride.id}
                              className="w-full md:w-auto bg-brand-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-brand-700 shadow-xl shadow-brand-600/25 transition-all active:scale-95 flex items-center justify-center gap-2 group-hover:ring-4 group-hover:ring-brand-500/10 disabled:opacity-50"
                            >
                              {loadingAction === ride.id ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <>
                                  Accept Request
                                  <ChevronRight className="w-5 h-5" />
                                </>
                              )}
                            </button>
                            {ride.userPhone && (
                              <a 
                                href={`tel:${ride.userPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full md:w-auto bg-slate-900/5 text-slate-600 px-10 py-3 rounded-2xl font-bold hover:bg-slate-900/10 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest border border-slate-200"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Call Rider
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          ) : (
            <DriverCommissionWallet
              driverId={profile.uid}
              driverName={profile.displayName || 'Driver'}
            />
          )}
        </div>
      </div>

      {/* Verification Modal */}
      <AnimatePresence>
        {showVerificationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl my-8"
            >
              <button
                onClick={() => setShowVerificationModal(false)}
                className="absolute top-4 right-4 z-10 p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <DriverVerificationSection onSuccess={() => setShowVerificationModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
