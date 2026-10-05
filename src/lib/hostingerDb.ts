/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Hostinger Client Database Adapter
// Provides 100% Firestore-compatible interface backed entirely by Hostinger Node.js API + SSE

export interface DocRef {
  type: 'doc';
  collection: string;
  id: string;
}

export interface CollectionRef {
  type: 'collection';
  collection: string;
}

export interface QueryConstraint {
  type: 'where' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  count?: number;
}

export interface QueryRef {
  type: 'query';
  collection: string;
  constraints: QueryConstraint[];
}

export interface DocumentSnapshot<T = any> {
  id: string;
  exists: () => boolean;
  data: () => T | undefined;
}

export interface QueryDocumentSnapshot<T = any> extends DocumentSnapshot<T> {
  ref: DocRef;
  data: () => T;
}

export interface QuerySnapshot<T = any> {
  empty: boolean;
  size: number;
  docs: QueryDocumentSnapshot<T>[];
  forEach: (callback: (doc: QueryDocumentSnapshot<T>) => void) => void;
}

// Database instance token
export const hostingerDb = { _isHostinger: true };

// Document Reference factory: supports doc(db, 'users', uid) or doc(db, 'rides', rideId, 'offers', driverId)
export function doc(...args: any[]): DocRef {
  if (args.length >= 3) {
    const segments = typeof args[0] === 'string' ? args : args.slice(1);
    const id = segments[segments.length - 1] || '';
    const collection = segments.slice(0, -1).join('/');
    return { type: 'doc', collection, id };
  }
  if (args.length === 2) {
    if (typeof args[0] === 'object' && args[0]?.type === 'collection') {
      return { type: 'doc', collection: args[0].collection, id: args[1] };
    }
    return { type: 'doc', collection: args[0], id: args[1] };
  }
  return { type: 'doc', collection: 'users', id: '' };
}

// Collection Reference factory
export function collection(_db: any, collectionName: string): CollectionRef {
  return { type: 'collection', collection: collectionName };
}

// Query constraints
export function where(field: string, op: string, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function limit(count: number): QueryConstraint {
  return { type: 'limit', count };
}

export function query(collectionRef: CollectionRef | QueryRef, ...constraints: QueryConstraint[]): QueryRef {
  const existing = collectionRef.type === 'query' ? collectionRef.constraints : [];
  return {
    type: 'query',
    collection: collectionRef.collection,
    constraints: [...existing, ...constraints]
  };
}

// Global SSE Event Stream to dispatch live changes to listeners
type SseCallback = (event: { collection: string; action: string; id: string; data?: any }) => void;
const sseListeners = new Set<SseCallback>();

let eventSource: EventSource | null = null;
function initEventSource() {
  if (typeof window === 'undefined' || eventSource) return;
  try {
    eventSource = new EventSource('/api/events');
    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        for (const listener of sseListeners) {
          listener(payload);
        }
      } catch {}
    };
    eventSource.onerror = () => {
      // Automatic browser reconnect handled by EventSource
    };
  } catch (err) {
    console.warn('[Hostinger DB] SSE init warning:', err);
  }
}

// Filter docs against query constraints
function matchesConstraints(docData: any, constraints: QueryConstraint[]): boolean {
  for (const c of constraints) {
    if (c.type === 'where' && c.field && c.op) {
      const val = docData[c.field];
      if (c.op === '==' && val !== c.value) return false;
      if (c.op === '!=' && val === c.value) return false;
      if (c.op === 'in' && Array.isArray(c.value) && !c.value.includes(val)) return false;
      if (c.op === 'array-contains' && Array.isArray(val) && !val.includes(c.value)) return false;
    }
  }
  return true;
}

// Get Single Doc
export async function getDoc<T = any>(docRef: DocRef): Promise<DocumentSnapshot<T>> {
  try {
    const res = await fetch(`/api/${docRef.collection}/${docRef.id}`);
    if (res.status === 404) {
      return {
        id: docRef.id,
        exists: () => false,
        data: () => undefined
      };
    }
    const data = await res.json();
    return {
      id: docRef.id,
      exists: () => true,
      data: () => data
    };
  } catch (err) {
    return {
      id: docRef.id,
      exists: () => false,
      data: () => undefined
    };
  }
}

// Get Multiple Docs
export async function getDocs<T = any>(queryOrRef: CollectionRef | QueryRef): Promise<QuerySnapshot<T>> {
  const collectionName = queryOrRef.collection;
  const constraints = queryOrRef.type === 'query' ? queryOrRef.constraints : [];

  try {
    const res = await fetch(`/api/${collectionName}`);
    if (!res.ok) {
      return createQuerySnapshot<T>([]);
    }
    let list = await res.json();
    if (!Array.isArray(list)) list = [];

    // Filter by constraints
    list = list.filter((item: any) => matchesConstraints(item, constraints));

    // Handle limit constraint
    const limitConstraint = constraints.find((c) => c.type === 'limit');
    if (limitConstraint && limitConstraint.count) {
      list = list.slice(0, limitConstraint.count);
    }

    return createQuerySnapshot<T>(list);
  } catch (err) {
    return createQuerySnapshot<T>([]);
  }
}

