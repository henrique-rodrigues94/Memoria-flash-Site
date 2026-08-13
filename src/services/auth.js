import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, firebaseConfigured } from "../lib/firebase";

const provider = new GoogleAuthProvider();

export function observeUser(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function signInGoogle() {
  if (!firebaseConfigured || !auth) {
    throw new Error("Firebase não está configurado.");
  }

  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  if (auth) return signOut(auth);
}
