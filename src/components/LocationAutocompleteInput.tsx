/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Loader2,
  X,
  Locate
} from 'lucide-react';
import { cn } from '../lib/utils';
import { DEFAULT_CENTER } from '../constants';

export interface GooglePlaceSuggestion {
  id: string;
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  prediction?: any;
}

// Helper to asynchronously get or import the modern Places (New) library
async function getPlacesLibrary(): Promise<any> {
  const google = typeof window !== 'undefined' ? (window as any).google : undefined;
  if (!google?.maps) return null;
  if (google.maps.places?.AutocompleteSuggestion) {
    return google.maps.places;
  }
  if (typeof google.maps.importLibrary === 'function') {
    try {
      return await google.maps.importLibrary('places');
    } catch (e) {
      console.warn('Could not import places library:', e);
    }
  }
  return google.maps.places || null;
}

interface LocationAutocompleteProps {
  id?: string;
  label: string;
  bengaliLabel?: string;
  placeholder: string;
  value: string;
  coords?: { lat: number; lng: number } | null;
  onSelectLocation: (address: string, coords: { lat: number; lng: number }) => void;
  onClear?: () => void;
  accentColor?: 'green' | 'red';
  disabled?: boolean;
  currentGpsLocation?: { lat: number; lng: number } | null;
  onSelectCurrentGps?: () => void;
  centerBias?: { lat: number; lng: number };
}

