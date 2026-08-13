import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

function normalizeCard(card = {}, deck = {}) {
  return {
    id: card.id || `${deck.id}-${Math.random().toString(36).slice(2)}`,
    front: card.front || "",
    back: card.back || "",
    topic: card.topic || deck.title || "",
    subject: card.subject || deck.category || "",
    difficulty: card.difficulty || "medium",
    explanation: card.explanation || "",
    curiosity: card.curiosity || "",
    reps: Number(card.reps || 0),
    interval: Number(card.interval || 0),
    efactor: Number(card.efactor || 2.5),
    dueDate: card.dueDate || new Date().toISOString(),
    lastReviewed: card.lastReviewed || null,
  };
}

function normalizeDeck(snapshot) {
  const data = snapshot.data();
  const deck = { id: snapshot.id, ...data };
  return {
    id: snapshot.id,
    title: data.title || "Sem título",
    category: data.category || "Geral",
    description: data.description || "",
    color: data.color || "blue",
    accentBorder: data.accentBorder || "",
    iconName: data.iconName || "BookOpen",
    isPublic: Boolean(data.isPublic),
    createdAt: data.createdAt || null,
    userId: data.userId || null,
    cards: Array.isArray(data.cards)
      ? data.cards.map((card) => normalizeCard(card, deck))
      : [],
  };
}

export function subscribeToUserDecks(userId, onUpdate, onError) {
  if (!db || !userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, "decks"),
    where("userId", "in", [userId, "public", "system"]),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const decks = snapshot.docs.map(normalizeDeck).sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || ""),
      );
      onUpdate(decks);
    },
    (error) => {
      console.error("MemoriaFlash: erro ao sincronizar baralhos", error);
      onError?.(error);
    },
  );
}

export function flattenDeckCards(decks) {
  return decks.flatMap((deck) =>
    deck.cards.map((card) => ({
      ...card,
      deckId: deck.id,
      deckTitle: deck.title,
    })),
  );
}
