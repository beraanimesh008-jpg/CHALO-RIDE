/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ride } from '../types';

let audioCtx: AudioContext | null = null;
let alertIntervalId: number | null = null;
let vibrationIntervalId: number | null = null;
let isAlertActive = false;

/**
 * Initialize or resume AudioContext safely upon user gesture or on demand
 */
export function initAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch((err) => console.warn('AudioContext resume error:', err));
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext init error:', e);
    return null;
  }
}

/**
 * Play a single chime pulse (loud 2-tone taxi dispatch alert)
 */
function playChimeSequence(ctx: AudioContext) {
  try {
    const now = ctx.currentTime;

    // Pattern: 880Hz (A5) -> 1175Hz (D6) -> 880Hz (A5) -> 1320Hz (E6)
    const tones = [
      { freq: 880, start: 0, duration: 0.12 },
      { freq: 1175, start: 0.14, duration: 0.12 },
      { freq: 880, start: 0.28, duration: 0.12 },
      { freq: 1320, start: 0.42, duration: 0.25 }
    ];

    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Rich, loud, penetrating tone without clipping
      osc.frequency.setValueAtTime(freq, now + start);

      // Fast attack & decay for a punchy ringtone
      gain.gain.setValueAtTime(0.01, now + start);
      gain.gain.exponentialRampToValueAtTime(0.85, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.warn('Chime sequence error:', err);
  }
}

/**
 * Trigger vibration pattern when supported on device
 */
function triggerVibration() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      // 400ms pulse, 150ms pause, 400ms pulse, 150ms pause, 800ms long pulse
      navigator.vibrate([400, 150, 400, 150, 800]);
    } catch {
      // Vibration not permitted or unavailable
    }
  }
}

/**
 * Start loud ringtone & vibration continuously until stopped
 */
export function startRideAlertSoundAndVibration(): void {
  if (isAlertActive) return;
  isAlertActive = true;

  const ctx = initAudioContext();
  if (ctx) {
    // Play immediately
    playChimeSequence(ctx);

    // Repeat every 1100ms
    if (alertIntervalId) clearInterval(alertIntervalId);
    alertIntervalId = window.setInterval(() => {
      if (!isAlertActive) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      playChimeSequence(ctx);
    }, 1100);
  }

  // Vibrate immediately and repeat every 2000ms
  triggerVibration();
  if (vibrationIntervalId) clearInterval(vibrationIntervalId);
  vibrationIntervalId = window.setInterval(() => {
    if (!isAlertActive) return;
    triggerVibration();
  }, 2000);
}

/**
 * Immediately stop all sound and vibration
 */
export function stopRideAlertSoundAndVibration(): void {
  isAlertActive = false;

  if (alertIntervalId) {
    clearInterval(alertIntervalId);
    alertIntervalId = null;
  }

  if (vibrationIntervalId) {
    clearInterval(vibrationIntervalId);
    vibrationIntervalId = null;
  }

  // Cancel device vibration immediately
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
}

/**
 * Check and request browser push notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return Notification.permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Show a browser notification when app is in background or minimized
 */
export function triggerBackgroundRideNotification(ride: Ride): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const pickupAddr = ride.pickup?.address || 'Pickup';
    const dropAddr = ride.drop?.address || 'Drop-off';
    const fare = ride.finalFare || ride.userOfferedFare || 0;
    const pax = ride.passengerCount || 1;

    const options: any = {
      body: `ভাড়া: ₹${fare} (${pax} জন যাত্রী)\nপিকআপ: ${pickupAddr}\nগন্তব্য: ${dropAddr}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `chalo-ride-${ride.id}`,
      requireInteraction: true,
      renotify: true
    };

    const notif = new Notification('🚖 NEW RIDE REQUEST / নতুন রাইড এসেছে!', options);

    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.warn('Background notification error:', err);
  }
}
