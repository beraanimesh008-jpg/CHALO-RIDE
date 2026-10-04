/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  MapPin, 
  ShieldCheck, 
  Navigation, 
  Clock, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ArrowRight,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { MapCoords } from '../types';

interface LocationHub {
  name: string;
  nameBn: string;
  coords: MapCoords;
  description: string;
  landmarks: string[];
  popularFor: string;
}

const SUNDARBAN_HUBS: LocationHub[] = [
  {
    name: 'Canning',
    nameBn: 'ক্যানিং',
    coords: { lat: 22.3108, lng: 88.6582 },
    description: 'Gateway to Sundarban with major railway connectivity, hospital, and ferry points.',
    landmarks: ['Canning Railway Station', 'Matla River Ghat', 'Hospital More'],
    popularFor: 'Toto booking Canning & station transit'
  },
  {
    name: 'Gosaba',
    nameBn: 'গোসাবা',
    coords: { lat: 22.1652, lng: 88.8075 },
    description: 'Key island hub serving rural markets, ferry jetties, and eco-tourism transit.',
    landmarks: ['Gosaba Bazar', 'Godkhali Ferry Ghat', 'Hamilton Estate'],
    popularFor: 'Online Toto booking in Gosaba & island travel'
  },
  {
    name: 'Basanti',
    nameBn: 'বাসন্তী',
    coords: { lat: 22.1974, lng: 88.7051 },
    description: 'Vital connecting junction between Canning and deep delta island routes.',
    landmarks: ['Basanti Highway Crossing', 'Sonakhali Ghat', 'Basanti Hospital'],
    popularFor: 'Toto ride Basanti & daily market commute'
  },
  {
    name: 'Namkhana',
    nameBn: 'নামখানা',
    coords: { lat: 21.7645, lng: 88.2327 },
    description: 'Important riverbank transit hub connecting Bakkhali and coastal Sundarban routes.',
    landmarks: ['Namkhana Station', 'Hatania Doania Bridge', 'Ferry Jetty'],
    popularFor: 'Online Toto booking in Namkhana & coastal trips'
  },
  {
    name: 'Kultali',
    nameBn: 'কুলতলি',
    coords: { lat: 22.0833, lng: 88.6015 },
    description: 'Scenic delta settlement with active rural commerce and riverbank pathways.',
    landmarks: ['Kultali Block More', 'Jamtala Bazar', 'River Sluice Gate'],
    popularFor: 'Local Toto booking Kultali & eco routes'
  },
  {
    name: 'Pathar Pratima',
    nameBn: 'পাথরপ্রতিমা',
    coords: { lat: 21.7960, lng: 88.3580 },
    description: 'Central hub for local village roads, weekly haats, and river ferry crossings.',
    landmarks: ['Ramganga Ghat', 'Pathar Pratima Station', 'Digambarpur'],
    popularFor: 'Toto ride Pathar Pratima & daily rides'
  },
  {
    name: 'Raidighi',
    nameBn: 'রায়দিঘি',
    coords: { lat: 22.0014, lng: 88.4357 },
    description: 'Flourishing river port town with bustling markets, schools, and medical hubs.',
    landmarks: ['Raidighi Ferry Ghat', 'College More', 'Thana Road'],
    popularFor: 'Online Toto booking in Raidighi & town commute'
  },
  {
    name: 'Mathurapur',
    nameBn: 'মথুরাপুর',
    coords: { lat: 22.1158, lng: 88.3934 },
    description: 'Historic station hub providing fast links towards Diamond Harbour and Kolkata.',
    landmarks: ['Mathurapur Station', 'Station Bazar', 'Mandirbazar Junction'],
    popularFor: 'Toto booking Mathurapur & train connection'
  }
];

const FAQS = [
  {
    q: 'How to book Toto online in Sundarban with Chalogo?',
    qBn: 'Chalogo-তে সুন্দরবনে কীভাবে অনলাইন টোটো বুক করবেন?',
    a: 'Simply open the Chalogo app, select your pickup location on the map, choose your destination, select passenger count (1-4), and tap "Confirm Ride". Nearby verified drivers will receive your request immediately.'
  },
  {
    q: 'Which areas in Sundarban are covered for Toto ride booking?',
    qBn: 'সুন্দরবনের কোন কোন এলাকায় টোটো রাইড বুকিং সুবিধা আছে?',
    a: 'Chalogo provides online Toto ride booking across Canning, Gosaba, Basanti, Namkhana, Kultali, Pathar Pratima, Raidighi, and Mathurapur, including all connected rural villages, railway stations, and river ferry ghats.'
  },
  {
    q: 'Can I find a local Toto ride booking near me for stations and ferry ghats?',
    qBn: 'আমার কাছাকাছি রেলস্টেশন বা ফেরিঘাটের জন্য কি টোটো বুক করা যাবে?',
    a: 'Yes! Whether you need a Toto booking at Canning Station, Namkhana Railway Station, Ramganga Ghat, Godkhali Ghat, or local markets, Chalogo connects you with nearby available drivers with live GPS tracking.'
  },
  {
    q: 'How is the Toto ride fare calculated in Chalogo?',
    qBn: 'Chalogo টোটো রাইডের ভাড়া কীভাবে হিসাব করা হয়?',
    a: 'Fares are completely transparent based on the official Chalo fixed distance fare chart (1–60 km) by passenger count (1, 2, 3, or 4 passengers). You see the exact fare upfront before confirming your ride with no hidden charges.'
  },
  {
    q: 'Are Chalogo Toto drivers verified and reliable?',
    qBn: 'Chalogo-এর টোটো চালকেরা কি যাচাইকৃত এবং বিশ্বস্ত?',
    a: 'Every Toto driver on Chalogo is locally verified with mobile number and vehicle credentials approved by the admin team, ensuring safe, respectful, and reliable transit across Sundarban.'
  }
];

