import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

export async function getCardProgress(userId, cardId) {
  if (!firebaseConfigured || !db || !userId || !cardId) return null;

  const snapshot = await getDoc(
    doc(db, "users", userId, "progress", cardId)
  );

  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveCardProgress(userId, cardId, data = {}) {
  if (!firebaseConfigured || !db || !userId || !cardId) {
    return { persisted: false };
  }

  await setDoc(
    doc(db, "users", userId, "progress", cardId),
    {
      cardId,
      ...data,
      lastStudiedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { persisted: true };
}
