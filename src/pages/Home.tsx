import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Ride, RideStatus, UserRole } from '../types';
import {
  IndianRupee,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  RotateCcw,
  Navigation,
  Clock,
  Users,
  ClipboardList,
  Car
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, getDistanceMeters } from '../lib/utils';
import { isWithinServicePolygon, useServiceAreaPolygon } from '../lib/serviceArea';
import GoogleMapView, { MapCoords } from '../components/GoogleMapView';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { calculateRoute, RouteResult } from '../lib/googleRouting';
import { DEFAULT_CENTER } from '../constants';
import {
  calculateRideFare,
  validatePassengerCount,
  getPassengerExtraCharge,
  MAX_PASSENGERS,
  MIN_PASSENGERS
} from '../lib/fareCalculator';
import MyBookingsSection from '../components/MyBookingsSection';

// Formatted coordinate helper for map taps (avoids deprecated Geocoder API)
const reverseGeocode = async (coords: MapCoords): Promise<string> => {
  return `Pinned Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
};

interface HomeProps {
  initialTab?: 'book' | 'bookings';
}

export default function Home({ initialTab }: HomeProps = {}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const serviceArea = useServiceAreaPolygon();

  // Active section state: 'book' (Ride Booking) vs 'bookings' (My Bookings)
  const isBookingsRoute = location.pathname === '/my-bookings' || location.search.includes('tab=bookings');
  const [activeTab, setActiveTab] = useState<'book' | 'bookings'>(
    initialTab || (isBookingsRoute ? 'bookings' : 'book')
  );
  const [highlightRideId, setHighlightRideId] = useState<string | null>(null);

  // Sync tab with URL updates
  useEffect(() => {
    if (location.pathname === '/my-bookings' || location.search.includes('tab=bookings')) {
      setActiveTab('bookings');
    }
  }, [location.pathname, location.search]);

  // Real-time listener for current user's active ride (shows persistent banner on booking view)
  const [userActiveRide, setUserActiveRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setUserActiveRide(null);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('userId', '==', profile.uid),
      where('status', 'in', [
        RideStatus.SEARCHING,
        RideStatus.NEGOTIATING,
        RideStatus.ACCEPTED,
        RideStatus.ARRIVED,
        RideStatus.IN_PROGRESS
      ])
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setUserActiveRide({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ride);
        } else {
          setUserActiveRide(null);
        }
      },
      (err) => console.warn('User active ride listener error:', err)
    );

    return () => unsub();
  }, [profile?.uid]);

  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [fare, setFare] = useState('');
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [passengerError, setPassengerError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [center, setCenter] = useState<MapCoords>(DEFAULT_CENTER);
  const [pickupCoords, setPickupCoords] = useState<MapCoords | null>(null);
  const [dropCoords, setDropCoords] = useState<MapCoords | null>(null);
  const [userLocation, setUserLocation] = useState<MapCoords | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Exact Distance-based Fare Breakdown calculation
  // Base Fare = Route Distance (km) × ₹10
  // Passenger extra: 1p=₹0, 2p=₹20, 3p=₹40, 4p=₹60
  // Final Fare = Base Fare + Passenger Extra
  const calculatedFareBreakdown = useMemo(() => {
    if (!routeResult || typeof routeResult.distanceKm !== 'number') return null;
    return calculateRideFare(routeResult.distanceKm, passengerCount);
  }, [routeResult?.distanceKm, passengerCount]);

  // Synchronize fare whenever distance or passenger count changes
  useEffect(() => {
    if (calculatedFareBreakdown) {
      setFare(String(calculatedFareBreakdown.finalFare));
    }
  }, [calculatedFareBreakdown]);

  // Passenger count selector handler with strict 1-4 limits & bilingual messages
  const handlePassengerChange = (newCount: number) => {
    if (newCount > MAX_PASSENGERS) {
      setPassengerError('Maximum 4 passengers allowed. / সর্বোচ্চ ৪ জন যাত্রী যেতে পারবেন।');
      return;
    }
    if (newCount < MIN_PASSENGERS) {
      setPassengerError('Please select 1–4 passengers. / অনুগ্রহ করে ১–৪ জন যাত্রী নির্বাচন করুন।');
      return;
    }
    setPassengerError(null);
    setPassengerCount(newCount);
  };

  // Request ID to invalidate asynchronous route calculations on 3rd-tap reset
  const activeRouteRequestIdRef = useRef<number>(0);

  // Get User's real GPS position for the blue dot (does NOT auto-set pickup)
  const fetchLiveGPS = () => {
    if (!navigator.geolocation) return;

    const onGeoSuccess = (pos: GeolocationPosition) => {
      const loc: MapCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      setUserLocation(loc);
      setUserAccuracy(pos.coords.accuracy);
      setCenter(loc);
    };

    const onGeoError = (err: GeolocationPositionError) => {
      console.warn('High-accuracy GPS failed, trying fallback:', err);
      navigator.geolocation.getCurrentPosition(
        onGeoSuccess,
        (fallbackErr) => console.warn('Geolocation fallback warning:', fallbackErr),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      onGeoError,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  };

  useEffect(() => {
    fetchLiveGPS();
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setUserAccuracy(pos.coords.accuracy);
        },
        (err) => console.warn('GPS Watch warning:', err),
        { enableHighAccuracy: false, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Reset entire selection and route back to initial clean state
  const resetSelection = () => {
    // 1. Invalidate any in-flight asynchronous Directions / Routing requests
    activeRouteRequestIdRef.current++;

    // 2. Clear all endpoints, markers, addresses, route results, and fares
    setPickupCoords(null);
    setDropCoords(null);
    setPickup('');
    setDrop('');
    setRouteResult(null);
    setFare('');
    setPassengerError(null);
    setGeoError(null);
    setGeoSuccess(null);
  };

  // 3-Tap Booking Flow:
  // Tap 1 -> Pickup (Green pin) or Tap Current Location Blue Dot
  // Tap 2 -> Destination (Red pin + route polyline + fare/distance)
  // Tap 3 -> Complete Reset (clears markers, road route polyline, and fares completely)
  // Tap 4 -> New Pickup ...
  const handleMapClick = async (coords: MapCoords) => {
    setGeoError(null);
    setGeoSuccess(null);

    // ==========================================
    // CASE 3: THIRD TAP — COMPLETE RESET
    // When both Pickup and Destination are already selected,
    // the 3rd tap completely removes the previous route, markers, and calculations.
    // ==========================================
    if (pickupCoords && dropCoords) {
      resetSelection();
      setGeoSuccess('Selection reset. Tap map or type to select new Pickup Location. / সিলেকশন রিসেট করা হয়েছে। নতুন পিকআপ নির্বাচন করতে ম্যাপে ট্যাপ করুন বা লিখুন।');
      return;
    }

    // Detect if clicked point is near/on user's current GPS location (Blue Dot tap)
    const isBlueDotTap = Boolean(userLocation && getDistanceMeters(coords, userLocation) <= 70);
    const effectiveCoords = isBlueDotTap && userLocation ? userLocation : coords;

    // ==========================================
    // CASE 1: FIRST TAP — PICKUP (when pickupCoords is not set)
    // ==========================================
    if (!pickupCoords) {
      // Invalidate any pending route calculation
      activeRouteRequestIdRef.current++;

      const check = isWithinServicePolygon(effectiveCoords.lat, effectiveCoords.lng, serviceArea.polygon, serviceArea.enabled);
      if (!check.inService) {
        setGeoError('Pickup location is outside Chalo service area. / পিকআপ লোকেশন Chalo-এর সার্ভিস এলাকার বাইরে।');
        return;
      }

      setPickupCoords(effectiveCoords);
      setRouteResult(null);
      setFare('');
      setIsGeocoding(true);
      const addr = await reverseGeocode(effectiveCoords);
      setIsGeocoding(false);

      const pickupName = isBlueDotTap
        ? (addr ? `${addr} (GPS)` : 'Current GPS Location / আমার বর্তমান অবস্থান')
        : (addr || `Map Pickup (${effectiveCoords.lat.toFixed(4)}, ${effectiveCoords.lng.toFixed(4)})`);
      setPickup(pickupName);

      // If destination was already set (e.g. user typed destination first)
      if (dropCoords) {
        const currentRequestId = ++activeRouteRequestIdRef.current;
        try {
          const route = await calculateRoute(effectiveCoords, dropCoords);
          if (currentRequestId !== activeRouteRequestIdRef.current) return;
          setRouteResult(route);
          if (!fare) {
            const suggested = Math.max(30, Math.round(30 + route.distanceKm * 15));
            setFare(String(suggested));
          }
          setGeoSuccess('Pickup and destination selected. / পিকআপ ও গন্তব্য নির্বাচন সম্পন্ন।');
        } catch (e) {
          console.warn('Routing error:', e);
        }
      } else {
        setDrop('');
        setDropCoords(null);
        setGeoSuccess(
          isBlueDotTap
            ? 'Current GPS location set as Pickup. Now select destination. / বর্তমান অবস্থান পিকআপ হিসেবে সেট হয়েছে। এখন গন্তব্য নির্বাচন করুন।'
            : 'Pickup location selected. Now tap the map or type to select destination. / পিকআপ লোকেশন নির্বাচিত। এখন গন্তব্য নির্বাচন করতে ম্যাপে ট্যাপ করুন বা লিখুন।'
        );
      }
      return;
    }

    // ==========================================
    // CASE 2: SECOND TAP — DESTINATION
    // Pickup is selected, destination is not yet
    // ==========================================
    if (pickupCoords && !dropCoords) {
      const check = isWithinServicePolygon(effectiveCoords.lat, effectiveCoords.lng, serviceArea.polygon, serviceArea.enabled);
      if (!check.inService) {
        setGeoError('Destination is outside Chalo service area. / গন্তব্য Chalo-এর সার্ভিস এলাকার বাইরে।');
        return;
      }

      setDropCoords(effectiveCoords);
      setIsGeocoding(true);
      const addr = await reverseGeocode(effectiveCoords);
      setIsGeocoding(false);
      setDrop(addr || `Map Destination (${effectiveCoords.lat.toFixed(4)}, ${effectiveCoords.lng.toFixed(4)})`);

      // Track request ID to discard if 3rd-tap reset happens before response returns
      const currentRequestId = ++activeRouteRequestIdRef.current;

      // Calculate driving route using Google Directions
      try {
        const route = await calculateRoute(pickupCoords, effectiveCoords);
        
        // Guard against stale response if user tapped 3rd tap reset while calculating
        if (currentRequestId !== activeRouteRequestIdRef.current) {
          return;
        }

        setRouteResult(route);
        if (!fare) {
          const suggested = Math.max(30, Math.round(30 + route.distanceKm * 15));
          setFare(String(suggested));
        }
        setGeoSuccess('Pickup and destination selected. / পিকআপ ও গন্তব্য নির্বাচন সম্পন্ন।');
      } catch (e) {
        console.warn('Routing error:', e);
      }
      return;
    }
  };

  // Manual Google Places suggestion selection for Pickup
  const handleManualPickupSelect = async (address: string, coords: MapCoords) => {
    setGeoError(null);
    setGeoSuccess(null);

    // Exact Service Area Polygon validation
    const check = isWithinServicePolygon(coords.lat, coords.lng, serviceArea.polygon, serviceArea.enabled);
    if (!check.inService) {
      setGeoError('Pickup location is outside Chalo service area. / পিকআপ লোকেশন Chalo-এর সার্ভিস এলাকার বাইরে।');
      setCenter(coords);
      return;
    }

    setPickupCoords(coords);
    setPickup(address);
    setCenter(coords);

    // If destination is already set, recalculate route
    if (dropCoords) {
      const currentRequestId = ++activeRouteRequestIdRef.current;
      try {
        const route = await calculateRoute(coords, dropCoords);
        if (currentRequestId !== activeRouteRequestIdRef.current) return;
        setRouteResult(route);
        if (!fare) {
          const suggested = Math.max(30, Math.round(30 + route.distanceKm * 15));
          setFare(String(suggested));
        }
        setGeoSuccess('Pickup updated. Route and fare recalculated. / পিকআপ আপডেট হয়েছে। রুট ও ভাড়া হিসাব করা হয়েছে।');
      } catch (e) {
        console.warn('Routing error:', e);
      }
    } else {
      setGeoSuccess('Pickup location selected. Now enter destination or tap map. / পিকআপ লোকেশন নির্বাচিত। এখন গন্তব্য লিখুন বা ম্যাপে ট্যাপ করুন।');
    }
  };

  // Manual Google Places suggestion selection for Destination
  const handleManualDropSelect = async (address: string, coords: MapCoords) => {
    setGeoError(null);
    setGeoSuccess(null);

    // Exact Service Area Polygon validation
    const check = isWithinServicePolygon(coords.lat, coords.lng, serviceArea.polygon, serviceArea.enabled);
    if (!check.inService) {
      setGeoError('Destination is outside Chalo service area. / গন্তব্য Chalo-এর সার্ভিস এলাকার বাইরে।');
      setCenter(coords);
      return;
    }

    setDropCoords(coords);
    setDrop(address);
    setCenter(coords);

    // If pickup is already set, calculate route
    if (pickupCoords) {
      const currentRequestId = ++activeRouteRequestIdRef.current;
      try {
        const route = await calculateRoute(pickupCoords, coords);
        if (currentRequestId !== activeRouteRequestIdRef.current) return;
        setRouteResult(route);
        if (!fare) {
          const suggested = Math.max(30, Math.round(30 + route.distanceKm * 15));
          setFare(String(suggested));
        }
        setGeoSuccess('Pickup and destination selected. / পিকআপ ও গন্তব্য নির্বাচন সম্পন্ন।');
      } catch (e) {
        console.warn('Routing error:', e);
      }
    } else {
      setGeoSuccess('Destination selected. Now select pickup location or tap map. / গন্তব্য নির্বাচিত। এখন পিকআপ লোকেশন নির্বাচন করুন বা ম্যাপে ট্যাপ করুন।');
    }
  };

  const handleClearPickup = () => {
    setPickup('');
    setPickupCoords(null);
    setRouteResult(null);
    setFare('');
    activeRouteRequestIdRef.current++;
  };

  const handleClearDrop = () => {
    setDrop('');
    setDropCoords(null);
    setRouteResult(null);
    setFare('');
    activeRouteRequestIdRef.current++;
  };

  const handleSelectCurrentGpsForPickup = () => {
    if (!userLocation) return;
    handleManualPickupSelect('Current GPS Location / আমার বর্তমান অবস্থান', userLocation);
  };

  // Quick Hub destination click handler
  const handleQuickSelect = async (item: { label: string; address: string; lat: number; lng: number }) => {
    const coords: MapCoords = { lat: item.lat, lng: item.lng };
    setGeoError(null);

    if (!pickupCoords) {
      activeRouteRequestIdRef.current++;
      const check = isWithinServicePolygon(coords.lat, coords.lng, serviceArea.polygon, serviceArea.enabled);
      if (!check.inService) {
        setGeoError('Pickup location is outside Chalo service area. / পিকআপ লোকেশন Chalo-এর সার্ভিস এলাকার বাইরে।');
        return;
      }
      setPickupCoords(coords);
      setDropCoords(null);
      setRouteResult(null);
      setPickup(item.address);
      setDrop('');
      setCenter(coords);
      setGeoSuccess('Pickup location selected. Now tap the map to select destination. / পিকআপ লোকেশন নির্বাচিত। এখন গন্তব্য নির্বাচন করতে ম্যাপে ট্যাপ করুন।');
    } else if (!dropCoords) {
      const check = isWithinServicePolygon(coords.lat, coords.lng, serviceArea.polygon, serviceArea.enabled);
      if (!check.inService) {
        setGeoError('Destination is outside Chalo service area. / গন্তব্য Chalo-এর সার্ভিস এলাকার বাইরে।');
        return;
      }
      setDropCoords(coords);
      setDrop(item.address);
      setCenter(coords);

      const currentRequestId = ++activeRouteRequestIdRef.current;
      try {
        const route = await calculateRoute(pickupCoords, coords);
        if (currentRequestId !== activeRouteRequestIdRef.current) return;
        setRouteResult(route);
        if (!fare) {
          const suggested = Math.max(30, Math.round(30 + route.distanceKm * 15));
          setFare(String(suggested));
        }
        setGeoSuccess('Pickup and destination selected. / পিকআপ ও গন্তব্য নির্বাচন সম্পন্ন।');
      } catch (e) {
        console.warn('Routing error:', e);
      }
    } else {
      // If both already set, update destination to this hub
      setDropCoords(coords);
      setDrop(item.address);
      const currentRequestId = ++activeRouteRequestIdRef.current;
      try {
        const route = await calculateRoute(pickupCoords, coords);
        if (currentRequestId !== activeRouteRequestIdRef.current) return;
        setRouteResult(route);
        const suggested = Math.max(30, Math.round(30 + route.distanceKm * 15));
        setFare(String(suggested));
      } catch (e) {
        console.warn('Routing error:', e);
      }
    }
  };

  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setGeoError(null);
    setPassengerError(null);

    if (!pickupCoords || !dropCoords) {
      setGeoError('Please tap the map to set pickup and destination points. / অনুগ্রহ করে ম্যাপে ট্যাপ করে পিকআপ ও গন্তব্য নির্বাচন করুন।');
      return;
    }

    // Exact Google Maps polygon boundary verification
    const pickupCheck = isWithinServicePolygon(pickupCoords.lat, pickupCoords.lng, serviceArea.polygon, serviceArea.enabled);
    if (!pickupCheck.inService) {
      setGeoError('Pickup location is outside Chalo service area. / পিকআপ লোকেশন Chalo-এর সার্ভিস এলাকার বাইরে।');
      return;
    }

    const dropCheck = isWithinServicePolygon(dropCoords.lat, dropCoords.lng, serviceArea.polygon, serviceArea.enabled);
    if (!dropCheck.inService) {
      setGeoError('Destination is outside Chalo service area. / গন্তব্য Chalo-এর সার্ভিস এলাকার বাইরে।');
      return;
    }

    // Validate Passenger Count strictly (1-4 only)
    const passValidation = validatePassengerCount(passengerCount);
    if (!passValidation.isValid) {
      setPassengerError(passValidation.error);
      return;
    }

    setIsSearching(true);

    try {
      const route = routeResult || await calculateRoute(pickupCoords, dropCoords);
      const distance = Number(route.distanceKm.toFixed(2));
      const fareDetails = calculateRideFare(distance, passengerCount);

      const rideData = {
        userId: profile.uid,
        userName: profile.displayName,
        userPhoto: profile.photoURL || null,
        userPhone: profile.phoneNumber || '',
        pickup: {
          address: pickup || `(${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)})`,
          lat: pickupCoords.lat,
          lng: pickupCoords.lng
        },
        drop: {
          address: drop || `(${dropCoords.lat.toFixed(4)}, ${dropCoords.lng.toFixed(4)})`,
          lat: dropCoords.lat,
          lng: dropCoords.lng
        },
        distance: distance,
        passengerCount: passengerCount,
        routeDistanceKm: fareDetails.routeDistanceKm,
        baseFare: fareDetails.baseFare,
        passengerExtraCharge: fareDetails.passengerExtraCharge,
        finalFare: fareDetails.finalFare,
        userOfferedFare: fareDetails.finalFare,
        status: RideStatus.SEARCHING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(collection(db, 'rides'), rideData);
      setIsSearching(false);
      resetSelection();
      setHighlightRideId(docRef.id);
      setActiveTab('bookings');
    } catch (error) {
      console.error('Error requesting ride:', error);
      setIsSearching(false);
    }
  };

  if (profile?.role === UserRole.DRIVER) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-brand-100 p-6 rounded-3xl mb-8 shadow-inner"
        >
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center">
            <span className="text-white font-black text-xl italic leading-none">CL</span>
          </div>
        </motion.div>
        <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Ready to Ride?</h2>
        <p className="text-slate-500 mb-10 max-w-sm leading-relaxed font-medium">
          Switch to the Driver Dashboard to find and accept ride requests near you and start earning.
        </p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-brand-600 text-white px-10 py-4.5 rounded-2xl font-bold hover:bg-brand-700 shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center gap-2 group"
        >
          Go to Driver Dashboard
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 pb-12">
      {/* ========================================================================= */}
      {/* 0. USER PANEL TAB SWITCHER: BOOK RIDE vs MY BOOKINGS                      */}
      {/* ========================================================================= */}
      <div className="w-full max-w-3xl mx-auto flex items-center justify-between gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setActiveTab('book');
            if (location.pathname === '/my-bookings') {
              navigate('/', { replace: true });
            }
          }}
          className={cn(
            "flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all",
            activeTab === 'book'
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          )}
        >
          <Car className="w-4 h-4 text-brand-600 shrink-0" />
          <span>Book a Ride • রাইড বুক করুন</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('bookings');
          }}
          className={cn(
            "flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all relative",
            activeTab === 'bookings'
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          )}
        >
          <ClipboardList className="w-4 h-4 text-brand-600 shrink-0" />
          <span>My Bookings • আমার বুকিং</span>
          {userActiveRide && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-600 text-white animate-pulse">
              1 Active
            </span>
          )}
        </button>
      </div>

      {/* Persistent Active Ride Alert Banner (When on Book Ride screen) */}
      {userActiveRide && activeTab === 'book' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl mx-auto bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/30">
              <Car className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-brand-400">
                  Active Booking • সক্রিয় বুকিং
                </span>
                <span className="text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-slate-300">
                  #CL-{userActiveRide.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                {userActiveRide.status === RideStatus.SEARCHING
                  ? 'Searching for Driver • চালক খোঁজা হচ্ছে...'
                  : userActiveRide.status === RideStatus.ACCEPTED
                  ? `Driver Accepted (${userActiveRide.driverName || 'Driver'}) • চালক গ্রহণ করেছে`
                  : userActiveRide.status === RideStatus.ARRIVED
                  ? 'Driver Arriving • চালক আসছে'
                  : userActiveRide.status === RideStatus.IN_PROGRESS
                  ? 'Ride in Progress • যাত্রা চলছে'
                  : 'Active Ride'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>View in My Bookings • বুকিং দেখুন</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* SECTION VIEW: MY BOOKINGS vs BOOKING FLOW                                 */}
      {/* ========================================================================= */}
      {activeTab === 'bookings' ? (
        <MyBookingsSection
          onSwitchToBooking={() => setActiveTab('book')}
          highlightRideId={highlightRideId}
        />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. CLEAN GOOGLE MAP CONTAINER (NO LARGE OVERLAYS / NO CARDS OVER MAP)    */}
          {/* ========================================================================= */}
          <div className="relative w-full h-[55vh] sm:h-[62vh] min-h-[400px] sm:min-h-[480px] bg-slate-100 rounded-3xl overflow-hidden border border-slate-200/90 shadow-lg z-0">
            <GoogleMapView
              center={center}
              zoom={13}
              pickup={pickupCoords}
              drop={dropCoords}
              userLocation={userLocation}
              userLocationAccuracy={userAccuracy || undefined}
              userLocationLabel="🔵 User Current Location / আমার বর্তমান অবস্থান"
              servicePolygon={serviceArea.polygon}
              isServiceAreaEnabled={serviceArea.enabled}
              routePolyline={pickupCoords && dropCoords && routeResult?.polylinePath ? routeResult.polylinePath : []}
              onMapClick={handleMapClick}
              onRecenter={(pos) => {
                setCenter(pos);
                setUserLocation(pos);
              }}
              disableProviderToggle={true}
              showLegend={false}
              interactive={true}
              className="w-full h-full"
            />
          </div>

          {/* ========================================================================= */}
          {/* 2. BOOKING CONTROLS & SELECTED LOCATION DETAILS ALL BELOW THE GOOGLE MAP */}
          {/* ========================================================================= */}
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">

        {/* Dynamic Tap Guidance & Instruction Banner (Below Map) */}
        <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!pickupCoords ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/80 font-bold text-xs">
                1
              </div>
            ) : !dropCoords ? (
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/80 font-bold text-xs">
                2
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                ✓
              </div>
            )}

            <div className="min-w-0 flex-1">
              {!pickupCoords ? (
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    Select Pickup Location • পিকআপ লোকেশন নির্বাচন করুন
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                    Tap anywhere on the map to set pickup • পিকআপের জন্য ম্যাপে ট্যাপ করুন
                  </div>
                </div>
              ) : !dropCoords ? (
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    Now tap the map to select destination • এখন গন্তব্য নির্বাচন করতে ম্যাপে ট্যাপ করুন
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                    Tap destination point on map • ম্যাপে আপনার গন্তব্যে ট্যাপ করুন
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-700 leading-tight flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Pickup and destination selected • পিকআপ ও গন্তব্য নির্বাচন সম্পন্ন</span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                    Tap map again to reset • পুনরায় নতুন করে বেছে নিতে আবার ম্যাপে ট্যাপ করুন
                  </div>
                </div>
              )}
            </div>
          </div>

          {(pickupCoords || dropCoords) && (
            <button
              type="button"
              onClick={resetSelection}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 active:scale-95"
              title="Reset Selection / রিসেট"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Validation / Service Area Error Banner */}
        {geoError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-amber-900 text-xs sm:text-sm font-semibold shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="leading-snug">{geoError}</span>
          </motion.div>
        )}

        {/* Status / Success Banner */}
        {geoSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-900 text-xs sm:text-sm font-semibold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="leading-snug">{geoSuccess}</span>
          </motion.div>
        )}

        {/* Location Display Cards & Booking Form */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-lg space-y-4">
          <form onSubmit={handleRequestRide} className="space-y-4">
            
            {/* Pickup Location Input with Google Places Autocomplete */}
            <LocationAutocompleteInput
              id="pickup-location-input"
              label="Pickup Location"
              bengaliLabel="পিকআপ লোকেশন"
              placeholder="Type pickup (e.g. Harintana Bazar) or tap map"
              value={pickup}
              coords={pickupCoords}
              accentColor="green"
              onSelectLocation={handleManualPickupSelect}
              onClear={handleClearPickup}
              currentGpsLocation={userLocation}
              onSelectCurrentGps={handleSelectCurrentGpsForPickup}
              centerBias={center}
            />

            {/* Destination Location Input with Google Places Autocomplete */}
            <LocationAutocompleteInput
              id="destination-location-input"
              label="Destination"
              bengaliLabel="গন্তব্য"
              placeholder="Type destination (e.g. Kakdwip Station) or tap map"
              value={drop}
              coords={dropCoords}
              accentColor="red"
              onSelectLocation={handleManualDropSelect}
              onClear={handleClearDrop}
              centerBias={center}
            />

            {/* Number of Passengers / যাত্রী সংখ্যা Selector */}
            <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-600" />
                  <span>Number of Passengers / যাত্রী সংখ্যা</span>
                </label>
                <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                  Max 4 Passengers / সর্বোচ্চ ৪ জন
                </span>
              </div>

              {/* 1 to 4 Passenger Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((count) => {
                  const extra = getPassengerExtraCharge(count);
                  const isSelected = passengerCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handlePassengerChange(count)}
                      className={cn(
                        "p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all text-center",
                        isSelected
                          ? "bg-brand-600 text-white border-brand-700 shadow-md scale-[1.02]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-black">{count}</span>
                        <span className="text-xs font-semibold">{count === 1 ? 'Passenger' : 'Passengers'}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] mt-0.5 font-medium",
                        isSelected ? "text-brand-100" : "text-slate-500"
                      )}>
                        {count === 1 ? '১ জন (₹0 extra)' :
                         count === 2 ? '২ জন (+₹20)' :
                         count === 3 ? '৩ জন (+₹40)' :
                         '৪ জন (+₹60)'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Stepper / Manual input with strict validation */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-xs text-slate-600 font-medium">
                  Selected: <strong className="text-slate-900">{passengerCount} {passengerCount === 1 ? 'Passenger' : 'Passengers'} / {passengerCount} জন</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePassengerChange(passengerCount - 1)}
                    disabled={passengerCount <= 1}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-700 font-black hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-base shadow-sm"
                    title="Decrease passengers"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={passengerCount || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val)) {
                        setPassengerError('Please select 1–4 passengers. / অনুগ্রহ করে ১–৪ জন যাত্রী নির্বাচন করুন।');
                        setPassengerCount(0);
                        return;
                      }
                      if (val > 4) {
                        setPassengerError('Maximum 4 passengers allowed. / সর্বোচ্চ ৪ জন যাত্রী যেতে পারবেন।');
                        setPassengerCount(val);
                        return;
                      }
                      if (val < 1) {
                        setPassengerError('Please select 1–4 passengers. / অনুগ্রহ করে ১–৪ জন যাত্রী নির্বাচন করুন।');
                        setPassengerCount(val);
                        return;
                      }
                      handlePassengerChange(val);
                    }}
                    className="w-12 text-center text-sm font-black bg-white border border-slate-300 rounded-lg py-1 text-slate-900"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (passengerCount >= 4) {
                        setPassengerError('Maximum 4 passengers allowed. / সর্বোচ্চ ৪ জন যাত্রী যেতে পারবেন।');
                      } else {
                        handlePassengerChange(passengerCount + 1);
                      }
                    }}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-700 font-black hover:bg-slate-100 text-base shadow-sm"
                    title="Increase passengers"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Passenger Validation Error Message */}
              {passengerError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passengerError}</span>
                </div>
              )}
            </div>

            {/* Distance-Based Fare Breakdown (Displayed when route is ready) */}
            {pickupCoords && dropCoords && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-brand-50/60 rounded-2xl border border-brand-200/80 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-brand-200/60">
                  <span className="text-xs font-black text-brand-900 tracking-tight flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 text-brand-700" />
                    <span>Fare Breakdown & Route Details / ভাড়ার হিসাব</span>
                  </span>
                  {routeResult && (
                    <span className="text-[11px] font-bold text-brand-700 bg-white/80 px-2 py-0.5 rounded-lg border border-brand-200/60 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-600" />
                      <span>~{routeResult.durationMinutes} min</span>
                    </span>
                  )}
                </div>

                {/* Breakdown Grid: Distance, Base Fare, Passengers, Passenger Extra */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* 1. Distance */}
                  <div className="bg-white/95 p-2.5 rounded-xl border border-brand-100 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Navigation className="w-3 h-3 text-brand-600" />
                      Distance / দূরত্ব
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5">
                      {routeResult ? `${calculatedFareBreakdown?.routeDistanceKm ?? routeResult.distanceKm} km` : 'Calculating...'}
                    </span>
                  </div>

                  {/* 2. Base Fare */}
                  <div className="bg-white/95 p-2.5 rounded-xl border border-brand-100 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Base Fare / মূল ভাড়া
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5">
                      {calculatedFareBreakdown ? `₹${calculatedFareBreakdown.baseFare}` : '₹0'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">₹10 / km</span>
                  </div>

                  {/* 3. Passengers */}
                  <div className="bg-white/95 p-2.5 rounded-xl border border-brand-100 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3 h-3 text-brand-600" />
                      Passengers / যাত্রী
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5">
                      {passengerCount}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {passengerCount} জন
                    </span>
                  </div>

                  {/* 4. Passenger Extra */}
                  <div className="bg-white/95 p-2.5 rounded-xl border border-brand-100 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Extra / অতিরিক্ত
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5">
                      {calculatedFareBreakdown ? `₹${calculatedFareBreakdown.passengerExtraCharge}` : '₹0'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {passengerCount === 1 ? '1p=₹0' : passengerCount === 2 ? '2p=₹20' : passengerCount === 3 ? '3p=₹40' : '4p=₹60'}
                    </span>
                  </div>
                </div>

                {/* Total Fare Row */}
                <div className="pt-2 border-t border-brand-200/60 flex items-center justify-between bg-brand-100/70 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
                  <div>
                    <span className="text-[11px] uppercase font-black text-brand-900 block leading-tight">
                      Total Fare / মোট ভাড়া
                    </span>
                    <span className="text-[10px] text-brand-700 font-medium">
                      Base (₹{calculatedFareBreakdown?.baseFare ?? 0}) + Extra (₹{calculatedFareBreakdown?.passengerExtraCharge ?? 0})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-brand-900 tracking-tight">
                      ₹{calculatedFareBreakdown?.finalFare ?? fare ?? '0'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Fare Summary & Confirm Ride Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <div className="flex items-center gap-2 px-4 py-3 bg-brand-50/80 rounded-2xl border border-brand-200 w-full sm:w-48 shrink-0">
                <IndianRupee className="w-5 h-5 text-brand-700 shrink-0" />
                <div className="flex-1">
                  <span className="block text-[9px] font-bold text-brand-700 uppercase leading-none mb-0.5">
                    Final Fare / মোট ভাড়া
                  </span>
                  <div className="text-xl font-black text-brand-900 leading-tight">
                    ₹{calculatedFareBreakdown?.finalFare ?? fare ?? '0'}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isSearching ||
                  !pickupCoords ||
                  !dropCoords ||
                  !calculatedFareBreakdown ||
                  Boolean(passengerError) ||
                  passengerCount < 1 ||
                  passengerCount > 4
                }
                className={cn(
                  "flex-1 bg-brand-600 text-white flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-base shadow-xl shadow-brand-600/25 hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                )}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Finding Drivers / চালক খোঁজা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Ride / রাইড নিশ্চিত করুন (₹{calculatedFareBreakdown?.finalFare ?? fare ?? '0'})</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Hub Destination Chips */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Quick:</span>
                {[
                  { label: 'Station', address: 'Pathar Pratima Rail Station', lat: 21.8285, lng: 88.3582 },
                  { label: 'Ghat', address: 'Ramganga Ferry Ghat', lat: 21.8021, lng: 88.3752 },
                  { label: 'Market', address: 'Digambarpur Bazar', lat: 21.8654, lng: 88.3912 },
                  { label: 'Kakdwip', address: 'Kakdwip Station Road', lat: 21.8751, lng: 88.1884 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickSelect(item)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-xs font-semibold shrink-0 transition-colors border border-slate-200/70 active:scale-95"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

          </form>
        </div>

      </div>
      </>
      )}
    </div>
  );
}