interface SundarbanSeoInfoProps {
  onSelectHub?: (coords: MapCoords, name: string) => void;
}

export default function SundarbanSeoInfo({ onSelectHub }: SundarbanSeoInfoProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'hubs' | 'features' | 'faq'>('hubs');

  return (
    <section className="w-full max-w-3xl mx-auto mt-6 space-y-6 text-slate-800">
      {/* Informative Header / Title Banner */}
      <div className="bg-gradient-to-br from-white to-brand-50/40 rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-brand-600" />
          <span>Chalogo • Sundarban Local Ride Booking</span>
        </div>
        
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
          Chalogo: Online Toto Booking in Sundarban
          <span className="block text-sm sm:text-base font-bold text-slate-600 mt-1 font-sans">
            ক্যানিং, গোসাবা, বাসন্তী, নামখানা ও সুন্দরবনের প্রতিটি অঞ্চলে সহজ ও নিরাপদ টোটো বুকিং
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Experience seamless <strong>online Toto ride booking</strong> across the Sundarban delta with <strong>Chalogo (Chalo Go)</strong>. 
          Connect instantly with verified local drivers for railway stations, river ferry ghats, hospitals, schools, and village markets. 
          Enjoy fair transparent fares, live GPS route tracking, and comfortable travel.
        </p>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-[11px] font-bold text-slate-800 leading-tight">
              Verified Drivers
              <span className="block text-[10px] text-slate-500 font-medium">যাচাইকৃত চালক</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
            <Navigation className="w-4 h-4 text-brand-600 shrink-0" />
            <div className="text-[11px] font-bold text-slate-800 leading-tight">
              Live GPS Tracking
              <span className="block text-[10px] text-slate-500 font-medium">লাইভ ট্র্যাকিং</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-[11px] font-bold text-slate-800 leading-tight">
              Quick Dispatch
              <span className="block text-[10px] text-slate-500 font-medium">দ্রুত সেবা</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="text-[11px] font-bold text-slate-800 leading-tight">
              Fixed Chart Fare
              <span className="block text-[10px] text-slate-500 font-medium">স্বচ্ছ চার্ট ভাড়া</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher for Rich Content */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('hubs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'hubs'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Covered Locations & Hubs (এলাকা সমূহ)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('faq')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'faq'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Frequently Asked Questions (FAQ)
        </button>
      </div>

      {/* Location Hubs Grid */}
      {activeTab === 'hubs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-600" />
              <span>Popular Locations for Toto Booking in Sundarban</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              Tap location to set map center
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUNDARBAN_HUBS.map((hub) => (
              <div
                key={hub.name}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-brand-300 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                        {hub.name}{' '}
                        <span className="text-xs font-bold text-slate-400 font-sans">
                          ({hub.nameBn})
                        </span>
                      </h3>
                      <div className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {hub.popularFor}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    {hub.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {hub.landmarks.map((landmark) => (
                      <span
                        key={landmark}
                        className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                      >
                        • {landmark}
                      </span>
                    ))}
                  </div>
                </div>

                {onSelectHub && (
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.coords, hub.name)}
                    className="w-full mt-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-brand-600 hover:text-white text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200/80 group-hover:border-transparent active:scale-95"
                  >
                    <span>View {hub.name} on Map / ম্যাপে দেখুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Section */}
      {activeTab === 'faq' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Sundarban Toto Ride Booking Guide & FAQ
            </h2>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-black text-slate-900">
                        {faq.q}
                      </div>
                      <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                        {faq.qBn}
                      </div>
                    </div>
                    <div className="p-1 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom SEO Summary Banner */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-500 leading-relaxed flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800 font-bold">Local Toto ride booking near me in Sundarban:</strong>{' '}
          Chalogo connects commuters, tourists, and daily travelers with reliable local Toto service in Canning, 
          Gosaba, Basanti, Namkhana, Kultali, Pathar Pratima, Raidighi, and Mathurapur. 
          Book online, negotiate fairly, and travel safely.
        </div>
      </div>
    </section>
  );
}
