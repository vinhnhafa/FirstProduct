import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testFirestoreConnection();

function resolveProviderTag(user: User): 'google.com' | 'password' | 'phone' | 'other' {
  const first = user.providerData[0]?.providerId;
  if (first === 'google.com' || first === 'password' || first === 'phone') {
    return first;
  }
  return 'other';
}

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const profilePath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/account`;
  const displayName = (user.displayName || user.email?.split('@')[0] || 'Ca sĩ').slice(0, 48);
  const authProvider = resolveProviderTag(user);

  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const profilePayload: Record<string, unknown> = {
      uid: user.uid,
      displayName,
      authProvider,
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL && user.photoURL.length <= 512) {
      profilePayload.photoUrl = user.photoURL;
    }
    if (!snap.exists()) {
      profilePayload.createdAt = serverTimestamp();
    }
    await setDoc(ref, profilePayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  if (user.email) {
    try {
      const privRef = doc(db, 'users', user.uid, 'private', 'account');
      const privSnap = await getDoc(privRef);
      const privPayload: Record<string, unknown> = {
        uid: user.uid,
        email: user.email.slice(0, 160),
        updatedAt: serverTimestamp(),
      };
      if (!privSnap.exists()) {
        privPayload.createdAt = serverTimestamp();
      }
      await setDoc(privRef, privPayload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  await syncUserProfileToFirestore(cred.user);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await syncUserProfileToFirestore(cred.user);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName.trim().slice(0, 48);
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName });
  }
  await syncUserProfileToFirestore(cred.user);
  return cred.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}
