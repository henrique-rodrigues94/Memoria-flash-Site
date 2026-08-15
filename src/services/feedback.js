import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

export async function saveCardFeedback({
  userId,
  card,
  rating,
  reason = "",
  comment = "",
  context = {},
}) {
  if (!firebaseConfigured || !db || !userId) {
    return { persisted: false };
  }

  await addDoc(collection(db, "cardFeedback"), {
    userId,
    cardId: card.id,
    rating,
    reason: reason || null,
    comment: comment.trim(),
    subjectId: card.subjectId || null,
    subject: card.subject || null,
    topicId: card.topicId || null,
    topic: card.topic || null,
    subtopicId: card.subtopicId || null,
    subtopic: card.subtopic || null,
    difficulty: card.difficulty || null,
    ...context,
    agentProcessed: false,
    createdAt: serverTimestamp(),
  });

  return { persisted: true };
}