export default function LocationAutocompleteInput({
  id,
  label,
  bengaliLabel,
  placeholder,
  value,
  coords,
  onSelectLocation,
  onClear,
  accentColor = 'green',
  disabled = false,
  currentGpsLocation,
  onSelectCurrentGps,
  centerBias
}: LocationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const searchRequestIdRef = useRef<number>(0);
  const sessionTokenRef = useRef<any>(null);

  // Sync internal input string with external value
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute reference location for Google Places soft location bias
  const referencePoint = currentGpsLocation || centerBias || DEFAULT_CENTER;

  // Query Google Places Autocomplete ONLY when the user types via Places API (New)
  const searchGooglePlaces = async (text: string) => {
    const trimmed = text.trim();
    const requestId = ++searchRequestIdRef.current;

    // RULE: When input is empty, do NOT show any place suggestions
    if (!trimmed) {
      setSuggestions([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const placesLib = await getPlacesLibrary();
      if (!placesLib) {
        setIsLoading(false);
        return;
      }

      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;

      // Modern Places API (New) AutocompleteSuggestion
      if (AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        if (!sessionTokenRef.current && AutocompleteSessionToken) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request: any = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in']
        };

        if (referencePoint) {
          request.locationBias = {
            center: { lat: referencePoint.lat, lng: referencePoint.lng },
            radius: 50000 // 50km soft bias
          };
        }

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (requestId !== searchRequestIdRef.current) return;

        setIsLoading(false);
        const placeSuggestions = response?.suggestions || [];
        const results: GooglePlaceSuggestion[] = placeSuggestions.map((s: any) => {
          const pred = s.placePrediction;
          const mainText = pred?.mainText?.text || pred?.text?.toString() || '';
          const secondaryText = pred?.secondaryText?.text || '';
          const fullText = pred?.text?.toString() || mainText;
          return {
            id: pred?.placeId || Math.random().toString(),
            placeId: pred?.placeId || '',
            primaryText: mainText,
            secondaryText: secondaryText,
            fullText: fullText,
            prediction: pred
          };
        });

        setSuggestions(results);
        return;
      }
    } catch (err) {
      console.warn('Places API (New) fetchAutocompleteSuggestions notice:', err);
    }

    if (requestId === searchRequestIdRef.current) {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setQuery(newVal);

    if (!newVal.trim()) {
      setSuggestions([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchGooglePlaces(newVal);
    }, 200);
  };

  // User manually selects ONE suggestion -> Resolve exact Google Place geometry via Places API (New)
  const handleSelectSuggestion = async (item: GooglePlaceSuggestion) => {
    setIsOpen(false);
    setIsResolving(true);

    try {
      const placesLib = await getPlacesLibrary();

      // Convert prediction to Place object or create Place by ID using Places API (New)
      let placeInstance: any = null;
      if (item.prediction && typeof item.prediction.toPlace === 'function') {
        placeInstance = item.prediction.toPlace();
      } else if (placesLib?.Place && item.placeId) {
        placeInstance = new placesLib.Place({ id: item.placeId });
      }

      if (placeInstance && typeof placeInstance.fetchFields === 'function') {
        await placeInstance.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location']
        });

        if (placeInstance.location) {
          const loc = placeInstance.location;
          const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
          const formattedAddress = placeInstance.formattedAddress || placeInstance.displayName || item.fullText || item.primaryText;

          // Reset session token after place selection per best practices
          sessionTokenRef.current = null;

          setQuery(formattedAddress);
          setIsResolving(false);
          onSelectLocation(formattedAddress, { lat, lng });
          return;
        }
      }
    } catch (err) {
      console.warn('Places API (New) place details notice:', err);
    }

    setIsResolving(false);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setHasSearched(false);
    setIsOpen(false);
    if (onClear) {
      onClear();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Determine if dropdown should be visible
  const hasGpsQuickAction = Boolean(
    accentColor === 'green' && currentGpsLocation && onSelectCurrentGps && !query.trim()
  );
  const showDropdown = isOpen && (hasGpsQuickAction || query.trim().length > 0);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Label Header */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <label htmlFor={id} className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <span
            className={cn(
              "w-2.5 h-2.5 rounded-full ring-4 transition-all shrink-0",
              accentColor === 'green'
                ? "bg-emerald-500 ring-emerald-500/20"
                : "bg-rose-500 ring-rose-500/20"
            )}
          />
          <span>{label}</span>
          {bengaliLabel && <span className="text-slate-400 font-normal normal-case">/ {bengaliLabel}</span>}
        </label>

        {coords ? (
          <span
            className={cn(
              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border",
              accentColor === 'green'
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            )}
          >
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </span>
        ) : (
          <span className="text-[10px] text-brand-600 font-semibold">
            Tap map or type
          </span>
        )}
      </div>

      {/* Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          {isResolving ? (
            <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
          ) : (
            <MapPin
              className={cn(
                "w-4 h-4 transition-colors",
                coords
                  ? accentColor === 'green'
                    ? "text-emerald-600"
                    : "text-rose-600"
                  : "text-slate-400"
              )}
            />
          )}
        </div>

        <input
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim()) {
              setIsOpen(true);
              searchGooglePlaces(query);
            } else if (hasGpsQuickAction) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "w-full pl-10 pr-9 py-3 bg-white border rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 transition-all shadow-sm outline-none",
            coords
              ? accentColor === 'green'
                ? "border-emerald-300 focus:ring-2 focus:ring-emerald-500/30"
                : "border-rose-300 focus:ring-2 focus:ring-rose-500/30"
              : "border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
            disabled && "bg-slate-100 opacity-75 cursor-not-allowed"
          )}
        />

        {/* Clear Button */}
        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Clear location"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Google Places Suggestion Dropdown (Only appears when user types) */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100">
          
          {/* Quick Option: Current GPS Location (ONLY when input is empty for Pickup) */}
          {hasGpsQuickAction && !query.trim() && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onSelectCurrentGps) onSelectCurrentGps();
              }}
              className="w-full text-left px-3.5 py-2.5 bg-blue-50/80 hover:bg-blue-100/80 text-blue-900 flex items-center gap-2.5 transition-colors group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Locate className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-blue-900 leading-tight">
                  Use Current GPS Location / বর্তমান অবস্থান
                </div>
                <div className="text-[10px] text-blue-600 font-medium truncate">
                  Lat: {currentGpsLocation!.lat.toFixed(4)}, Lng: {currentGpsLocation!.lng.toFixed(4)}
                </div>
              </div>
            </button>
          )}

          {/* Search Header / Status when typing */}
          {query.trim().length > 0 && (
            <div className="px-3.5 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Search className="w-3 h-3 text-slate-400" />
                <span>Google Maps Suggestions</span>
              </span>
              {isLoading && (
                <span className="flex items-center gap-1 text-[10px] text-brand-600 font-semibold lowercase">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  searching...
                </span>
              )}
            </div>
          )}

          {/* Google Places Results List */}
          {query.trim().length > 0 && (
            suggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-medium space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                    <span>Searching Google Places... / খুঁজছে...</span>
                  </div>
                ) : (
                  hasSearched && (
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-700">No exact Google Maps location found.</div>
                      <div className="text-[11px] text-slate-400">সঠিক Google Maps লোকেশন পাওয়া যায়নি।</div>
                    </div>
                  )
                )}
              </div>
            ) : (
              suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-brand-50 text-slate-500 group-hover:text-brand-600 flex items-center justify-center shrink-0 transition-colors">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-brand-900 truncate leading-tight">
                        {item.primaryText}
                      </div>
                      {item.secondaryText && (
                        <div className="text-[10px] text-slate-500 group-hover:text-slate-600 truncate mt-0.5">
                          {item.secondaryText}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 rounded">
                    Google
                  </span>
                </button>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
