import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

const demoSubjects = [
  {
    id: "demo-portugues",
    name: "Português",
    cards: 0,
    topics: ["Morfologia", "Sintaxe", "Interpretação de Texto"],
    levels: [],
    color: "blue",
  },
];

const text = (value, fallback = "") =>
  value === undefined || value === null || String(value).trim() === ""
    ? fallback
    : String(value).trim();

const unique = (items) => [...new Set(items.filter(Boolean))];

function normalizeLevel(level) {
  return {
    level: text(level?.level),
    label: text(level?.label, text(level?.level, "Nível")),
    priority: Number(level?.priority ?? 999),
  };
}

function normalizeCard(raw, bucket) {
  return {
    ...raw,
    id: text(raw?.id, `${bucket.id}-${Math.random().toString(36).slice(2)}`),
    front: text(raw?.front, text(raw?.question, text(raw?.pergunta))),
    back: text(raw?.back, text(raw?.answer, text(raw?.resposta))),
    explanation: text(raw?.explanation, text(raw?.explicacao)),
    curiosity: text(raw?.curiosity, text(raw?.curiosidade)),
    subject: text(raw?.subject, bucket.subject),
    topic: text(raw?.topic, bucket.topic),
    difficulty: text(raw?.difficulty, "medium"),
    level: text(raw?.level, bucket.level),
    cardType: text(raw?.cardType, bucket.cardType),
  };
}

async function fetchCurriculaForSubject(subjectDoc) {
  const levels = (Array.isArray(subjectDoc.levels) ? subjectDoc.levels : [])
    .map(normalizeLevel)
    .filter((level) => level.level);

  const results = await Promise.all(
    levels.map(async (level) => {
      const q = query(
        collection(db, "curricula"),
        where("subject", "==", subjectDoc.subject),
        where("level", "==", level.level),
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        level: level.level,
      }));
    }),
  );

  return results.flat();
}

export async function getSubjects() {
  if (!firebaseConfigured || !db) return demoSubjects;

  const snapshot = await getDocs(collection(db, "subjects"));

  const subjects = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const levels = (Array.isArray(data.levels) ? data.levels : [])
        .map(normalizeLevel)
        .sort((a, b) => a.priority - b.priority);

      const curricula = await fetchCurriculaForSubject({
        subject: text(data.subject, doc.id),
        levels,
      });

      const topics = unique(
        curricula.flatMap((curriculum) =>
          Array.isArray(curriculum.categories)
            ? curriculum.categories.flatMap((category) =>
                Array.isArray(category.topics) ? category.topics : [],
              )
            : [],
        ),
      );

      return {
        id: doc.id,
        name: text(data.subject, doc.id),
        cards: 0,
        topics,
        levels,
        curricula,
        color: "blue",
      };
    }),
  );

  return subjects;
}

/**
 * Lê somente cardBuckets oficiais do schema do MemoriaFlash.
 *
 * O backend usa:
 * cardBuckets/{hash(subject|topic|level|cardType)}
 *
 * No cliente não precisamos reproduzir o hash: consultamos os campos
 * indexados do documento, evitando duplicar a implementação de SHA-1.
 */
export async function getCards(filters = {}) {
  if (!firebaseConfigured || !db) return [];

  const constraints = [where("cardType", "==", filters.cardType || "definition")];

  if (filters.subject) {
    constraints.push(where("subject", "==", filters.subject));
  }

  if (filters.topic) {
    constraints.push(where("topic", "==", filters.topic));
  }

  if (filters.level) {
    constraints.push(where("level", "==", filters.level));
  }

  const q = query(collection(db, "cardBuckets"), ...constraints);
  const snapshot = await getDocs(q);
  const cards = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();

    if (!Array.isArray(data.cards)) return;

    data.cards.forEach((raw) => {
      const card = normalizeCard(raw, {
        id: doc.id,
        subject: data.subject,
        topic: data.topic,
        level: data.level,
        cardType: data.cardType,
      });

      if (filters.subject && card.subject !== filters.subject) return;
      if (filters.topic && card.topic !== filters.topic) return;
      if (filters.level && card.level !== filters.level) return;

      cards.push(card);
    });
  });

  return cards;
}

export async function loadContent(filters = {}) {
  const subjects = await getSubjects();

  // Não baixa o banco inteiro ao abrir o site.
  // Cards são carregados somente quando o usuário inicia uma sessão.
  const cards = filters.subject || filters.topic || filters.level
    ? await getCards(filters)
    : [];

  return {
    subjects,
    cards,
    source: firebaseConfigured ? "firebase" : "demo",
  };
}

export async function getStudyContent(filters = {}) {
  return loadContent(filters);
}
