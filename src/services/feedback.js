import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

export async function saveCardFeedback({ userId, card, rating, reason = "", comment = "" }) {
  if (!firebaseConfigured || !db || !userId) return { persisted: false };

  await addDoc(collection(db, "cardFeedback"), {
    userId,
    cardId: card.id,
    rating,
    reason: reason || null,
    comment: comment.trim(),
    subject: card.subject || null,
    topic: card.topic || null,
    difficulty: card.difficulty || null,
    agentProcessed: false,
    createdAt: serverTimestamp(),
  });

  return { persisted: true };
}
