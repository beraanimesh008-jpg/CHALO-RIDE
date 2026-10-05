/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { hostingerDb } from './hostingerDb';

// Initialize Firebase App for Authentication & Realtime Database GPS
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// HOSTINGER is the Main Application Database
// Zero Firestore reads or writes for application data.
export const db = hostingerDb;

// Re-export Hostinger database adapter methods
export {
  doc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  deleteField
} from './hostingerDb';
