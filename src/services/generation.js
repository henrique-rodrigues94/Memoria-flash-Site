const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  ""
).replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Erro HTTP ${response.status}`,
    );
  }

  return data;
}

/**
 * Gera cards através do MESMO backend usado pelo aplicativo.
 *
 * Regra importante:
 * sourceType="subject" mantém o fluxo de conteúdo compartilhado.
 * O backend consulta o cardBuckets antes de chamar a IA e salva os novos
 * cards no mesmo Firestore usado pelo aplicativo mobile.
 */
export async function generateFlashcards({
  subject,
  topic,
  educationLevel = "medio",
  count = 10,
  difficulty = "medium",
  language = "pt",
  cardContentType = "definition",
  existingFronts = [],
}) {
  if (!subject?.trim()) {
    throw new Error("Informe a matéria.");
  }

  if (!topic?.trim()) {
    throw new Error("Informe o tópico.");
  }

  const response = await fetch(
    apiUrl("/api/gemini/generate-flashcards"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Gere flashcards para a matéria "${subject.trim()}", focando exclusivamente no tópico "${topic.trim()}".`,
        subject: subject.trim(),
        topic: topic.trim(),
        selectedTopics: [topic.trim()],
        educationLevel,
        count,
        difficulty,
        language,
        cardContentType,
        sourceType: "subject",
        existingFronts: Array.isArray(existingFronts)
          ? existingFronts
          : [],
      }),
    },
  );

  return parseResponse(response);
}

/**
 * Retorna o status da API/IA para a UI poder mostrar se a geração
 * está disponível antes de o usuário iniciar uma geração.
 */
export async function getAiStatus() {
  const response = await fetch(
    apiUrl("/api/ai/status"),
  );

  return parseResponse(response);
}

export { API_BASE_URL };
