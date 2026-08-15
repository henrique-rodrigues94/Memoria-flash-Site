import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

export const SUPPORT_TYPES = [
  { value: "card_error", label: "Card com problema" },
  { value: "wrong_answer", label: "Resposta errada" },
  { value: "suggestion", label: "Sugestão de melhoria" },
  { value: "praise", label: "Elogio" },
  { value: "bug", label: "Problema no site" },
  { value: "other", label: "Outro assunto" },
];

export async function submitSupportRequest({ userId, user, type, message, card = null }) {
  const cleanMessage = String(message || "").trim();
  if (!userId) throw new Error("Você precisa estar conectado para enviar uma mensagem.");
  if (!type) throw new Error("Escolha o tipo de mensagem.");
  if (cleanMessage.length < 5) throw new Error("Escreva um pouco mais para podermos entender o problema.");
  if (cleanMessage.length > 2000) throw new Error("A mensagem deve ter no máximo 2.000 caracteres.");
  if (!firebaseConfigured || !db) return { persisted: false };

  const payload = {
    userId,
    userEmail: user?.email || null,
    userName: user?.displayName || null,
    type,
    message: cleanMessage,
    status: "open",
    source: "web",
    createdAt: serverTimestamp(),
    card: card
      ? {
          cardId: card.id || null,
          front: String(card.front || "").slice(0, 1000),
          back: String(card.back || "").slice(0, 1000),
          subject: card.subject || null,
          topic: card.topic || null,
          difficulty: card.difficulty || null,
          deckId: card.deckId || null,
          deckTitle: card.deckTitle || null,
        }
      : null,
  };

  await addDoc(collection(db, "supportRequests"), payload);
  return { persisted: true };
}
