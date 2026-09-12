import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole, DriverVerificationStatus } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  activeRole: UserRole | null;
  signOut: () => Promise<void>;
  loginUserWithGoogle: () => Promise<UserProfile>;
  loginDriverWithGoogle: () => Promise<UserProfile>;
  loginAdminWithCredentials: (adminId: string, password: string) => Promise<UserProfile>;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole | null>(() => {
    return (sessionStorage.getItem('chalo_session_role') as UserRole) || null;
  });

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // If a new user signed in, default to USER role
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || `${currentUser.uid.slice(0, 6)}@chalo.local`,
            displayName: currentUser.displayName || 'ChaLo Member',
            photoURL: currentUser.photoURL || '',
            phoneNumber: currentUser.phoneNumber || '',
            role: UserRole.USER,
            onboardingComplete: true,
            totalRides: 0,
            rating: 5,
            isOnline: false,
            createdAt: Date.now()
          };
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
          setActiveRole(UserRole.USER);
          sessionStorage.setItem('chalo_session_role', UserRole.USER);
        } else {
          const currentProfile = userDoc.data() as UserProfile;
          setProfile(currentProfile);
          setActiveRole(currentProfile.role);
          sessionStorage.setItem('chalo_session_role', currentProfile.role);
        }

        // Set up real-time listener for profile changes
        profileUnsubscribe = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const updated = snapshot.data() as UserProfile;
              setProfile(updated);
              setActiveRole(updated.role);
              sessionStorage.setItem('chalo_session_role', updated.role);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Profile snapshot error:', error);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setActiveRole(null);
        sessionStorage.removeItem('chalo_session_role');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  /**
   * 1. USER LOGIN: Authenticate via Google Sign-In
   * Normal Google accounts are routed to the User Panel as riders.
   */
  const loginUserWithGoogle = async (): Promise<UserProfile> => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      const userDocRef = doc(db, 'users', googleUser.uid);
      const userSnap = await getDoc(userDocRef);

      let userProf: UserProfile;
      if (!userSnap.exists()) {
        userProf = {
          uid: googleUser.uid,
          email: googleUser.email || `${googleUser.uid.slice(0, 6)}@chalo.local`,
          displayName: googleUser.displayName || 'ChaLo Member',
          photoURL: googleUser.photoURL || '',
          phoneNumber: googleUser.phoneNumber || '',
          role: UserRole.USER,
          onboardingComplete: true,
          totalRides: 0,
          rating: 5,
          isOnline: false,
          createdAt: Date.now()
        };
        await setDoc(userDocRef, userProf);
      } else {
        userProf = userSnap.data() as UserProfile;
      }

      setActiveRole(userProf.role || UserRole.USER);
      sessionStorage.setItem('chalo_session_role', userProf.role || UserRole.USER);
      return userProf;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 2. DRIVER LOGIN: Authenticate via Google Sign-In
   * Authenticates the driver. Mandatory profile verification and Admin approval
   * is required before the driver is eligible to receive NEW ride requests.
   */
  const loginDriverWithGoogle = async (): Promise<UserProfile> => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      const userDocRef = doc(db, 'users', googleUser.uid);
      const userSnap = await getDoc(userDocRef);

      let driverProf: UserProfile;

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserProfile;
        // Keep existing verification status, or if missing default to INCOMPLETE
        const currentStatus = existingData.driverVerificationStatus || (
          (existingData.role === UserRole.DRIVER && existingData.driverName && existingData.aadhaarNumber && existingData.driverPhotoUrl)
            ? DriverVerificationStatus.APPROVED
            : DriverVerificationStatus.INCOMPLETE
        );

        driverProf = {
          ...existingData,
          uid: googleUser.uid,
          email: existingData.email || googleUser.email || `${googleUser.uid.slice(0, 6)}@chalo.local`,
          displayName: existingData.displayName || googleUser.displayName || 'ChaLo Driver',
          photoURL: existingData.photoURL || googleUser.photoURL || '',
          phoneNumber: existingData.phoneNumber || googleUser.phoneNumber || '',
          role: UserRole.DRIVER,
          driverVerificationStatus: currentStatus,
          // CRITICAL: A non-approved driver CANNOT be online
          isOnline: currentStatus === DriverVerificationStatus.APPROVED ? (existingData.isOnline ?? false) : false,
          updatedAt: Date.now()
        };
        await setDoc(userDocRef, driverProf, { merge: true });
      } else {
        // New driver registration via Google Login
        // Default status is INCOMPLETE; requires mandatory verification + Admin approval before receiving rides
        driverProf = {
          uid: googleUser.uid,
          email: googleUser.email || `${googleUser.uid.slice(0, 6)}@chalo.local`,
          displayName: googleUser.displayName || 'ChaLo Driver',
          driverName: googleUser.displayName || '',
          photoURL: googleUser.photoURL || '',
          driverPhotoUrl: googleUser.photoURL || '',
          phoneNumber: googleUser.phoneNumber || '',
          driverMobile: googleUser.phoneNumber || '',
          role: UserRole.DRIVER,
          driverVerificationStatus: DriverVerificationStatus.INCOMPLETE,
          driverOnboardingComplete: false,
          totalRides: 0,
          rating: 5,
          isOnline: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await setDoc(userDocRef, driverProf);
      }

      // Ensure driver wallet exists
      const walletRef = doc(db, 'wallets', googleUser.uid);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) {
        await setDoc(walletRef, {
          driverId: googleUser.uid,
          driverName: driverProf.displayName || 'Authorized Driver',
          balance: 200,
          isBlocked: false,
          totalEarned: 0,
          totalCommissionPaid: 0,
          updatedAt: Date.now()
        });
      }

      setProfile(driverProf);
      setActiveRole(UserRole.DRIVER);
      sessionStorage.setItem('chalo_session_role', UserRole.DRIVER);
      return driverProf;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 3. ADMIN LOGIN: Authenticate via Admin ID/Email + Password
   * Google Sign-in is NOT allowed for Admin.
   * Securely validates credentials with Firebase Auth Email/Password.
   */
  const loginAdminWithCredentials = async (adminId: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    const cleanId = adminId.trim();
    if (!cleanId || !password) {
      setLoading(false);
      const err = new Error('Invalid Admin ID or Password.\nভুল Admin ID অথবা Password।');
      (err as any).code = 'ADMIN_INVALID_CREDENTIALS';
      throw err;
    }

    const email = cleanId.includes('@') ? cleanId.toLowerCase() : `${cleanId.toLowerCase()}@chalo.local`;

    try {
      let cred: any = null;
      try {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } catch (authErr: any) {
        // If account not initialized yet in Firebase Auth for official designated superadmin, initialize it
        if (
          (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential') &&
          (email === 'admin@chalo.local' || email === 'beraanimesh008@gmail.com')
        ) {
          try {
            cred = await createUserWithEmailAndPassword(auth, email, password);
          } catch (createErr) {
            const err = new Error('Invalid Admin ID or Password.\nভুল Admin ID অথবা Password।');
            (err as any).code = 'ADMIN_INVALID_CREDENTIALS';
            throw err;
          }
        } else {
          const err = new Error('Invalid Admin ID or Password.\nভুল Admin ID অথবা Password।');
          (err as any).code = 'ADMIN_INVALID_CREDENTIALS';
          throw err;
        }
      }

      const adminUser = cred.user;

      // Check server-side authorization
      const isDesignated =
        adminUser.email === 'beraanimesh008@gmail.com' || adminUser.email === 'admin@chalo.local';
      const adminDocSnap = await getDoc(doc(db, 'admins', adminUser.uid));
      const userDocSnap = await getDoc(doc(db, 'users', adminUser.uid));

      const isAuthorized =
        isDesignated ||
        adminDocSnap.exists() ||
        (userDocSnap.exists() && userDocSnap.data()?.role === UserRole.ADMIN);

      if (!isAuthorized) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setActiveRole(null);
        sessionStorage.removeItem('chalo_session_role');
        const err = new Error('Invalid Admin ID or Password.\nভুল Admin ID অথবা Password।');
        (err as any).code = 'ADMIN_INVALID_CREDENTIALS';
        throw err;
      }

      // Record in admins collection
      await setDoc(
        doc(db, 'admins', adminUser.uid),
        { role: 'ADMIN', email: adminUser.email, updatedAt: Date.now() },
        { merge: true }
      );

      // Record in users collection
      const adminProfile: UserProfile = {
        uid: adminUser.uid,
        email: adminUser.email || email,
        displayName: adminUser.displayName || 'System Administrator',
        photoURL: adminUser.photoURL || '',
        phoneNumber: adminUser.phoneNumber || '+91 90000 00001',
        role: UserRole.ADMIN,
        onboardingComplete: true,
        totalRides: 0,
        rating: 5,
        isOnline: false,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'users', adminUser.uid), adminProfile, { merge: true });

      setProfile(adminProfile);
      setActiveRole(UserRole.ADMIN);
      sessionStorage.setItem('chalo_session_role', UserRole.ADMIN);
      return adminProfile;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Role switcher for authorized profiles only (e.g. admin testing)
   */
  const switchRole = async (newRole: UserRole) => {
    if (!user || !profile) return;
    // Prevent non-admin users from escalating to admin
    if (newRole === UserRole.ADMIN && profile.role !== UserRole.ADMIN) {
      console.warn('Unauthorized role switch attempt prevented.');
      return;
    }
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role: newRole });
      setActiveRole(newRole);
      sessionStorage.setItem('chalo_session_role', newRole);
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  };

  /**
   * Explicit Session Logout: Clears all cached roles and terminates Firebase session
   */
  const signOut = async () => {
    sessionStorage.removeItem('chalo_session_role');
    localStorage.removeItem('chalo_session_role');
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setActiveRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        activeRole,
        signOut,
        loginUserWithGoogle,
        loginDriverWithGoogle,
        loginAdminWithCredentials,
        switchRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
