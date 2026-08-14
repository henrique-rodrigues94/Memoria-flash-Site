import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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

export function subscribeToUserProgress(userId, onData, onError) {
  if (!firebaseConfigured || !db || !userId) {
    onData([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, "users", userId, "progress"),
    (snapshot) => onData(snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))),
    onError
  );
}
