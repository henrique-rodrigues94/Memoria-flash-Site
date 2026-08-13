import { collection, getDocs } from "firebase/firestore";
import { db, firebaseConfigured } from "../lib/firebase";

const fallbackSubjects = [
  { id: "portugues", name: "Português", cards: 4283, progress: 0, color: "violet", topics: ["Morfologia", "Sintaxe", "Interpretação de Texto"] },
  { id: "direito-constitucional", name: "Direito Constitucional", cards: 2187, progress: 0, color: "blue", topics: ["Direitos Fundamentais", "Organização do Estado", "Controle de Constitucionalidade"] },
  { id: "informatica", name: "Informática", cards: 3124, progress: 0, color: "cyan", topics: ["Redes", "Segurança da Informação", "Sistemas Operacionais"] },
  { id: "criminalistica", name: "Criminalística", cards: 1482, progress: 0, color: "orange", topics: ["Local de Crime", "Vestígios", "Cadeia de Custódia"] },
];

const fallbackCards = [
  { id: "pt-001", subject: "Português", topic: "Morfologia", difficulty: "medium", front: "Qual é a função principal de um substantivo na língua portuguesa?", back: "Nomear seres, objetos, lugares, sentimentos, ações ou conceitos.", explanation: "O substantivo funciona como núcleo de grupos nominais e pode designar entidades concretas ou abstratas.", curiosity: "Substantivos abstratos podem nomear sentimentos e qualidades." },
  { id: "pt-002", subject: "Português", topic: "Sintaxe", difficulty: "hard", front: "Na frase “Os alunos estudaram para a prova”, qual é o sujeito?", back: "“Os alunos”.", explanation: "O sujeito é o termo sobre o qual se declara algo.", curiosity: "A concordância verbal ajuda a identificar o sujeito." },
  { id: "dc-001", subject: "Direito Constitucional", topic: "Direitos Fundamentais", difficulty: "medium", front: "Qual princípio garante que ninguém será obrigado a fazer ou deixar de fazer algo senão em virtude de lei?", back: "O princípio da legalidade.", explanation: "A legalidade exige fundamento legal para obrigações impostas aos particulares.", curiosity: "A Constituição prevê a legalidade no artigo 5º, inciso II." },
];

function firstDefined(obj, keys, fallback = "") {
  for (const key of keys) if (obj?.[key] != null && obj[key] !== "") return obj[key];
  return fallback;
}

export async function loadContent() {
  if (!firebaseConfigured || !db) return { subjects: fallbackSubjects, cards: fallbackCards, source: "demo" };

  try {
    const [subjectsSnap, bucketsSnap] = await Promise.all([
      getDocs(collection(db, "subjects")),
      getDocs(collection(db, "cardBuckets")),
    ]);

    const subjects = subjectsSnap.docs.map((doc) => {
      const data = doc.data();
      const topics = firstDefined(data, ["topics", "topicos"], []);
      return {
        id: doc.id,
        name: firstDefined(data, ["name", "nome", "title", "titulo"], doc.id),
        cards: Number(firstDefined(data, ["cardCount", "cardsCount", "cards"], 0)) || 0,
        progress: 0,
        color: firstDefined(data, ["color", "cor"], "violet"),
        topics: Array.isArray(topics)
          ? topics.map((t) => typeof t === "string" ? t : firstDefined(t, ["name", "nome", "title", "titulo"], "Tópico"))
          : [],
      };
    });

    const cards = [];
    bucketsSnap.docs.forEach((bucketDoc) => {
      const bucket = bucketDoc.data();
      const list = Array.isArray(bucket.cards) ? bucket.cards : [];
      list.forEach((raw, index) => {
        const card = raw || {};
        cards.push({
          ...card,
          id: card.id || `${bucketDoc.id}-${index}`,
          subject: firstDefined(card, ["subject", "materia", "subjectName"], firstDefined(bucket, ["subject", "materia"], "")),
          topic: firstDefined(card, ["topic", "topico", "topicName"], firstDefined(bucket, ["topic", "topico"], "")),
          front: firstDefined(card, ["front", "question", "pergunta"], ""),
          back: firstDefined(card, ["back", "answer", "resposta"], ""),
          explanation: firstDefined(card, ["explanation", "explicacao"], ""),
          curiosity: firstDefined(card, ["curiosity", "curiosidade"], ""),
          difficulty: firstDefined(card, ["difficulty", "dificuldade"], "medium"),
        });
      });
    });

    if (!subjects.length && !cards.length) return { subjects: fallbackSubjects, cards: fallbackCards, source: "empty-firebase" };
    return { subjects: subjects.length ? subjects : fallbackSubjects, cards: cards.length ? cards : fallbackCards, source: "firebase" };
  } catch (error) {
    console.error("MemoriaFlash: falha ao carregar conteúdo", error);
    return { subjects: fallbackSubjects, cards: fallbackCards, source: "fallback-error" };
  }
}
