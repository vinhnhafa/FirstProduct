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
  getDocFromServer,
  runTransaction,
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

const pendingProfileSyncs = new Map<string, Promise<void>>();

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const existingSync = pendingProfileSyncs.get(user.uid);
  if (existingSync) {
    return existingSync;
  }

  const syncPromise = (async () => {
    const profilePath = `users/${user.uid}`;
    const privatePath = `users/${user.uid}/private/account`;
    const displayName = (
      user.displayName?.trim() ||
      user.email?.split('@')[0]?.trim() ||
      'Ca sĩ'
    ).slice(0, 48);
    const authProvider = resolveProviderTag(user);
    const cleanPhotoUrl =
      user.photoURL && user.photoURL.length <= 512 ? user.photoURL : undefined;

    try {
      const ref = doc(db, 'users', user.uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          const createPayload: Record<string, unknown> = {
            uid: user.uid,
            displayName,
            authProvider,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (cleanPhotoUrl) {
            createPayload.photoUrl = cleanPhotoUrl;
          }
          tx.set(ref, createPayload);
        } else {
          const updatePayload: Record<string, unknown> = {
            displayName,
            authProvider,
            updatedAt: serverTimestamp(),
          };
          if (cleanPhotoUrl) {
            updatePayload.photoUrl = cleanPhotoUrl;
          }
          tx.update(ref, updatePayload);
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, profilePath);
    }

    if (user.email) {
      const cleanEmail = user.email.trim().slice(0, 160);
      try {
        const privRef = doc(db, 'users', user.uid, 'private', 'account');
        await runTransaction(db, async (tx) => {
          const privSnap = await tx.get(privRef);
          if (!privSnap.exists()) {
            tx.set(privRef, {
              uid: user.uid,
              email: cleanEmail,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            tx.update(privRef, {
              email: cleanEmail,
              updatedAt: serverTimestamp(),
            });
          }
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, privatePath);
      }
    }
  })().finally(() => {
    pendingProfileSyncs.delete(user.uid);
  });

  pendingProfileSyncs.set(user.uid, syncPromise);
  return syncPromise;
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