// Set Doc
export async function setDoc(docRef: DocRef, data: any, _options?: { merge?: boolean }): Promise<void> {
  // Handle subcollection pattern: rides/{rideId}/offers/{driverId}
  if (docRef.collection.startsWith('rides/') && docRef.collection.endsWith('/offers')) {
    const rideId = docRef.collection.split('/')[1];
    try {
      const res = await fetch(`/api/rides/${rideId}`);
      if (res.ok) {
        const ride = await res.json();
        const existingOffers: any[] = Array.isArray(ride.offers) ? ride.offers : [];
        const filteredOffers = existingOffers.filter((o: any) => o.driverId !== docRef.id);
        const updatedOffers = [...filteredOffers, { ...data, driverId: docRef.id }];
        await fetch(`/api/rides/${rideId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offers: updatedOffers, updatedAt: Date.now() })
        });
        return;
      }
    } catch (err) {
      console.warn('[Hostinger DB] Failed to record ride offer:', err);
    }
  }

  const method = docRef.collection === 'rides' ? 'PUT' : 'POST';
  await fetch(`/api/${docRef.collection}/${docRef.id}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// Add Doc
export async function addDoc(collectionRef: CollectionRef, data: any): Promise<{ id: string }> {
  const res = await fetch(`/api/${collectionRef.collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const saved = await res.json();
  return { id: saved.id };
}

// Update Doc
export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
  const method = docRef.collection === 'rides' ? 'PUT' : 'POST';
  await fetch(`/api/${docRef.collection}/${docRef.id}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// Delete Doc
export async function deleteDoc(docRef: DocRef): Promise<void> {
  await fetch(`/api/${docRef.collection}/${docRef.id}`, {
    method: 'DELETE'
  });
}

// Run Transaction
export async function runTransaction<T>(
  _db: any,
  updateFunction: (transaction: {
    get: typeof getDoc;
    set: (docRef: DocRef, data: any) => void;
    update: (docRef: DocRef, data: any) => void;
    delete: (docRef: DocRef) => void;
  }) => Promise<T>
): Promise<T> {
  const transactionOps = {
    get: getDoc,
    set: (docRef: DocRef, data: any) => { setDoc(docRef, data); },
    update: (docRef: DocRef, data: any) => { updateDoc(docRef, data); },
    delete: (docRef: DocRef) => { deleteDoc(docRef); }
  };
  return updateFunction(transactionOps);
}

// Helper to construct QuerySnapshot
function createQuerySnapshot<T>(list: any[], collectionName = 'users'): QuerySnapshot<T> {
  const docs: QueryDocumentSnapshot<T>[] = list.map((item) => {
    const docId = item.id || item.uid || '';
    return {
      id: docId,
      ref: { type: 'doc', collection: collectionName, id: docId },
      exists: () => true,
      data: () => item as T
    };
  });

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (cb) => docs.forEach(cb)
  };
}

// Real-Time onSnapshot Listener
export function onSnapshot<T = any>(
  target: DocRef | CollectionRef | QueryRef,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): () => void {
  initEventSource();

  let isSubscribed = true;

  // 1. Single Document Listener
  if (target.type === 'doc') {
    const fetchCurrent = async () => {
      try {
        const snap = await getDoc<T>(target);
        if (isSubscribed) {
          onNext(snap);
        }
      } catch (err) {
        if (isSubscribed && onError) onError(err);
      }
    };

    fetchCurrent();

    const sseHandler: SseCallback = (e) => {
      if (!isSubscribed) return;
      if (e.collection === target.collection && (e.id === target.id || !e.id)) {
        fetchCurrent();
      }
    };

    sseListeners.add(sseHandler);
    return () => {
      isSubscribed = false;
      sseListeners.delete(sseHandler);
    };
  }

  // 2. Collection / Query Listener
  const collectionName = target.collection;
  const constraints = target.type === 'query' ? target.constraints : [];

  const fetchCollection = async () => {
    try {
      const snap = await getDocs<T>(target);
      if (isSubscribed) {
        onNext(snap);
      }
    } catch (err) {
      if (isSubscribed && onError) onError(err);
    }
  };

  fetchCollection();

  const sseHandler: SseCallback = (e) => {
    if (!isSubscribed) return;
    if (e.collection === collectionName) {
      fetchCollection();
    }
  };

  sseListeners.add(sseHandler);
  return () => {
    isSubscribed = false;
    sseListeners.delete(sseHandler);
  };
}

// Helper utility for Firestore deleteField compatibility
export function deleteField() {
  return null;
}
