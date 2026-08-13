import {
  doc,
  getDoc,
  getDocs,
  collection,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

const DEMO_SUBJECTS = [
  {
    id: "demo-portugues",
    name: "Português",
    topics: ["Morfologia", "Sintaxe", "Interpretação de Texto"],
    levels: [],
    curricula: [],
    color: "blue",
  },
];

const LEVEL_LABELS = {
  fundamental: "Ensino Fundamental",
  medio: "Ensino Médio",
  faculdade: "Faculdade",
  concurso: "Concurso",
  tecnico: "Técnico",
};

const text = (value, fallback = "") =>
  value === undefined ||
  value === null ||
  String(value).trim() === ""
    ? fallback
    : String(value).trim();

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function shortHash(value, length = 16) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

async function curriculumId(subject, level) {
  return shortHash(
    `${normalizeText(subject)}|${String(level).trim().toLowerCase()}`,
  );
}

function normalizeLevel(level) {
  const normalized = text(level?.level).toLowerCase();

  return {
    level: normalized,
    label:
      text(level?.label) ||
      LEVEL_LABELS[normalized] ||
      normalized ||
      "Nível",
    priority: Number(level?.priority ?? 999),
  };
}

function normalizeCurriculum(snapshot) {
  const data = snapshot.data();

  const categories = Array.isArray(data.categories)
    ? data.categories.map((category) => ({
        category: text(category?.category, "Geral"),
        topics: Array.isArray(category?.topics)
          ? category.topics.map((topic) => text(topic)).filter(Boolean)
          : [],
      }))
    : [];

  return {
    id: snapshot.id,
    subject: text(data.subject),
    level: text(data.level).toLowerCase(),
    categories,
    totalTopics:
      Number(data.totalTopics) ||
      categories.reduce(
        (total, category) => total + category.topics.length,
        0,
      ),
    updatedAt: data.updatedAt || null,
  };
}

function normalizeCard(raw, bucket) {
  return {
    ...raw,
    id: text(
      raw?.id,
      `${bucket.id}-${Math.random().toString(36).slice(2)}`,
    ),
    front: text(
      raw?.front,
      text(raw?.question, text(raw?.pergunta)),
    ),
    back: text(
      raw?.back,
      text(raw?.answer, text(raw?.resposta)),
    ),
    explanation: text(
      raw?.explanation,
      text(raw?.explicacao),
    ),
    topic: text(raw?.topic, bucket.topic),
    difficulty: text(raw?.difficulty, "medium"),
    subject: bucket.subject,
    level: bucket.level,
    cardType: bucket.cardType,
    bucketId: bucket.id,
  };
}

export async function getSubjects() {
  if (!firebaseConfigured || !db) {
    return DEMO_SUBJECTS;
  }

  const snapshot = await getDocs(
    collection(db, "subjects"),
  );

  const subjects = await Promise.all(
    snapshot.docs.map(async (subjectDoc) => {
      const data = subjectDoc.data();

      const levels = (
        Array.isArray(data.levels) ? data.levels : []
      )
        .map(normalizeLevel)
        .filter((level) => level.level)
        .sort((a, b) => a.priority - b.priority);

      const curricula = await Promise.all(
        levels.map(async (level) => {
          const id = await curriculumId(
            text(data.subject, subjectDoc.id),
            level.level,
          );

          const curriculumSnapshot = await getDoc(
            doc(db, "curricula", id),
          );

          return curriculumSnapshot.exists()
            ? normalizeCurriculum(curriculumSnapshot)
            : null;
        }),
      );

      const validCurricula = curricula.filter(Boolean);

      const topics = [
        ...new Set(
          validCurricula.flatMap((curriculum) =>
            curriculum.categories.flatMap(
              (category) => category.topics,
            ),
          ),
        ),
      ];

      return {
        id: subjectDoc.id,
        name: text(data.subject, subjectDoc.id),
        topics,
        levels,
        curricula: validCurricula,
        color: "blue",
      };
    }),
  );

  return subjects;
}

export async function getCurriculum(subject, level) {
  if (!firebaseConfigured || !db || !subject || !level) {
    return null;
  }

  const id = await curriculumId(subject, level);

  const snapshot = await getDoc(
    doc(db, "curricula", id),
  );

  return snapshot.exists()
    ? normalizeCurriculum(snapshot)
    : null;
}

/**
 * Busca um cardBucket oficial.
 *
 * O ID do bucket é determinístico no backend:
 * sha1(subject|topic|level|cardType)
 *
 * Reproduzimos o mesmo cálculo no navegador para fazer 1 read
 * direto no documento, evitando consultas compostas e índices extras.
 */
export async function getCards({
  subject,
  topic,
  level,
  cardType = "definition",
} = {}) {
  if (!firebaseConfigured || !db) {
    return [];
  }

  if (!subject || !topic || !level) {
    return [];
  }

  const id = await shortHash(
    `${normalizeText(subject)}|${normalizeText(topic)}|${String(level).trim().toLowerCase()}|${cardType}`,
  );

  const snapshot = await getDoc(
    doc(db, "cardBuckets", id),
  );

  if (!snapshot.exists()) {
    return [];
  }

  const data = snapshot.data();

  const bucket = {
    id: snapshot.id,
    subject: text(data.subject, subject),
    topic: text(data.topic, topic),
    level: text(data.level, level).toLowerCase(),
    cardType: text(data.cardType, cardType),
  };

  return Array.isArray(data.cards)
    ? data.cards.map((card) =>
        normalizeCard(card || {}, bucket),
      )
    : [];
}

export async function getStudyContent({
  subject,
  level,
  topic,
  cardType = "definition",
} = {}) {
  const curriculum = await getCurriculum(
    subject,
    level,
  );

  const cards = topic
    ? await getCards({
        subject,
        topic,
        level,
        cardType,
      })
    : [];

  return {
    curriculum,
    cards,
  };
}

export async function loadContent() {
  const subjects = await getSubjects();

  return {
    subjects,
    cards: [],
    source: firebaseConfigured
      ? "firebase"
      : "demo",
  };
}
