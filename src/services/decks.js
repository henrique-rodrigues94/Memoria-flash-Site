import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

function normalizeCard(card = {}, deck = {}) {
  return {
    id: card.id || `${deck.id}-${Math.random().toString(36).slice(2)}`,
    front: card.front || card.question || "",
    back: card.back || card.answer || "",
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

export async function createUserDeck({
  userId,
  title,
  category,
  description = "",
  cards = [],
}) {
  if (!db || !userId) throw new Error("Usuário não autenticado.");
  if (!title?.trim()) throw new Error("Informe o nome do baralho.");
  if (!Array.isArray(cards) || !cards.length) {
    throw new Error("Nenhum card para salvar.");
  }

  const normalizedCards = cards.map((card, index) => ({
    id: card.id || `${Date.now()}-${index}`,
    front: card.front || card.question || "",
    back: card.back || card.answer || "",
    topic: card.topic || title.trim(),
    difficulty: card.difficulty || "medium",
    explanation: card.explanation || "",
    curiosity: card.curiosity || "",
    reps: Number(card.reps || 0),
    interval: Number(card.interval || 0),
    efactor: Number(card.efactor || 2.5),
    dueDate: card.dueDate || new Date().toISOString(),
  }));

  const ref = await addDoc(collection(db, "decks"), {
    userId,
    title: title.trim(),
    category: category?.trim() || "Geral",
    description: description?.trim() || "Gerado no MemoriaFlash Web",
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
    cards: normalizedCards,
  });

  return { id: ref.id, cards: normalizedCards };
}
