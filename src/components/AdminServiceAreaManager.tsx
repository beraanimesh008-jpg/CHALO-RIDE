/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PolygonCoord, PolygonServiceArea } from '../types';
import {
  DEFAULT_CHALO_POLYGON,
  DEFAULT_POLYGON_SERVICE_AREA,
  DEFAULT_SERVICE_AREAS,
  isPointInPolygon,
  saveServiceAreaPolygon,
  useServiceAreaPolygon
} from '../lib/serviceArea';
import {
  Compass,
  PenTool,
  Move,
  Search,
  RotateCcw,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Power,
  Trash2,
  Plus,
  Info,
  MapPin,
  HelpCircle,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';
import GoogleMapView from './GoogleMapView';
import { useAuth } from '../lib/AuthContext';

export default function AdminServiceAreaManager() {
  const { user } = useAuth();
  const liveArea = useServiceAreaPolygon();

  // Local editing states
  const [polygon, setPolygon] = useState<PolygonCoord[]>(liveArea.polygon || DEFAULT_CHALO_POLYGON);
  const [isEnabled, setIsEnabled] = useState<boolean>(liveArea.enabled !== false);
  const [zoneName, setZoneName] = useState<string>(liveArea.name || DEFAULT_POLYGON_SERVICE_AREA.name);
  const [bengaliName, setBengaliName] = useState<string>(liveArea.bengaliName || DEFAULT_POLYGON_SERVICE_AREA.bengaliName);

  // Modes: 'none' | 'draw' | 'edit' | 'test'
  const [mode, setMode] = useState<'none' | 'draw' | 'edit' | 'test'>('none');
  const [drawPoints, setDrawPoints] = useState<PolygonCoord[]>([]);

  // Testing tool state
  const [testLat, setTestLat] = useState<string>('21.796');
  const [testLng, setTestLng] = useState<string>('88.358');
  const [testResult, setTestResult] = useState<{ lat: number; lng: number; isInside: boolean } | null>(null);

  // Status feedback
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLegacyHubs, setShowLegacyHubs] = useState<boolean>(false);

  // Sync from live area if not actively in draw/edit mode
  useEffect(() => {
    if (mode === 'none' || mode === 'test') {
      setPolygon(liveArea.polygon || DEFAULT_CHALO_POLYGON);
      setIsEnabled(liveArea.enabled !== false);
      setZoneName(liveArea.name || DEFAULT_POLYGON_SERVICE_AREA.name);
      setBengaliName(liveArea.bengaliName || DEFAULT_POLYGON_SERVICE_AREA.bengaliName);
    }
  }, [liveArea, mode]);

  // Start Drawing new polygon
  const handleStartDrawing = () => {
    setMode('draw');
    setDrawPoints([]);
    setErrorMessage(null);
  };

  // Add a point during draw mode
  const handleAddDrawnPoint = (point: PolygonCoord) => {
    if (mode !== 'draw') return;

    // Check if clicked near first point to close (or if clicked on point 1)
    if (drawPoints.length >= 3) {
      const p0 = drawPoints[0];
      const dist = Math.sqrt(Math.pow(p0.lat - point.lat, 2) + Math.pow(p0.lng - point.lng, 2));
      if (dist < 0.005) {
        // Close polygon!
        setPolygon(drawPoints);
        setMode('edit');
        setDrawPoints([]);
        return;
      }
    }

    setDrawPoints((prev) => [...prev, point]);
  };

  // Complete drawing polygon
  const handleFinishDrawing = () => {
    if (drawPoints.length < 3) {
      setErrorMessage('A valid polygon requires at least 3 points. Click more points on the map.');
      return;
    }
    setPolygon(drawPoints);
    setDrawPoints([]);
    setMode('edit');
    setErrorMessage(null);
  };

  // Undo last drawn point
  const handleUndoPoint = () => {
    setDrawPoints((prev) => prev.slice(0, -1));
  };

  // Cancel draw/edit
  const handleCancel = () => {
    setMode('none');
    setDrawPoints([]);
    setPolygon(liveArea.polygon || DEFAULT_CHALO_POLYGON);
    setErrorMessage(null);
  };

  // Drag a vertex in edit mode
  const handleVertexDragEnd = (index: number, newCoords: PolygonCoord) => {
    setPolygon((prev) => {
      const updated = [...prev];
      updated[index] = newCoords;
      return updated;
    });
  };

  // Delete a vertex in edit mode
  const handleVertexClick = (index: number) => {
    if (polygon.length <= 3) {
      setErrorMessage('Polygon must have at least 3 boundary vertices.');
      return;
    }
    setPolygon((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add vertex manually by coordinates
  const handleAddVertexManual = (lat: number, lng: number) => {
    if (isNaN(lat) || isNaN(lng)) return;
    setPolygon((prev) => [...prev, { lat, lng }]);
  };

  // Reset to default Sundarban polygon
  const handleResetDefault = () => {
    if (window.confirm('Reset boundary to default Sundarban / Pathar Pratima polygon?')) {
      setPolygon(DEFAULT_CHALO_POLYGON);
      setMode('none');
      setDrawPoints([]);
    }
  };

  // Test location handler
  const handleRunLocationTest = (lat: number, lng: number) => {
    const isInside = isPointInPolygon({ lat, lng }, polygon);
    setTestResult({ lat, lng, isInside });
  };

  // Map click handler (used for test mode or general clicking)
  const handleMapClick = (coords: PolygonCoord) => {
    if (mode === 'test') {
      handleRunLocationTest(coords.lat, coords.lng);
      setTestLat(coords.lat.toFixed(5));
      setTestLng(coords.lng.toFixed(5));
    }
  };

  // Save polygon and settings to Firestore
  const handleSaveToFirestore = async () => {
    if (polygon.length < 3) {
      setErrorMessage('A polygon must contain at least 3 vertices before saving.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      await saveServiceAreaPolygon(polygon, isEnabled, user?.email || 'admin');
      setSaveSuccess(true);
      setMode('none');
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to save polygon service area:', err);
      setErrorMessage(err.message || 'Failed to save to Firestore. Please check admin permissions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Compass className="w-7 h-7 text-brand-600" />
              Service Area Geofencing
              <span className="text-slate-400 font-bold text-base">/ সার্ভিস এলাকা জিওফেন্সিং</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Exact Google Maps polygon boundary serving as the single source of truth for ride dispatch and eligibility
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Enforcement */}
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={cn(
                "px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border",
                isEnabled
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                  : "bg-slate-100 border-slate-300 text-slate-500"
              )}
              title="Toggle geofence enforcement across rider and driver apps"
            >
              <Power className={cn("w-4 h-4", isEnabled ? "text-emerald-600" : "text-slate-400")} />
              <span>
                {isEnabled ? 'Enforcement: ACTIVE' : 'Enforcement: PAUSED (All Allowed)'}
              </span>
            </button>

            {/* Save Button */}
            <button
              onClick={handleSaveToFirestore}
              disabled={saving}
              className={cn(
                "px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg active:scale-95 text-white",
                saving
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-brand-600 hover:bg-brand-700 shadow-brand-600/25"
              )}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Boundary'}</span>
            </button>
          </div>
        </div>

        {/* Feedback banners */}
        {saveSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Service area polygon updated successfully! New rides and driver dispatch are now validated against this boundary.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Toolbar Modes */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (mode === 'draw') handleCancel();
                else handleStartDrawing();
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                mode === 'draw'
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{mode === 'draw' ? 'Cancel Drawing' : 'Draw New Boundary'}</span>
            </button>

            <button
              onClick={() => {
                setMode(mode === 'edit' ? 'none' : 'edit');
                setErrorMessage(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                mode === 'edit'
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <Move className="w-3.5 h-3.5" />
              <span>{mode === 'edit' ? 'Done Editing Vertices' : 'Edit Vertices'}</span>
            </button>

            <button
              onClick={() => {
                setMode(mode === 'test' ? 'none' : 'test');
                setErrorMessage(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                mode === 'test'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{mode === 'test' ? 'Exit Test Mode' : 'Check Location (Test)'}</span>
            </button>

            <button
              onClick={handleResetDefault}
              className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1.5"
              title="Reset to default Pathar Pratima & Sundarban perimeter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <span className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-700">
              {mode === 'draw' ? `${drawPoints.length} Points Drawn` : `${polygon.length} Boundary Vertices`}
            </span>
          </div>
        </div>

        {/* Draw Mode Active Bar */}
        {mode === 'draw' && (
          <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-900">
              <PenTool className="w-4 h-4 text-brand-600 shrink-0" />
              <span>
                Click points sequentially on the map to define the perimeter. Click point #1 (in green) or 'Finish Boundary' to complete.
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleUndoPoint}
                disabled={drawPoints.length === 0}
                className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                Undo Point
              </button>
              <button
                onClick={handleFinishDrawing}
                disabled={drawPoints.length < 3}
                className="px-4 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 shadow-md disabled:opacity-50"
              >
                Finish Boundary
              </button>
            </div>
          </div>
        )}

        {/* Edit Mode Active Bar */}
        {mode === 'edit' && (
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Move className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Drag any orange vertex marker to shift the boundary line. Click any vertex to remove it. (Min 3 vertices).
              </span>
            </div>

            <button
              onClick={() => setMode('none')}
              className="px-4 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-black hover:bg-slate-100 shrink-0"
            >
              Finish Vertex Adjustments
            </button>
          </div>
        )}

        {/* Test Mode Active Bar */}
        {mode === 'test' && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <Search className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Test Location Mode: Click anywhere on the map or enter coordinates below to check service boundary validity.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-indigo-700">Lat</span>
                <input
                  type="number"
                  step="0.0001"
                  value={testLat}
                  onChange={(e) => setTestLat(e.target.value)}
                  className="w-28 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-indigo-700">Lng</span>
                <input
                  type="number"
                  step="0.0001"
                  value={testLng}
                  onChange={(e) => setTestLng(e.target.value)}
                  className="w-28 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <button
                onClick={() => handleRunLocationTest(Number(testLat), Number(testLng))}
                className="px-4 py-1.5 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 shadow-md"
              >
                Check Point
              </button>

              {testResult && (
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2",
                    testResult.isInside
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-rose-100 text-rose-800 border border-rose-300"
                  )}
                >
                  {testResult.isInside ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Inside Service Area / সার্ভিস এলাকার ভিতরে</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Outside Service Area / সার্ভিস এলাকার বাইরে</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="h-[520px] w-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-inner relative">
          <GoogleMapView
            center={polygon[0] || DEFAULT_CHALO_POLYGON[0]}
            zoom={11}
            interactive={true}
            servicePolygon={polygon}
            isServiceAreaEnabled={isEnabled}
            drawingMode={mode}
            drawnPoints={drawPoints}
            onAddDrawnPoint={handleAddDrawnPoint}
            onVertexDragEnd={handleVertexDragEnd}
            onVertexClick={handleVertexClick}
            testMarker={testResult}
            onMapClick={handleMapClick}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Polygon Details & Vertices Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Polygon Meta Form */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 flex flex-col gap-4">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Boundary Metadata / বিবরণ
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">Configure primary boundary naming and labels</p>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
              Zone Title (English)
            </label>
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              placeholder="e.g. ChaLo Sundarban Operating Zone"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
              Bengali Title / বাংলা নাম
            </label>
            <input
              type="text"
              value={bengaliName}
              onChange={(e) => setBengaliName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              placeholder="e.g. চলো সুন্দরবন সার্ভিস এলাকা"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Enforcement:</span>
              <span className={cn("font-bold", isEnabled ? "text-emerald-600" : "text-amber-600")}>
                {isEnabled ? 'Strict Geofencing' : 'Unrestricted Open'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Vertex Count:</span>
              <span className="font-bold text-slate-900">{polygon.length} coordinates</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Last Synced:</span>
              <span className="font-bold text-slate-900">
                {liveArea.updatedAt ? new Date(liveArea.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Default'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Single Source:</span>
              <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                service_areas/primary_boundary
              </span>
            </div>
          </div>

          <button
            onClick={handleSaveToFirestore}
            disabled={saving}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Updating Firestore...' : 'Save Configuration'}</span>
          </button>
        </div>

        {/* Vertices List Table */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Boundary Vertices / সীমানা পয়েন্টস
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">Exact latitude and longitude points of current polygon</p>
            </div>
            <span className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-xl">
              {polygon.length} Points
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto pr-2 space-y-2">
            {polygon.map((pt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="font-mono text-slate-700 font-bold">
                    Lat: <span className="text-slate-900">{pt.lat.toFixed(6)}</span> • Lng: <span className="text-slate-900">{pt.lng.toFixed(6)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleVertexClick(idx)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove this vertex"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Collapsible Legacy Hubs Reference */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowLegacyHubs(!showLegacyHubs)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-2 py-1"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>{showLegacyHubs ? 'Hide' : 'Show'} Historical Reference Hubs (Preserved Archive)</span>
            </button>

            {showLegacyHubs && (
              <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2 animate-fade-in">
                <div className="text-[11px] font-bold text-slate-600">
                  Legacy radius hubs retained in Firestore for historical reference (not used for ride eligibility):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {DEFAULT_SERVICE_AREAS.map((h) => (
                    <div key={h.id} className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-800">{h.name}</div>
                      <div className="text-[10px] text-slate-400">{h.bengaliName} • {h.radiusKm} km radius (Legacy)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

