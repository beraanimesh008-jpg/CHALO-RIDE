import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { UserRole } from './types';
import { Home, ClipboardList, User, ShieldCheck, LogOut, Bike } from 'lucide-react';
import { cn } from './lib/utils';

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Home', shortLabel: 'Home', path: '/', icon: Home, roles: [UserRole.USER] },
    { label: 'My Bookings • আমার বুকিং', shortLabel: 'My Bookings', path: '/my-bookings', icon: ClipboardList, roles: [UserRole.USER] },
    { label: 'Driver Portal', shortLabel: 'Driver', path: '/dashboard', icon: Bike, roles: [UserRole.DRIVER] },
    { label: 'Admin Center', shortLabel: 'Admin', path: '/admin', icon: ShieldCheck, roles: [UserRole.ADMIN] },
    { label: 'Profile', shortLabel: 'Profile', path: '/profile', icon: User, roles: [UserRole.USER, UserRole.DRIVER, UserRole.ADMIN] },
  ];

  const filteredNavItems = navItems.filter(item => profile && item.roles.includes(profile.role));

  const getPortalBadge = () => {
    if (!profile) return null;
    if (profile.role === UserRole.ADMIN) {
      return (
        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Admin
        </span>
      );
    }
    if (profile.role === UserRole.DRIVER) {
      return (
        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Driver
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
        Passenger
      </span>
    );
  };

  const getBrandHomeLink = () => {
    if (!profile) return '/login';
    if (profile.role === UserRole.ADMIN) return '/admin';
    if (profile.role === UserRole.DRIVER) return '/dashboard';
    return '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="glass sticky top-0 z-50 border-b border-white/40">
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={getBrandHomeLink()} className="flex items-center gap-3 font-bold text-3xl tracking-tighter text-slate-900 group italic">
              <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-500/20 group-hover:rotate-6 transition-transform relative">
                <div className="w-6 h-6 flex items-center justify-center">
                  <span className="text-white text-xs font-black not-italic">CL</span>
                </div>
                <div className="absolute -top-1 -right-1 bg-accent-500 w-3 h-3 rounded-sm flex items-center justify-center">
                  <span className="text-[5px] font-bold text-white">AI</span>
                </div>
              </div>
              <span className="bg-gradient-to-r from-brand-600 to-brand-900 bg-clip-text text-transparent">
                Cha<span className="text-brand-600">Lo</span>
              </span>
            </Link>
            {getPortalBadge()}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center gap-2",
                  location.pathname === item.path 
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30" 
                    : "text-slate-600 hover:bg-white hover:text-brand-600 shadow-sm hover:shadow-md"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
            {profile && (
              <button 
                onClick={() => signOut()}
                className="p-2.5 text-slate-400 hover:text-red-500 transition-colors ml-2 bg-white rounded-xl shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5 px-3.5"
                title="Sign Out / লগ আউট"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-bold">Logout</span>
              </button>
            )}
          </nav>

          {/* Mobile Profile & Logout */}
          <div className="md:hidden flex items-center gap-2">
            {profile && (
              <>
                <Link to="/profile">
                  <img
                    src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`}
                    alt="Profile"
                    className="w-9 h-9 rounded-xl border-2 border-white shadow-md object-cover"
                  />
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 bg-white text-slate-500 hover:text-red-600 rounded-xl shadow-sm border border-slate-100"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      {/* SEO & Brand Footer */}
      <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-md mt-auto pt-8 pb-24 md:pb-10 text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand Intro */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="bg-brand-600 p-1.5 rounded-lg shadow-md text-white font-black text-xs">
                  CL
                </div>
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  Chalo<span className="text-brand-600">go</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chalogo (Chalo Go) is Sundarban's local Toto ride booking platform. 
                Connecting riders with verified local electric rickshaw drivers for station, ghat, market, and hospital travel.
              </p>
              <div className="text-[11px] font-semibold text-slate-400">
                Safe • Fixed Transparent Fares • Verified Drivers
              </div>
            </div>

            {/* Coverage Regions */}
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                Sundarban Service Regions
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Online Toto booking in Canning, Gosaba, Basanti, Namkhana, Kultali, Pathar Pratima, Raidighi, and Mathurapur.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Canning', 'Gosaba', 'Basanti', 'Namkhana', 'Kultali', 'Pathar Pratima', 'Raidighi', 'Mathurapur'].map((loc) => (
                  <span
                    key={loc}
                    className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md"
                  >
                    {loc}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Links & Safety */}
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                Quick Navigation & Support
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 font-medium">
                <li>
                  <Link to="/" className="hover:text-brand-600 transition-colors">
                    • Online Toto Booking Sundarban
                  </Link>
                </li>
                <li>
                  <Link to="/my-bookings" className="hover:text-brand-600 transition-colors">
                    • My Bookings (আমার বুকিং)
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className="hover:text-brand-600 transition-colors">
                    • User Profile & Verification
                  </Link>
                </li>
              </ul>
              <div className="pt-2 text-[11px] text-slate-400">
                Live GPS route navigation powered by Google Maps Platform.
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              © {new Date().getFullYear()} <strong>Chalogo</strong> • Sundarban Toto Booking Online. All rights reserved.
            </div>
            <div className="text-[11px] text-slate-400">
              Canning • Gosaba • Basanti • Namkhana • Kultali • Pathar Pratima • Raidighi • Mathurapur
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Nav */}
      <nav className="md:hidden glass border-t border-white/40 flex items-center justify-around h-20 sticky bottom-0 z-50 px-4 pb-4 pt-2">
        {filteredNavItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 px-5 py-2 rounded-2xl transition-all",
              location.pathname === item.path 
                ? "text-brand-600 bg-brand-50" 
                : "text-slate-400"
            )}
          >
            <item.icon className={cn("w-5 h-5", location.pathname === item.path ? "scale-110" : "")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.shortLabel || item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
