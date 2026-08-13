import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

export async function saveCardProgress(userId, cardId, data = {}) {
  if (!firebaseConfigured || !db || !userId) return { persisted: false };

  await setDoc(doc(db, "users", userId, "progress", cardId), {
    cardId,
    ...data,
    lastStudiedAt: serverTimestamp(),
  }, { merge: true });

  return { persisted: true };
}
