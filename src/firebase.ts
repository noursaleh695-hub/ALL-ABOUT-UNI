import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
} from 'firebase/auth'
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

export const isFirebaseConfigured = () =>
  Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.storageBucket,
  )

export const app = isFirebaseConfigured()
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null

export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const storage = app ? getStorage(app) : null

export const signInAnonymously = async () => {
  if (!auth) return null
  return firebaseSignInAnonymously(auth)
}

export const getWorkspaceDocument = async (uid: string) => {
  if (!db) return null
  const ref = doc(db, 'users', uid, 'workspace', 'main')
  const snap = await getDoc(ref)
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null
}

export const saveWorkspace = async (uid: string, payload: Record<string, unknown>) => {
  if (!db) return false
  const ref = doc(db, 'users', uid, 'workspace', 'main')
  await setDoc(ref, payload, { merge: true })
  return true
}

export const uploadMaterialFile = async (uid: string, file: File) => {
  if (!storage) throw new Error('Firebase Storage is not configured')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileRef = ref(storage, `users/${uid}/materials/${Date.now()}_${safeName}`)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}
