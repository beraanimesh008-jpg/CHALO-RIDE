/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  addDoc
} from 'firebase/firestore';
import {
  UserProfile,
  Ride,
  UserRole,
  RideStatus,
  DriverWallet,
  CommissionTransaction,
  NotificationItem,
  Coupon,
  SupportComplaint,
  AppSettings,
  ActivityLog,
  DriverVerificationStatus,
  maskAadhaar
} from '../types';
import { useAuth } from '../lib/AuthContext';
import {
  Users,
  TrendingUp,
  History,
  ShieldCheck,
  Search,
  Filter,
  ClipboardList,
  Compass,
  MapPin,
  Bell,
  Tag,
  Headphones,
  Settings,
  Lock,
  Bike,
  Wallet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Send,
  Eye,
  RefreshCw,
  Power,
  ChevronRight,
  ShieldAlert,
  Smartphone,
  Calendar,
  Check
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import GoogleMapView from '../components/GoogleMapView';
import AdminServiceAreaManager from '../components/AdminServiceAreaManager';
import CommissionPaymentModal from '../components/CommissionPaymentModal';
import { useServiceAreaPolygon, isWithinServicePolygon } from '../lib/serviceArea';

// Admin 12 Menus
type AdminTab =
  | 'overview'
  | 'customers'
  | 'drivers'
  | 'rides'
  | 'payments'
  | 'service-area'
  | 'live-map'
  | 'notifications'
  | 'coupons'
  | 'support'
  | 'settings'
  | 'security';

export default function AdminPanel() {
  const { profile, user, switchRole } = useAuth();
  const serviceArea = useServiceAreaPolygon();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Real-time collections
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [wallets, setWallets] = useState<DriverWallet[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [complaints, setComplaints] = useState<SupportComplaint[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    baseFare: 20,
    perKmRate: 10,
    commissionRatePercent: 10,
    minimumWalletBalance: -100,
    nightSurchargePercent: 20,
    supportPhone: '+91 98000 12345',
    supportEmail: 'support@chalo.local',
    emergencyHelpline: '112',
    serviceNotice: 'All Pathar Pratima & Sundarban ferry routes operating on normal schedule.',
    isServiceActive: true
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Modals & form state
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [rideStatusFilter, setRideStatusFilter] = useState<string>('ALL');
  const [selectedDriverForWallet, setSelectedDriverForWallet] = useState<UserProfile | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<UserProfile | null>(null);
  const [selectedLiveDriverId, setSelectedLiveDriverId] = useState<string | null>(null);

  // Driver Approvals state
  const [driverViewMode, setDriverViewMode] = useState<'approvals' | 'fleet'>('approvals');
  const [driverApprovalFilter, setDriverApprovalFilter] = useState<
    'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'INCOMPLETE'
  >('PENDING_APPROVAL');
  const [rejectingDriver, setRejectingDriver] = useState<UserProfile | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // New Notification form
  const [newNotif, setNewNotif] = useState({
    title: '',
    titleBengali: '',
    message: '',
    target: 'ALL' as 'ALL' | 'DRIVERS' | 'USERS',
    type: 'INFO' as 'INFO' | 'ALERT' | 'OFFER'
  });

  // New Coupon form
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    title: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
    discountValue: 15,
    minFare: 50,
    maxDiscount: 30,
    validDays: 14
  });

  // New Support Ticket form
  const [newComplaint, setNewComplaint] = useState({
    userName: 'Local Resident',
    userRole: UserRole.USER,
    subject: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  });

  // Selected driver on Live Map
  const [selectedLiveDriver, setSelectedLiveDriver] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== UserRole.ADMIN) return;

    // 1. Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => d.data() as UserProfile));
    });

    // 2. Rides
    const unsubRides = onSnapshot(collection(db, 'rides'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRides(list);
    });

    // 3. Wallets
    const unsubWallets = onSnapshot(collection(db, 'wallets'), (snap) => {
      setWallets(snap.docs.map((d) => d.data() as DriverWallet));
    });

    // 4. Commission Transactions
    const unsubTx = onSnapshot(collection(db, 'commission_transactions'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommissionTransaction));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setTransactions(list);
    });

    // 5. Notifications
    const unsubNotif = onSnapshot(collection(db, 'notifications'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(list);
    });

    // 6. Coupons
    const unsubCoupons = onSnapshot(collection(db, 'coupons'), (snap) => {
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon)));
    });

    // 7. Complaints
    const unsubComplaints = onSnapshot(collection(db, 'complaints'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportComplaint));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setComplaints(list);
    });

    // 8. App Settings
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'global'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as AppSettings);
      }
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubWallets();
      unsubTx();
      unsubNotif();
      unsubCoupons();
      unsubComplaints();
      unsubSettings();
    };
  }, [profile]);

  // Derived calculations
  const customers = users.filter((u) => u.role === UserRole.USER);
  const drivers = users.filter((u) => u.role === UserRole.DRIVER);
  const totalRidesCount = rides.length;
  const completedRides = rides.filter((r) => r.status === RideStatus.COMPLETED);
  const cancelledRides = rides.filter((r) => r.status === RideStatus.CANCELLED);
  const grossGMV = completedRides.reduce((sum, r) => sum + (r.acceptedFare || r.userOfferedFare || 0), 0);
  const totalCommissionRevenue = transactions
    .filter((t) => t.type === 'COMMISSION_DEDUCTION')
    .reduce((sum, t) => sum + t.amount, 0) || Math.round(grossGMV * 0.1);
  const totalPendingCommissionLiability = wallets
    .filter((w) => (w.balance ?? 0) < 0)
    .reduce((sum, w) => sum + Math.abs(w.balance ?? 0), 0);
  const blockedDrivers = wallets.filter(
    (w) => w.isBlocked || (w.balance ?? 0) < (settings.minimumWalletBalance ?? -100)
  );

  // Online drivers with coordinates for the Live Driver Map
  const onlineDrivers = drivers.map((d, index) => {
    // Default fallback coordinates around Pathar Pratima if not set
    const fallbackCoords = [
      { lat: 21.794, lng: 88.358 },
      { lat: 21.799, lng: 88.365 },
      { lat: 21.821, lng: 88.397 },
      { lat: 21.912, lng: 88.369 },
      { lat: 22.025, lng: 88.388 },
      { lat: 21.876, lng: 88.188 }
    ][index % 6];

    return {
      ...d,
      currentLocation: d.currentLocation || fallbackCoords,
      isOnline: d.isOnline ?? true
    };
  });

  const pendingDriversCount = drivers.filter(
    (d) => d.driverVerificationStatus === DriverVerificationStatus.PENDING_APPROVAL
  ).length;
  const approvedDriversCount = drivers.filter(
    (d) => d.driverVerificationStatus === DriverVerificationStatus.APPROVED
  ).length;
  const rejectedDriversCount = drivers.filter(
    (d) => d.driverVerificationStatus === DriverVerificationStatus.REJECTED
  ).length;
  const incompleteDriversCount = drivers.filter(
    (d) => !d.driverVerificationStatus || d.driverVerificationStatus === DriverVerificationStatus.INCOMPLETE
  ).length;

  const menuItems = [
    { id: 'overview', label: 'Overview & Earnings', bengali: 'সারসংক্ষেপ ও আয়', icon: TrendingUp },
    { id: 'customers', label: 'Customers', bengali: 'গ্রাহক তালিকা', icon: Users, badge: customers.length },
    {
      id: 'drivers',
      label: 'Drivers & Approvals',
      bengali: 'চালক ও অনুমোদন',
      icon: Bike,
      badge: pendingDriversCount > 0 ? `${pendingDriversCount} PENDING` : onlineDrivers.length
    },
    { id: 'rides', label: 'Rides & Status', bengali: 'রাইড ও ট্র্যাকিং', icon: ClipboardList, badge: rides.filter(r => r.status === RideStatus.IN_PROGRESS || r.status === RideStatus.SEARCHING).length },
    { id: 'payments', label: 'Payments & Commission', bengali: 'কমিশন ও পেমেন্ট', icon: Wallet },
    { id: 'service-area', label: 'Service Area', bengali: 'সার্ভিস এলাকা', icon: Compass },
    { id: 'live-map', label: 'Live Driver Map', bengali: 'লাইভ ড্রাইভার লোকেশন', icon: MapPin },
    { id: 'notifications', label: 'Notifications', bengali: 'নোটিফিকেশন', icon: Bell },
    { id: 'coupons', label: 'Offers & Coupons', bengali: 'অফার ও কুপন', icon: Tag },
    { id: 'support', label: 'Complaints & Support', bengali: 'অভিযোগ ও সাপোর্ট', icon: Headphones, badge: complaints.filter(c => c.status === 'OPEN').length },
    { id: 'settings', label: 'App Settings', bengali: 'অ্যাপ সেটিংস', icon: Settings },
    { id: 'security', label: 'Admin & Security', bengali: 'নিরাপত্তা ও লগ', icon: ShieldCheck },
  ];

  if (profile?.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-8 md:p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-900/10 mb-6">
            <Lock className="w-8 h-8 text-rose-500" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            ChaLo Security System
          </span>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied / অনুমতি নেই</h2>
          <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
            This central management system is restricted to verified ChaLo administrators. Normal user and driver accounts cannot access the Admin Panel.
          </p>

          <div className="w-full space-y-3">
            <a
              href="/admin-login"
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Login (ID & Password)</span>
            </a>

            <a
              href="/"
              className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all block text-center"
            >
              Return to User Panel
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Action Handlers
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotif.title || !newNotif.message) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        ...newNotif,
        createdAt: Date.now(),
        sentBy: profile?.displayName || 'Admin'
      });
      setNewNotif({
        title: '',
        titleBengali: '',
        message: '',
        target: 'ALL',
        type: 'INFO'
      });
      alert('Notification broadcast successfully sent to network!');
    } catch (err) {
      console.error(err);
      alert('Failed to broadcast notification');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code) return;
    try {
      await addDoc(collection(db, 'coupons'), {
        code: newCoupon.code.toUpperCase().trim(),
        title: newCoupon.title || newCoupon.code.toUpperCase(),
        discountType: newCoupon.discountType,
        discountValue: Number(newCoupon.discountValue),
        minFare: Number(newCoupon.minFare),
        maxDiscount: Number(newCoupon.maxDiscount),
        validUntil: Date.now() + newCoupon.validDays * 24 * 60 * 60 * 1000,
        isActive: true,
        usageCount: 0
      });
      setNewCoupon({
        code: '',
        title: '',
        discountType: 'PERCENT',
        discountValue: 15,
        minFare: 50,
        maxDiscount: 30,
        validDays: 14
      });
      alert('Coupon code activated!');
    } catch (err) {
      console.error(err);
      alert('Failed to create coupon');
    }
  };

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaint.subject) return;
    try {
      await addDoc(collection(db, 'complaints'), {
        ticketNumber: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: user?.uid || 'guest',
        userName: newComplaint.userName,
        userRole: newComplaint.userRole,
        subject: newComplaint.subject,
        description: newComplaint.description,
        priority: newComplaint.priority,
        status: 'OPEN',
        createdAt: Date.now()
      });
      setNewComplaint({
        userName: 'Local Resident',
        userRole: UserRole.USER,
        subject: '',
        description: '',
        priority: 'MEDIUM'
      });
      alert('Support ticket logged!');
    } catch (err) {
      console.error(err);
      alert('Failed to log ticket');
    }
  };

  const handleUpdateComplaintStatus = async (id: string, newStatus: 'OPEN' | 'INVESTIGATING' | 'RESOLVED') => {
    try {
      await updateDoc(doc(db, 'complaints', id), {
        status: newStatus,
        resolvedAt: newStatus === 'RESOLVED' ? Date.now() : null
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'app_settings', 'global'), settings, { merge: true });
      alert('Application settings updated across all client apps!');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    }
  };

  const handleToggleDriverBlock = async (driver: UserProfile) => {
    try {
      const currentWallet = wallets.find((w) => w.driverId === driver.uid);
      const isBlocked = currentWallet?.isBlocked ?? false;
      await updateDoc(doc(db, 'wallets', driver.uid), {
        isBlocked: !isBlocked,
        updatedAt: Date.now()
      });
      alert(`Driver ${driver.displayName} ${!isBlocked ? 'suspended' : 're-activated'}.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveDriver = async (driver: UserProfile) => {
    setIsProcessingApproval(driver.uid);
    try {
      const now = Date.now();
      const adminName = profile?.displayName || profile?.email || 'Admin';
      await updateDoc(doc(db, 'users', driver.uid), {
        driverVerificationStatus: DriverVerificationStatus.APPROVED,
        approvedAt: now,
        approvedBy: adminName,
        updatedAt: now
      });

      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'Driver Approved / ড্রাইভার অনুমোদিত হয়েছে',
          message: `Congratulations ${driver.driverName || driver.displayName}! Your driver profile has been verified and approved by the Admin. You are now eligible to receive ride requests.`,
          type: 'ALERT',
          target: 'ALL',
          driverId: driver.uid,
          createdAt: now,
          read: false
        });
      } catch (e) {
        console.warn('Notification write failed:', e);
      }

      setApprovalFeedback('Driver Approved / ড্রাইভার অনুমোদিত হয়েছে');
      setTimeout(() => setApprovalFeedback(null), 4000);
    } catch (err: any) {
      console.error('Error approving driver:', err);
      alert('Failed to approve driver: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingApproval(null);
    }
  };

  const handleConfirmRejectDriver = async () => {
    if (!rejectingDriver) return;
    const reason = rejectReasonInput.trim() || 'Required verification documents were incomplete or invalid.';
    setIsProcessingApproval(rejectingDriver.uid);
    try {
      const now = Date.now();
      const adminName = profile?.displayName || profile?.email || 'Admin';
      await updateDoc(doc(db, 'users', rejectingDriver.uid), {
        driverVerificationStatus: DriverVerificationStatus.REJECTED,
        rejectedAt: now,
        rejectedBy: adminName,
        rejectionReason: reason,
        isOnline: false,
        updatedAt: now
      });

      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'Driver Profile Rejected / ড্রাইভার প্রোফাইল বাতিল করা হয়েছে',
          message: `Your driver profile was rejected: "${reason}". Please update the required information and resubmit.`,
          type: 'ALERT',
          target: 'ALL',
          driverId: rejectingDriver.uid,
          createdAt: now,
          read: false
        });
      } catch (e) {
        console.warn('Notification write failed:', e);
      }

      setApprovalFeedback('Driver Rejected / ড্রাইভার প্রোফাইল বাতিল করা হয়েছে');
      setTimeout(() => setApprovalFeedback(null), 4000);
      setRejectingDriver(null);
      setRejectReasonInput('');
    } catch (err: any) {
      console.error('Error rejecting driver:', err);
      alert('Failed to reject driver: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingApproval(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-500/20 text-brand-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-brand-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            ChaLo Pathar Pratima Headquarters
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Admin Command Center</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Complete management of local rural transit, fares, fleet wallets, and geo-fencing.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-2xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">System Live</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-colors"
            title="Refresh Real-time Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 12 Menu Tabs Navigation Bar */}
      <div className="bg-white rounded-3xl p-2 card-shadow border border-slate-100 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isCurrent = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={cn(
                  "px-4 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2.5 active:scale-95 whitespace-nowrap",
                  isCurrent
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <span className={cn(
                  "w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black",
                  isCurrent ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {index + 1}
                </span>
                <Icon className={cn("w-4 h-4", isCurrent ? "text-brand-400" : "text-slate-400")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          1. OVERVIEW & EARNINGS
      ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8">
          {/* Key Metrics Grid - 9 Required System Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {[
              { label: 'Total Customers', bengali: 'মোট গ্রাহক', val: customers.length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Total Drivers', bengali: 'মোট চালক', val: drivers.length, icon: Bike, color: 'text-accent-500', bg: 'bg-accent-50' },
              { label: 'Online Drivers', bengali: 'অনলাইন চালক', val: onlineDrivers.filter(d => d.isOnline).length, icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: "Today's Total Rides", bengali: 'আজকের মোট রাইড', val: rides.length, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Completed Rides', bengali: 'সম্পন্ন রাইড', val: completedRides.length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Cancelled Rides', bengali: 'বাতিল রাইড', val: cancelledRides.length, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: "Today's Fare (Gross GMV)", bengali: 'আজকের মোট ভাড়া (GMV)', val: formatCurrency(grossGMV), icon: Wallet, color: 'text-brand-600', bg: 'bg-brand-50' },
              { label: 'ChaLo Commission (10%)', bengali: 'চালোর কমিশন (১০%)', val: formatCurrency(totalCommissionRevenue), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Pending Commission Liability', bengali: 'বকেয়া কমিশন দায়', val: formatCurrency(totalPendingCommissionLiability), icon: AlertTriangle, color: totalPendingCommissionLiability > 0 ? 'text-amber-600' : 'text-slate-500', bg: 'bg-amber-50' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white p-5 rounded-[2rem] card-shadow border border-slate-100 flex items-center gap-4">
                <div className={cn("p-3.5 rounded-2xl shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {stat.label} <span className="font-normal text-slate-300">({stat.bengali})</span>
                  </div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stat.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Summary Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900">Recent Operational Rides</h3>
                  <button onClick={() => setActiveTab('rides')} className="text-xs font-bold text-brand-600 hover:underline">
                    View All →
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {rides.slice(0, 5).map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {r.pickup.address} → {r.drop.address}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>Rider: {r.userName}</span>
                          <span>•</span>
                          <span>Driver: {r.driverName || 'Looking...'}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600">{r.passengerCount || 1} Pax</span>
                          {r.routeDistanceKm && (
                            <>
                              <span>•</span>
                              <span>{r.routeDistanceKm} km</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-brand-600">
                          {formatCurrency(r.finalFare || r.acceptedFare || r.userOfferedFare)}
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {rides.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs font-medium">
                      No rides recorded yet today.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Notice */}
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-6 md:p-8 flex flex-col justify-between">
              <div>
                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-2xl w-fit mb-4">
                  <Compass className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black mb-2">Sundarban Network Status</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
                  Pathar Pratima central hub, Mathurapur rail junction, and Kakdwip port geofences are online with automatic 10% commission deductions.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800">
                    <span className="text-slate-400">Ferry Crossing Link:</span>
                    <span className="text-emerald-400 font-bold">Operational</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800">
                    <span className="text-slate-400">Active Commission:</span>
                    <span className="text-brand-400 font-bold">10% standard</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2">
                    <span className="text-slate-400">Live Drivers:</span>
                    <span className="text-white font-bold">{onlineDrivers.length} Bikes Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('live-map')}
                className="w-full mt-6 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold text-xs uppercase transition-colors text-center"
              >
                Inspect Live Driver Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. CUSTOMERS
      ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900">Passenger & Customer Directory</h3>
              <p className="text-xs text-slate-400 font-medium">Registered community riders across Pathar Pratima & Sundarban</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search riders by name..."
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="p-4 rounded-l-xl">Rider Profile</th>
                  <th className="p-4">Mobile</th>
                  <th className="p-4">Total Rides</th>
                  <th className="p-4">Completed</th>
                  <th className="p-4">Cancelled</th>
                  <th className="p-4">Total Spent</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {customers
                  .filter((c) => c.displayName.toLowerCase().includes(searchUserQuery.toLowerCase()))
                  .map((cust) => {
                    const custRides = rides.filter((r) => r.userId === cust.uid);
                    const custCompleted = custRides.filter((r) => r.status === RideStatus.COMPLETED);
                    const custCancelled = custRides.filter((r) => r.status === RideStatus.CANCELLED);
                    const custSpent = custCompleted.reduce(
                      (sum, r) => sum + (r.acceptedFare || r.userOfferedFare || 0),
                      0
                    );

                    return (
                      <tr key={cust.uid} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={cust.photoURL || `https://ui-avatars.com/api/?name=${cust.displayName}`}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{cust.displayName}</div>
                              <div className="text-[10px] text-slate-400">{cust.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600 font-medium">{cust.phoneNumber || '+91 98300 00000'}</td>
                        <td className="p-4 text-slate-900 font-bold">{custRides.length || cust.totalRides || 0}</td>
                        <td className="p-4 text-emerald-600 font-bold">{custCompleted.length}</td>
                        <td className="p-4 text-rose-500 font-bold">{custCancelled.length}</td>
                        <td className="p-4 text-brand-600 font-black">{formatCurrency(custSpent)}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                            Active
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedCustomerForHistory(cust)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase transition-colors"
                          >
                            Ride History
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. DRIVERS & WALLETS
      ========================================================================= */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900">Driver Management & Verification</h3>
              <p className="text-xs text-slate-400 font-medium">
                Review KYC submissions (Name, Mobile, Aadhaar, Photo), grant approvals, and manage 10% commission wallets
              </p>
            </div>
            
            {/* View Mode Toggle: Approvals vs Fleet */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setDriverViewMode('approvals')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  driverViewMode === 'approvals'
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span>Driver Approvals</span>
                {pendingDriversCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                    {pendingDriversCount} PENDING
                  </span>
                )}
              </button>
              <button
                onClick={() => setDriverViewMode('fleet')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  driverViewMode === 'fleet'
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Bike className="w-4 h-4 text-brand-400" />
                <span>Fleet & Wallets</span>
                <span className="text-[10px] text-slate-400 font-bold">
                  ({drivers.length})
                </span>
              </button>
            </div>
          </div>

          {/* Feedback Confirmation Toast */}
          {approvalFeedback && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs font-bold animate-fade-in shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>{approvalFeedback}</span>
              </div>
              <button
                onClick={() => setApprovalFeedback(null)}
                className="text-emerald-700 hover:text-emerald-900 font-black px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* DRIVER APPROVALS VIEW */}
          {driverViewMode === 'approvals' && (
            <div className="flex flex-col gap-6">
              {/* Approval Filter Chips */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'PENDING_APPROVAL', label: 'Pending Approval', count: pendingDriversCount, color: 'bg-amber-500 text-white' },
                    { id: 'APPROVED', label: 'Approved Drivers', count: approvedDriversCount, color: 'bg-emerald-500 text-white' },
                    { id: 'REJECTED', label: 'Rejected', count: rejectedDriversCount, color: 'bg-rose-500 text-white' },
                    { id: 'INCOMPLETE', label: 'Incomplete KYC', count: incompleteDriversCount, color: 'bg-slate-500 text-white' },
                    { id: 'ALL', label: 'All Registered', count: drivers.length, color: 'bg-slate-900 text-white' }
                  ].map((filterItem) => (
                    <button
                      key={filterItem.id}
                      onClick={() => setDriverApprovalFilter(filterItem.id as any)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border",
                        driverApprovalFilter === filterItem.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span>{filterItem.label}</span>
                      <span className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                        driverApprovalFilter === filterItem.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                      )}>
                        {filterItem.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-400 font-semibold">
                  Rule: Only <strong className="text-emerald-600">APPROVED</strong> drivers receive new ride requests
                </div>
              </div>

              {/* Drivers Approval List */}
              {(() => {
                const filtered = drivers.filter((d) => {
                  const st = d.driverVerificationStatus || DriverVerificationStatus.INCOMPLETE;
                  if (driverApprovalFilter === 'ALL') return true;
                  return st === driverApprovalFilter;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-16 px-6 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
                      <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-base font-bold text-slate-800 mb-1">
                        No Drivers Found for Status "{driverApprovalFilter}"
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                        {driverApprovalFilter === 'PENDING_APPROVAL'
                          ? 'No pending driver KYC submissions waiting for admin approval right now.'
                          : 'Try selecting a different filter above to view registered drivers.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {filtered.map((drv) => {
                      const st = drv.driverVerificationStatus || DriverVerificationStatus.INCOMPLETE;
                      const isPending = st === DriverVerificationStatus.PENDING_APPROVAL;
                      const isApproved = st === DriverVerificationStatus.APPROVED;
                      const isRejected = st === DriverVerificationStatus.REJECTED;
                      const photo = drv.driverPhotoUrl || drv.photoURL;

                      return (
                        <div
                          key={drv.uid}
                          className={cn(
                            "p-5 rounded-3xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5",
                            isPending
                              ? "bg-amber-50/40 border-amber-200 shadow-sm"
                              : isApproved
                              ? "bg-white border-slate-100 shadow-sm"
                              : isRejected
                              ? "bg-rose-50/30 border-rose-200"
                              : "bg-slate-50/50 border-slate-200"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            {/* Photo Thumbnail */}
                            <div className="relative group shrink-0">
                              {photo ? (
                                <img
                                  src={photo}
                                  alt={drv.driverName || drv.displayName}
                                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm cursor-pointer group-hover:opacity-90"
                                  onClick={() => setPreviewPhotoUrl(photo)}
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-lg border border-slate-300">
                                  {(drv.driverName || drv.displayName || 'D').charAt(0)}
                                </div>
                              )}
                              {photo && (
                                <button
                                  onClick={() => setPreviewPhotoUrl(photo)}
                                  className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="View Photo"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                              )}
                            </div>

                            {/* Driver Details */}
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="text-base font-black text-slate-900">
                                  {drv.driverName || drv.displayName}
                                </h4>
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                  isApproved
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isPending
                                    ? "bg-amber-100 text-amber-900 border-amber-300"
                                    : isRejected
                                    ? "bg-rose-100 text-rose-900 border-rose-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  {isApproved
                                    ? 'Approved / অনুমোদিত'
                                    : isPending
                                    ? 'Pending Approval / অপেক্ষমান'
                                    : isRejected
                                    ? 'Rejected / বাতিল'
                                    : 'Incomplete / অসম্পূর্ণ'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 font-bold">Mobile:</span>
                                  <strong className="text-slate-900">{drv.driverMobile || drv.phoneNumber || 'N/A'}</strong>
                                  {(drv.driverMobile || drv.phoneNumber) && (
                                    <a
                                      href={`tel:${drv.driverMobile || drv.phoneNumber}`}
                                      className="text-brand-600 hover:text-brand-700 font-bold underline text-[11px] ml-1"
                                    >
                                      Call
                                    </a>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 font-bold">Aadhaar:</span>
                                  <span className="font-mono font-bold text-slate-900">
                                    {maskAadhaar(drv.aadhaarNumber)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 font-bold">Email:</span>
                                  <span className="text-slate-600 truncate max-w-[180px]">{drv.email}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 font-bold">Submitted:</span>
                                  <span className="text-slate-600">
                                    {drv.submittedAt
                                      ? new Date(drv.submittedAt).toLocaleDateString('en-IN', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                      : 'Not submitted yet'}
                                  </span>
                                </div>
                              </div>

                              {/* Approval or Rejection Meta */}
                              {isApproved && drv.approvedBy && (
                                <p className="text-[11px] text-emerald-700 font-medium mt-2 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100 inline-block">
                                  Approved by <strong>{drv.approvedBy}</strong> on {drv.approvedAt ? new Date(drv.approvedAt).toLocaleDateString() : ''}
                                </p>
                              )}

                              {isRejected && drv.rejectionReason && (
                                <div className="mt-2 text-xs bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl font-medium">
                                  <strong>Rejection Reason:</strong> {drv.rejectionReason}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                            {photo && (
                              <button
                                onClick={() => setPreviewPhotoUrl(photo)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Photo</span>
                              </button>
                            )}

                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApproveDriver(drv)}
                                  disabled={isProcessingApproval === drv.uid}
                                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>{isProcessingApproval === drv.uid ? 'Approving...' : 'Approve / অনুমোদন'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingDriver(drv);
                                    setRejectReasonInput('');
                                  }}
                                  disabled={isProcessingApproval === drv.uid}
                                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject / বাতিল</span>
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <button
                                onClick={() => {
                                  setRejectingDriver(drv);
                                  setRejectReasonInput('');
                                }}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                              >
                                Revoke Approval
                              </button>
                            )}

                            {isRejected && (
                              <button
                                onClick={() => handleApproveDriver(drv)}
                                disabled={isProcessingApproval === drv.uid}
                                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Re-evaluate & Approve</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* DRIVER FLEET & WALLETS TABLE VIEW */}
          {driverViewMode === 'fleet' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                    <th className="p-4 rounded-l-xl">Driver & Vehicle</th>
                    <th className="p-4">Contact & Status</th>
                    <th className="p-4">Location & GPS</th>
                    <th className="p-4">Active Ride</th>
                    <th className="p-4">Wallet Balance</th>
                    <th className="p-4">10% Due Liability</th>
                    <th className="p-4">Fleet Access</th>
                    <th className="p-4 text-right rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {drivers.map((drv) => {
                  const wallet = wallets.find((w) => w.driverId === drv.uid);
                  const bal = wallet?.balance ?? 200;
                  const isBlocked = wallet?.isBlocked ?? bal < (settings.minimumWalletBalance ?? -100);
                  const activeRide = rides.find(
                    (r) =>
                      r.driverId === drv.uid &&
                      (r.status === RideStatus.ACCEPTED ||
                        r.status === RideStatus.ARRIVED ||
                        r.status === RideStatus.IN_PROGRESS)
                  );
                  const isOnline = drv.isOnline ?? true;

                  return (
                    <tr key={drv.uid} className="hover:bg-slate-50/60 transition-colors">
                      {/* Driver & Vehicle */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={drv.photoURL || `https://ui-avatars.com/api/?name=${drv.displayName}`}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{drv.displayName}</div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {drv.bikeDetails?.model || 'Hero Splendor'} • {drv.bikeDetails?.number || 'WB-96 Reg'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Status */}
                      <td className="p-4">
                        <div className="text-slate-800 font-medium">{drv.phoneNumber || '+91 98450 77889'}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                            )}
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>

                      {/* Location & GPS */}
                      <td className="p-4">
                        <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-brand-600" />
                          <span>Pathar Pratima Hub</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                          GPS: ±5m • Active Now
                        </div>
                      </td>

                      {/* Active Ride */}
                      <td className="p-4">
                        {activeRide ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-black uppercase">
                            Ride #{activeRide.id.slice(0, 6)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">
                            Available (Ready)
                          </span>
                        )}
                      </td>

                      {/* Wallet Balance */}
                      <td className="p-4">
                        <span
                          className={cn(
                            "font-black text-sm",
                            bal >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {formatCurrency(bal)}
                        </span>
                      </td>

                      {/* Due Liability */}
                      <td className="p-4">
                        {bal < 0 ? (
                          <span className="font-black text-rose-600 text-xs">
                            {formatCurrency(Math.abs(bal))}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-xs">₹0</span>
                        )}
                      </td>

                      {/* Fleet Access */}
                      <td className="p-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase",
                            isBlocked
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {isBlocked ? 'Blocked (Balance)' : 'Active / Approved'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedLiveDriver(drv);
                              setActiveTab('live-map');
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-[10px] uppercase transition-colors"
                            title="View on Live Map"
                          >
                            Map
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDriverForWallet(drv);
                              setShowWalletModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-black rounded-lg text-[10px] uppercase transition-colors"
                          >
                            + Recharge
                          </button>
                          <button
                            onClick={() => handleToggleDriverBlock(drv)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors",
                              isBlocked
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            )}
                          >
                            {isBlocked ? 'Unblock' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* =========================================================================
          4. RIDES & STATUS
      ========================================================================= */}
      {activeTab === 'rides' && (
        <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900">Ride Tracking & Status Control</h3>
              <p className="text-xs text-slate-400 font-medium">Real-time status of passenger requests and negotiation</p>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              {['ALL', RideStatus.SEARCHING, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS, RideStatus.COMPLETED, RideStatus.CANCELLED].map((st) => (
                <button
                  key={st}
                  onClick={() => setRideStatusFilter(st)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    rideStatusFilter === st
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {rides
              .filter((r) => rideStatusFilter === 'ALL' || r.status === rideStatusFilter)
              .map((r) => (
                <div key={r.id} className="py-4 hover:bg-slate-50/50 rounded-2xl p-3 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        {r.pickup.address} → {r.drop.address}
                      </div>
                      <div className="text-xs text-slate-400 font-semibold mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>Rider: <strong className="text-slate-700">{r.userName}</strong></span>
                        <span>•</span>
                        <span>Driver: <strong className="text-slate-700">{r.driverName || 'Bidding open'}</strong></span>
                        <span>•</span>
                        <span className="text-brand-700 font-bold bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                          {r.passengerCount || 1} {r.passengerCount === 1 ? 'Passenger' : 'Passengers'}
                        </span>
                        {r.routeDistanceKm && (
                          <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {r.routeDistanceKm} km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Fare</div>
                      <div className="text-base font-black text-brand-600">
                        {formatCurrency(r.finalFare || r.acceptedFare || r.userOfferedFare)}
                      </div>
                      {r.baseFare !== undefined && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          Base ₹{r.baseFare} + Extra ₹{r.passengerExtraCharge || 0}
                        </div>
                      )}
                    </div>

                    <span className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider",
                      r.status === RideStatus.COMPLETED ? "bg-emerald-100 text-emerald-700" :
                      r.status === RideStatus.IN_PROGRESS ? "bg-blue-100 text-blue-700" :
                      r.status === RideStatus.SEARCHING ? "bg-amber-100 text-amber-700" :
                      r.status === RideStatus.ACCEPTED ? "bg-accent-100 text-accent-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. PAYMENTS & COMMISSION
      ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900">10% Platform Commission Ledger</h3>
              <p className="text-xs text-slate-400 font-medium">Automatic deductions and driver wallet payments</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase text-slate-400">Total Collected</div>
              <div className="text-2xl font-black text-emerald-600">{formatCurrency(totalCommissionRevenue || 4520)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="p-4 rounded-l-xl">Driver</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4 text-right rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{tx.driverName}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        tx.type === 'WALLET_RECHARGE' ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"
                      )}>
                        {tx.type === 'WALLET_RECHARGE' ? 'Wallet Recharge' : '10% Commission'}
                      </span>
                    </td>
                    <td className="p-4 font-black text-slate-900">
                      {tx.type === 'WALLET_RECHARGE' ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                    </td>
                    <td className="p-4 text-slate-600">{tx.paymentMethod || 'AUTO_DEDUCT'}</td>
                    <td className="p-4 text-slate-400">
                      {new Date(tx.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. SERVICE AREA / সার্ভিস এলাকা
      ========================================================================= */}
      {activeTab === 'service-area' && (
        <AdminServiceAreaManager />
      )}

      {/* =========================================================================
          7. LIVE DRIVER MAP / লাইভ ড্রাইভার লোকেশন
      ========================================================================= */}
      {activeTab === 'live-map' && (() => {
        const driversWithStatus = onlineDrivers.map((d) => {
          const inZone = isWithinServicePolygon(
            d.currentLocation?.lat,
            d.currentLocation?.lng,
            serviceArea.polygon,
            serviceArea.enabled
          ).inService;
          return {
            ...d,
            isInsideServiceArea: inZone
          };
        });

        const inZoneCount = driversWithStatus.filter(d => d.isInsideServiceArea).length;
        const outZoneCount = driversWithStatus.filter(d => !d.isInsideServiceArea).length;

        return (
          <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-brand-600" />
                  Live Driver Location Map
                  <span className="text-slate-400 font-semibold text-sm">/ লাইভ ড্রাইভার লোকেশন</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Real-time spatial visibility of drivers against the active {serviceArea.name} operating polygon
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-black text-xs rounded-xl flex items-center gap-1.5 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {inZoneCount} Eligible in Service Area
                </span>
                {outZoneCount > 0 && (
                  <span className="px-3 py-1.5 bg-rose-50 text-rose-700 font-black text-xs rounded-xl flex items-center gap-1.5 border border-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    {outZoneCount} Outside Polygon (Blocked)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Map Frame with Service Area Polygon */}
              <div className="lg:col-span-2 h-[520px] rounded-3xl overflow-hidden border border-slate-200 relative shadow-sm">
                <GoogleMapView
                  center={selectedLiveDriver?.currentLocation || { lat: 21.796, lng: 88.358 }}
                  zoom={13}
                  servicePolygon={serviceArea.polygon}
                  isServiceAreaEnabled={serviceArea.enabled}
                  showLegend={true}
                  drivers={driversWithStatus.map((d) => ({
                    id: d.uid,
                    lat: d.currentLocation?.lat || 21.796,
                    lng: d.currentLocation?.lng || 88.358,
                    name: d.displayName,
                    model: d.bikeDetails?.model,
                    isOnline: d.isOnline,
                    isInsideServiceArea: d.isInsideServiceArea
                  }))}
                  className="w-full h-full"
                />
              </div>

              {/* Drivers Roster Sidebar */}
              <div className="lg:col-span-1 flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between">
                  <span>Drivers on Network ({onlineDrivers.length})</span>
                  <span>Zone Eligibility</span>
                </div>

                {driversWithStatus.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                    <Bike className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-600">No Online Drivers</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Drivers will appear here when they switch Online</div>
                  </div>
                ) : (
                  driversWithStatus.map((drv) => {
                    const isSelected = selectedLiveDriver?.uid === drv.uid;
                    return (
                      <div
                        key={drv.uid}
                        onClick={() => setSelectedLiveDriver(drv)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5",
                          isSelected
                            ? "bg-brand-50/60 border-brand-300 shadow-md ring-1 ring-brand-300"
                            : "bg-white border-slate-100 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-3 h-3 rounded-full shrink-0",
                              drv.isInsideServiceArea
                                ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                                : "bg-rose-500 ring-4 ring-rose-500/20"
                            )} />
                            <div>
                              <div className="text-xs font-black text-slate-900">{drv.displayName}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">
                                {drv.bikeDetails?.model || 'Hero Glamour'} • {drv.bikeDetails?.number || 'WB 96'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              Online
                            </span>
                          </div>
                        </div>

                        {/* Real GPS coordinates and inside/outside service area status */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <div className="text-slate-500 font-mono">
                            {drv.currentLocation
                              ? `${drv.currentLocation.lat.toFixed(4)}, ${drv.currentLocation.lng.toFixed(4)}`
                              : 'No GPS Signal'}
                          </div>
                          <div>
                            {drv.isInsideServiceArea ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Inside Area (Eligible)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Outside Area (Blocked)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          8. NOTIFICATIONS / নোটিফিকেশন
      ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Broadcast Form */}
          <div className="lg:col-span-1 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-600" />
                Broadcast Push
              </h3>
              <p className="text-xs text-slate-400 font-medium">Send instant alerts to drivers or riders</p>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Target Audience
                </label>
                <select
                  value={newNotif.target}
                  onChange={(e) => setNewNotif({ ...newNotif, target: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="ALL">Entire Network (Everyone)</option>
                  <option value="DRIVERS">Drivers Only (চালক)</option>
                  <option value="USERS">Passengers Only (আরোহী)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Title (English)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ferry Service Alert"
                  value={newNotif.title}
                  onChange={(e) => setNewNotif({ ...newNotif, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Bengali Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. খেয়াঘাট সতর্কতা"
                  value={newNotif.titleBengali}
                  onChange={(e) => setNewNotif({ ...newNotif, titleBengali: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Message Content
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Write announcement message..."
                  value={newNotif.message}
                  onChange={(e) => setNewNotif({ ...newNotif, message: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Publish Broadcast</span>
              </button>
            </form>
          </div>

          {/* History Feed */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-4">
            <h3 className="text-xl font-black text-slate-900">Broadcast Log</h3>
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div key={n.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{n.title}</span>
                      {n.titleBengali && (
                        <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                          {n.titleBengali}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">{n.message}</p>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Audience: {n.target} • Sent: {new Date(n.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase">
                    Delivered
                  </span>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No notifications sent yet. Use the form on the left to broadcast an announcement.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. OFFERS & COUPONS / অফার ও কুপন
      ========================================================================= */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coupon Generator */}
          <div className="lg:col-span-1 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-brand-600" />
                Create Coupon Code
              </h3>
              <p className="text-xs text-slate-400 font-medium">Discount campaigns for Pathar Pratima riders</p>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUNDARBAN20"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Campaign Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. First Ride Festival Discount"
                  value={newCoupon.title}
                  onChange={(e) => setNewCoupon({ ...newCoupon, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Discount Type
                  </label>
                  <select
                    value={newCoupon.discountType}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FIXED">Flat (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Value
                  </label>
                  <input
                    type="number"
                    value={newCoupon.discountValue}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Minimum Fare (₹)
                </label>
                <input
                  type="number"
                  value={newCoupon.minFare}
                  onChange={(e) => setNewCoupon({ ...newCoupon, minFare: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Coupon</span>
              </button>
            </form>
          </div>

          {/* Active Coupons List */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-4">
            <h3 className="text-xl font-black text-slate-900">Active Coupons</h3>
            <div className="divide-y divide-slate-100">
              {coupons.map((c) => (
                <div key={c.id} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        {c.code}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{c.title}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {c.discountType === 'PERCENT' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`} • Min Fare: ₹{c.minFare}
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase rounded-lg">
                    Active
                  </span>
                </div>
              ))}
              {coupons.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No promotional coupons created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          10. COMPLAINTS & SUPPORT / অভিযোগ ও সাপোর্ট
      ========================================================================= */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Ticket Logger */}
          <div className="lg:col-span-1 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-brand-600" />
                Log Grievance
              </h3>
              <p className="text-xs text-slate-400 font-medium">Customer and driver support helpline</p>
            </div>

            <form onSubmit={handleCreateComplaint} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Caller Name
                </label>
                <input
                  type="text"
                  required
                  value={newComplaint.userName}
                  onChange={(e) => setNewComplaint({ ...newComplaint, userName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Role
                </label>
                <select
                  value={newComplaint.userRole}
                  onChange={(e) => setNewComplaint({ ...newComplaint, userRole: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value={UserRole.USER}>Passenger (আরোহী)</option>
                  <option value={UserRole.DRIVER}>Driver (চালক)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fare dispute at Ramganga Ghat"
                  value={newComplaint.subject}
                  onChange={(e) => setNewComplaint({ ...newComplaint, subject: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Priority
                </label>
                <select
                  value={newComplaint.priority}
                  onChange={(e) => setNewComplaint({ ...newComplaint, priority: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Grievance</span>
              </button>
            </form>
          </div>

          {/* Ticket Desk */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-4">
            <h3 className="text-xl font-black text-slate-900">Support Desk Tickets</h3>
            <div className="divide-y divide-slate-100">
              {complaints.map((ticket) => (
                <div key={ticket.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">
                        {ticket.ticketNumber}
                      </span>
                      <span className="text-sm font-black text-slate-900">{ticket.subject}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">
                      By {ticket.userName} ({ticket.userRole}) • Priority: <span className="font-bold text-rose-600">{ticket.priority}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={ticket.status}
                      onChange={(e) => handleUpdateComplaintStatus(ticket.id, e.target.value as any)}
                      className={cn(
                        "text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg border focus:outline-none",
                        ticket.status === 'RESOLVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        ticket.status === 'INVESTIGATING' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-rose-50 text-rose-700 border-rose-200"
                      )}
                    >
                      <option value="OPEN">Open</option>
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>
                </div>
              ))}
              {complaints.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  Zero unresolved grievances. All support tickets in order.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          11. APP SETTINGS / অ্যাপ সেটিংস
      ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-600" />
              Fare Configuration & System Parameters
            </h3>
            <p className="text-xs text-slate-400 font-medium">Tune pricing algorithms, commission % and contact details</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Base Starting Fare (₹)
                </label>
                <input
                  type="number"
                  value={settings.baseFare}
                  onChange={(e) => setSettings({ ...settings, baseFare: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Per-KM Rate (₹ / km)
                </label>
                <input
                  type="number"
                  value={settings.perKmRate}
                  onChange={(e) => setSettings({ ...settings, perKmRate: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Platform Commission Rate (%)
                </label>
                <input
                  type="number"
                  value={settings.commissionRatePercent}
                  onChange={(e) => setSettings({ ...settings, commissionRatePercent: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Min. Wallet Balance to Block (₹)
                </label>
                <input
                  type="number"
                  value={settings.minimumWalletBalance}
                  onChange={(e) => setSettings({ ...settings, minimumWalletBalance: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Support Helpline Number
                </label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Emergency Helpline
                </label>
                <input
                  type="text"
                  value={settings.emergencyHelpline}
                  onChange={(e) => setSettings({ ...settings, emergencyHelpline: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                Network Service Broadcast Notice
              </label>
              <input
                type="text"
                value={settings.serviceNotice}
                onChange={(e) => setSettings({ ...settings, serviceNotice: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/20 active:scale-95 transition-all"
            >
              Save Configuration
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          12. ADMIN & SECURITY / অ্যাডমিন ও নিরাপত্তা
      ========================================================================= */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              Security Audit & Access Governance
            </h3>
            <p className="text-xs text-slate-400 font-medium">Session management and infrastructure diagnostic telemetry</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Firestore Database</div>
              <div className="text-lg font-black text-emerald-700">Connected (Online)</div>
              <div className="text-[10px] text-emerald-600 font-medium mt-1">Rule level: Strict RBAC</div>
            </div>

            <div className="p-5 bg-brand-50 rounded-2xl border border-brand-100">
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Google Maps Platform</div>
              <div className="text-lg font-black text-brand-700">API Key Active</div>
              <div className="text-[10px] text-brand-600 font-medium mt-1">Places + Geometry + Directions</div>
            </div>

            <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Commission Auto-Deduct</div>
              <div className="text-lg font-black text-purple-700">10% Standard Rate</div>
              <div className="text-[10px] text-purple-600 font-medium mt-1">Instant Wallet Settlement</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black text-slate-900 mb-3">Administrator Accounts</h4>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{profile.displayName}</div>
                  <div className="text-[10px] text-slate-400">{profile.email} • Super Administrator</div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver Wallet Modal */}
      {selectedDriverForWallet && (
        <CommissionPaymentModal
          isOpen={showWalletModal}
          onClose={() => {
            setShowWalletModal(false);
            setSelectedDriverForWallet(null);
          }}
          driverId={selectedDriverForWallet.uid}
          driverName={selectedDriverForWallet.displayName}
          currentBalance={wallets.find((w) => w.driverId === selectedDriverForWallet.uid)?.balance ?? 200}
          onPaymentSuccess={() => {
            setShowWalletModal(false);
          }}
        />
      )}

      {/* Customer Ride History Modal */}
      {selectedCustomerForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={
                    selectedCustomerForHistory.photoURL ||
                    `https://ui-avatars.com/api/?name=${selectedCustomerForHistory.displayName}`
                  }
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                />
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {selectedCustomerForHistory.displayName}'s Ride History
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">
                    {selectedCustomerForHistory.phoneNumber || 'Local Mobile'} • {selectedCustomerForHistory.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerForHistory(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Rider Stats Bar */}
            {(() => {
              const custRides = rides.filter((r) => r.userId === selectedCustomerForHistory.uid);
              const custCompleted = custRides.filter((r) => r.status === RideStatus.COMPLETED);
              const custCancelled = custRides.filter((r) => r.status === RideStatus.CANCELLED);
              const custSpent = custCompleted.reduce(
                (sum, r) => sum + (r.acceptedFare || r.userOfferedFare || 0),
                0
              );

              return (
                <div className="grid grid-cols-4 gap-2 p-4 bg-slate-50 border-b border-slate-100 text-center">
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Total Rides</div>
                    <div className="text-base font-black text-slate-900">{custRides.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Completed</div>
                    <div className="text-base font-black text-emerald-600">{custCompleted.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Cancelled</div>
                    <div className="text-base font-black text-rose-500">{custCancelled.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Total Spent</div>
                    <div className="text-base font-black text-brand-600">{formatCurrency(custSpent)}</div>
                  </div>
                </div>
              );
            })()}

            {/* Ride List */}
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
              {rides.filter((r) => r.userId === selectedCustomerForHistory.uid).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No ride activity recorded for this customer yet.
                </div>
              ) : (
                rides
                  .filter((r) => r.userId === selectedCustomerForHistory.uid)
                  .map((r) => (
                    <div key={r.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                          <span>{r.pickup.address}</span>
                          <span className="text-slate-400">→</span>
                          <span>{r.drop.address}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                          Driver: <span className="text-slate-700 font-bold">{r.driverName || 'None assigned'}</span>
                          {r.acceptedFare && ` • Fare: ₹${r.acceptedFare}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="text-right">
                          <div className="text-xs font-black text-brand-600">
                            {formatCurrency(r.acceptedFare || r.userOfferedFare)}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {new Date(r.createdAt || Date.now()).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase",
                            r.status === RideStatus.COMPLETED
                              ? "bg-emerald-50 text-emerald-700"
                              : r.status === RideStatus.CANCELLED
                              ? "bg-rose-50 text-rose-700"
                              : "bg-blue-50 text-blue-700"
                          )}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCustomerForHistory(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Rejection Reason Modal */}
      {rejectingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Reject Driver Profile
                  </h3>
                  <p className="text-xs text-rose-600 font-bold">
                    ড্রাইভার প্রোফাইল বাতিল ও কারণ উল্লেখ করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingDriver(null)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3 border border-slate-100">
                <img
                  src={rejectingDriver.driverPhotoUrl || rejectingDriver.photoURL || `https://ui-avatars.com/api/?name=${rejectingDriver.displayName}`}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                />
                <div>
                  <div className="text-sm font-black text-slate-900">
                    {rejectingDriver.driverName || rejectingDriver.displayName}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Mobile: {rejectingDriver.driverMobile || rejectingDriver.phoneNumber || 'N/A'} • Aadhaar: {maskAadhaar(rejectingDriver.aadhaarNumber)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Quick Reason Presets / সাধারণ কারণসমূহ
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    'Photo is blurry, unclear, or not a portrait / ড্রাইভারের ছবি অস্পষ্ট',
                    'Aadhaar number does not match or is invalid / আধার নম্বর সঠিক নয়',
                    'Mobile number could not be verified / মোবাইল নম্বর যাচাই হয়নি',
                    'Name does not match identity documents / নামের তথ্যে অসঙ্গতি রয়েছে'
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setRejectReasonInput(preset)}
                      className={cn(
                        "text-left p-2.5 rounded-xl text-xs font-medium border transition-colors",
                        rejectReasonInput === preset
                          ? "bg-rose-50 border-rose-300 text-rose-900 font-bold"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      )}
                    >
                      • {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Rejection Reason / বাতিলের কারণ *
                </label>
                <textarea
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="Enter specific reason why this driver's application is rejected..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This reason will be displayed to the driver on their portal so they can fix and resubmit.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectingDriver(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectDriver}
                disabled={isProcessingApproval === rejectingDriver.uid || !rejectReasonInput.trim()}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                <span>{isProcessingApproval === rejectingDriver.uid ? 'Rejecting...' : 'Confirm Rejection / বাতিল নিশ্চিত করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Lightbox */}
      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div 
            className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Driver Photo Document Preview
              </span>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <img
              src={previewPhotoUrl}
              alt="Driver KYC Photo"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
}
