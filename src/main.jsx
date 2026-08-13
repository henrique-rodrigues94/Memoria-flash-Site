import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, ChevronRight, Flame, Home, Library,
  Search, Settings, Sparkles, ThumbsDown, ThumbsUp, TrendingUp,
  LogIn, LogOut, Wand2, X, Layers,
} from "lucide-react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
} from "firebase/auth";
import {
  auth,
  firebaseConfigured,
  authPersistenceReady,
} from "./lib/firebase";
import { loadContent } from "./services/content";
import { saveCardFeedback } from "./services/feedback";
import { saveCardProgress } from "./services/progress";
import { generateFlashcards } from "./services/generation";
import "./styles.css";

const REASONS = ["Pergunta confusa","Resposta incorreta","Explicação ruim","Muito fácil","Muito difícil","Conteúdo repetido","Desatualizado"];
const LEVEL_LABELS = { fundamental: "Ensino Fundamental", medio: "Ensino Médio", faculdade: "Faculdade", concurso: "Concurso", tecnico: "Técnico" };
const DAILY_GOAL_KEY = "memoriaflash-daily-goal";
const SESSION_SIZE_KEY = "memoriaflash-session-size";
const STUDIED_KEY = "memoriaflash-studied";
const STREAK_KEY = "memoriaflash-streak";
const LAST_STUDY_DAY_KEY = "memoriaflash-last-study-day";

function authErrorMessage(error) {
  const code = error?.code || "";

  if (code.includes("popup-blocked")) return "O navegador bloqueou a janela do Google. Vamos tentar o login por redirecionamento.";
  if (code.includes("popup-closed-by-user")) return "A janela de login foi fechada antes de concluir.";
  if (code.includes("unauthorized-domain")) return "Este domínio ainda não está autorizado no Firebase Authentication.";
  if (code.includes("operation-not-allowed")) return "O login com Google não está ativado no Firebase Authentication.";
  if (code.includes("api-key-not-valid")) return "A configuração do Firebase no .env está inválida.";
  if (code.includes("network-request-failed")) return "Falha de conexão. Verifique a internet e tente novamente.";
  return error?.message || "Não foi possível entrar com o Google.";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function bumpStreak() {
  const last = localStorage.getItem(LAST_STUDY_DAY_KEY);
  const today = todayKey();
  if (last === today) return Number(localStorage.getItem(STREAK_KEY) || 1);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = Number(localStorage.getItem(STREAK_KEY) || 0);
  const next = last === yesterday ? current + 1 : 1;

  localStorage.setItem(STREAK_KEY, String(next));
  localStorage.setItem(LAST_STUDY_DAY_KEY, today);
  return next;
}

function App() {
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [content, setContent] = useState({ subjects: [], cards: [], source: "loading" });
  const [loading, setLoading] = useState(true);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyMeta, setStudyMeta] = useState(null); // { subject, topic, level }
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [pickerSubject, setPickerSubject] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [studied, setStudied] = useState(() => Number(localStorage.getItem(STUDIED_KEY) || 0));
  const [streak, setStreak] = useState(() => Number(localStorage.getItem(STREAK_KEY) || 0));
  const [dailyGoal, setDailyGoal] = useState(() => Number(localStorage.getItem(DAILY_GOAL_KEY) || 18));
  const [sessionSize, setSessionSize] = useState(() => Number(localStorage.getItem(SESSION_SIZE_KEY) || 20));

  useEffect(() => {
    if (!auth) { setAuthReady(true); return undefined; }
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setAuthReady(true);
      setAuthBusy(false);
    });

    getRedirectResult(auth).catch((error) => {
      if (!active) return;
      if (error?.code !== "auth/no-auth-event") setAuthError(authErrorMessage(error));
      setAuthBusy(false);
    });

    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    loadContent().then((data) => {
      setContent(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return content.subjects;
    return content.subjects.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.topics.some((t) => t.toLowerCase().includes(q))
    );
  }, [content.subjects, query]);

  const card = studyCards.length ? studyCards[studyIndex % studyCards.length] : null;

  async function refreshSubjects() {
    const data = await loadContent();
    setContent((prev) => ({ ...prev, subjects: data.subjects, source: data.source }));
  }

  async function startStudy(subject, topic, level) {
    if (!subject || !topic || !level) {
      setPickerSubject(content.subjects.find((s) => s.name === subject) || content.subjects[0] || null);
      return;
    }
    setStudyLoading(true);
    setPickerSubject(null);
    try {
      const data = await loadContent({ subject, topic, level });
      setStudyMeta({ subject, topic, level });
      setStudyCards(data.cards.slice(0, sessionSize || undefined));
      setStudyIndex(0);
      setRevealed(false);
      setFeedback(null);
      setFeedbackReason("");
      setFeedbackComment("");
      setFeedbackStatus("");
      setTab("study");
    } finally {
      setStudyLoading(false);
    }
  }

  async function nextCard() {
    if (card && user) await saveCardProgress(user.uid, card.id, { reviewed: true });
    setStudied((v) => { const n = v + 1; localStorage.setItem(STUDIED_KEY, String(n)); return n; });
    if (studyIndex % studyCards.length === studyCards.length - 1) setStreak(bumpStreak());
    setStudyIndex((i) => i + 1);
    setRevealed(false);
    setFeedback(null);
    setFeedbackReason("");
    setFeedbackComment("");
    setFeedbackStatus("");
  }

  async function sendFeedback(rating) {
    if (!card) return;
    setFeedback(rating);
    if (rating === "down") return;
    setFeedbackStatus("Enviando...");
    try {
      const result = await saveCardFeedback({ userId: user?.uid, card, rating: "positive" });
      setFeedbackStatus(result.persisted ? "Feedback salvo." : "Faça login para sincronizar o feedback.");
    } catch {
      setFeedbackStatus("Não foi possível salvar agora.");
    }
  }

  async function sendNegativeFeedback() {
    if (!card || !feedbackReason) return;
    setFeedbackStatus("Enviando...");
    try {
      const result = await saveCardFeedback({
        userId: user?.uid, card, rating: "negative",
        reason: feedbackReason, comment: feedbackComment,
      });
      setFeedback("down-sent");
      setFeedbackStatus(result.persisted ? "Feedback salvo. Obrigado!" : "Faça login para sincronizar o feedback.");
    } catch {
      setFeedbackStatus("Não foi possível salvar agora.");
    }
  }

  async function login() {
    if (!firebaseConfigured || !auth || authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await authPersistenceReady;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = error?.code || "";
      if (
        code.includes("popup-blocked") ||
        code.includes("popup-failed") ||
        code.includes("operation-not-supported-in-this-environment")
      ) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          setAuthError(authErrorMessage(redirectError));
        }
      } else {
        setAuthError(authErrorMessage(error));
      }
      setAuthBusy(false);
    }
  }

  async function logout() {
    if (!auth || authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(authErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function saveSettings(nextGoal, nextSize) {
    setDailyGoal(nextGoal);
    setSessionSize(nextSize);
    localStorage.setItem(DAILY_GOAL_KEY, String(nextGoal));
    localStorage.setItem(SESSION_SIZE_KEY, String(nextSize));
  }

  if (loading) return <div className="loading-state"><span className="spinner" /> Carregando MemoriaFlash...</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Brain size={22}/></div>
          <div><strong>MemoriaFlash</strong><span>Estude melhor</span></div>
        </div>
        <nav>
          <button className={tab === "home" ? "nav-item active" : "nav-item"} onClick={() => setTab("home")}><Home size={19}/> Início</button>
          <button className={tab === "library" ? "nav-item active" : "nav-item"} onClick={() => setTab("library")}><Library size={19}/> Biblioteca</button>
          <button className={tab === "study" ? "nav-item active" : "nav-item"} onClick={() => (studyMeta ? startStudy(studyMeta.subject, studyMeta.topic, studyMeta.level) : setTab("library"))}><BookOpen size={19}/> Estudar</button>
          <button className={tab === "stats" ? "nav-item active" : "nav-item"} onClick={() => setTab("stats")}><TrendingUp size={19}/> Progresso</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-icon"><Flame size={18}/></div><div><strong>{streak} dias</strong><span>sequência atual</span></div></div>
          <button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings size={19}/> Configurações</button>
          {user ? (
            <button className="nav-item" onClick={logout} disabled={authBusy}><LogOut size={19}/> {authBusy ? "Saindo..." : "Sair"}</button>
          ) : (
            <button className="nav-item" onClick={login} disabled={!firebaseConfigured || !authReady || authBusy}>
              <LogIn size={19}/>
              {!firebaseConfigured ? "Firebase não configurado" : !authReady ? "Verificando sessão..." : authBusy ? "Entrando..." : "Entrar com Google"}
            </button>
          )}
          {authError && <small className="feedback-status">{authError}</small>}
          <div className="user-mini"><div className="avatar">{user?.displayName?.[0]?.toUpperCase() || "M"}</div><div><strong>{user ? (user.displayName || "Conta conectada") : "Modo visitante"}</strong><span>{content.source === "firebase" ? "Sincronizado com o app" : "Modo de demonstração"}</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><Brain size={20}/> MemoriaFlash</div>
          <div className="top-search"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar matéria ou tópico..." /></div>
          <button className="primary small" onClick={() => setGeneratorOpen(true)}><Wand2 size={15}/> Gerar cards</button>
          <button className="profile">{user?.displayName?.[0]?.toUpperCase() || "M"}</button>
        </header>

        {tab === "home" && (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow"><Sparkles size={15}/> Seu centro de estudos</span>
                <h1>Estude no seu ritmo.</h1>
                <p>Escolha uma matéria, revise seus cards e envie feedback para ajudar o conteúdo a evoluir. Os baralhos são os mesmos do aplicativo MemoriaFlash — tudo sincronizado pelo Firebase.</p>
                <button className="primary" onClick={() => setTab("library")} disabled={studyLoading}>Começar estudo <ChevronRight size={18}/></button>
              </div>
              <div className="hero-orbit"><Brain size={92}/><span>{content.subjects.length}</span><small>matérias</small></div>
            </section>

            <div className="today-grid">
              <div className="metric-card"><span className="metric-icon purple"><BookOpen size={19}/></span><strong>{studied.toLocaleString("pt-BR")}</strong><span>cards estudados</span></div>
              <div className="metric-card"><span className="metric-icon orange"><Flame size={19}/></span><strong>{streak}</strong><span>dias seguidos</span></div>
              <div className="metric-card"><span className="metric-icon blue"><Layers size={19}/></span><strong>{sessionSize}</strong><span>cards por sessão</span></div>
              <div className="metric-card"><span className="metric-icon green"><TrendingUp size={19}/></span><strong>{dailyGoal} min</strong><span>meta diária</span></div>
            </div>

            <section className="section-head"><div><h2>Conteúdo disponível</h2><p>{content.source === "firebase" ? "Grade curricular carregada do Firebase — os mesmos baralhos do aplicativo." : "Modo de demonstração até o Firebase ser configurado."}</p></div></section>
            <div className="subject-grid">
              {filteredSubjects.map((subject) => (
                <article className="subject-card" key={subject.id}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="subject-main"><h3>{subject.name}</h3><span>{subject.topics.length.toLocaleString("pt-BR")} tópicos</span></div>
                  <div className="progress"><div style={{ width: "0%" }}/></div>
                  <div className="subject-foot"><span>{subject.levels?.length || 0} níveis</span><button onClick={() => setPickerSubject(subject)} disabled={studyLoading}>Estudar <ChevronRight size={15}/></button></div>
                </article>
              ))}
              {!filteredSubjects.length && <p className="empty-state">Nenhuma matéria encontrada. Gere novos cards pelo botão "Gerar cards".</p>}
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><Library size={15}/> Biblioteca</span><h1>Matérias e tópicos</h1><p>Selecione exatamente o conteúdo que deseja estudar — o mesmo baralho fica disponível no app mobile.</p></div>
            <div className="library-list">
              {filteredSubjects.map((subject) => (
                <article className="library-row" key={subject.id} onClick={() => setPickerSubject(subject)}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="row-main"><h3>{subject.name}</h3><span>{subject.levels?.length || 0} níveis · {subject.topics.length} tópicos</span></div>
                  <div className="topic-pills">{subject.topics.slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div>
                  <button className="icon-button" onClick={(e) => { e.stopPropagation(); setPickerSubject(subject); }}><ChevronRight size={18}/></button>
                </article>
              ))}
              {!filteredSubjects.length && <p className="empty-state">Nenhuma matéria ainda. Use "Gerar cards" para criar o primeiro baralho.</p>}
            </div>
          </div>
        )}

        {tab === "study" && (
          <div className="study-page">
            {studyLoading ? <div className="loading-state"><span className="spinner" /> Buscando cards no Firebase...</div> :
            !card ? <div className="empty-state"><h3>Nenhum card disponível</h3><p>Não há cards para esse filtro no Firebase ainda. Gere novos cards com IA ou escolha outro tópico.</p><button className="secondary" onClick={() => setTab("library")}>Voltar para biblioteca</button> <button className="primary small" onClick={() => setGeneratorOpen(true)}><Wand2 size={15}/> Gerar cards</button></div> : (
              <>
                <div className="study-head"><div><span className="eyebrow"><BookOpen size={15}/> {card.subject || "Estudo"} · {card.topic || "Geral"}</span><h1>Sessão de estudo</h1></div><span className="counter">{(studyIndex % studyCards.length) + 1} / {studyCards.length}</span></div>
                <div className="study-progress"><div style={{ width: `${(((studyIndex % studyCards.length) + 1) / studyCards.length) * 100}%` }}/></div>
                <article className={"flashcard " + (revealed ? "revealed" : "")}>
                  {!revealed ? (
                    <div className="card-face"><span className="card-label">PERGUNTA</span><h2>{card.front}</h2><button className="primary" onClick={() => setRevealed(true)}>Mostrar resposta</button></div>
                  ) : (
                    <div className="card-face">
                      <span className="card-label">RESPOSTA</span><h2 className="answer">{card.back}</h2>
                      <div className="explanation"><strong>📘 Explicação</strong><p>{card.explanation || "Sem explicação cadastrada."}</p>{card.curiosity && <><strong>💡 Curiosidade</strong><p>{card.curiosity}</p></>}</div>
                      <div className="feedback-bar"><span>Como foi este card?</span>
                        <button className={feedback === "up" ? "feedback selected-up" : "feedback"} onClick={() => sendFeedback("up")}><ThumbsUp size={16}/> Gostei</button>
                        <button className={feedback === "down" || feedback === "down-sent" ? "feedback selected-down" : "feedback"} onClick={() => sendFeedback("down")}><ThumbsDown size={16}/> Precisa melhorar</button>
                      </div>
                      {feedback === "down" && <div className="feedback-reasons"><span>O que precisa melhorar?</span><div className="reason-list">{REASONS.map((reason) => <button key={reason} className={feedbackReason === reason ? "reason selected" : "reason"} onClick={() => setFeedbackReason(reason)}>{reason}</button>)}</div><textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Comentário opcional..." rows={3}/><button className="primary small" disabled={!feedbackReason} onClick={sendNegativeFeedback}>Enviar feedback</button></div>}
                      {feedbackStatus && <small className="feedback-status">{feedbackStatus}</small>}
                    </div>
                  )}
                </article>
                {revealed && feedback !== "down" && <div className="study-actions"><button onClick={nextCard} className="secondary">Próximo card <ChevronRight size={17}/></button></div>}
              </>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><TrendingUp size={15}/> Desempenho</span><h1>Seu progresso</h1><p>{user ? "Seu progresso é salvo no Firebase e compartilhado com o aplicativo." : "Entre com o Google para sincronizar seu progresso com o aplicativo."}</p></div>
            <div className="stats-grid">
              <div className="big-stat"><span>Cards estudados</span><strong>{studied.toLocaleString("pt-BR")}</strong><em>total nesta conta/navegador</em></div>
              <div className="big-stat"><span>Sequência</span><strong>{streak} dias</strong><em>estude todo dia para manter</em></div>
              <div className="big-stat"><span>Conta</span><strong>{user ? "Conectada" : "Visitante"}</strong><em>{user?.email || "Entre para salvar progresso"}</em></div>
            </div>
          </div>
        )}
      </main>

      <div className="mobile-nav">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><Home size={19}/><span>Início</span></button>
        <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}><Library size={19}/><span>Cards</span></button>
        <button className={tab === "study" ? "active" : ""} onClick={() => setTab("library")}><BookOpen size={19}/><span>Estudar</span></button>
        <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}><TrendingUp size={19}/><span>Progresso</span></button>
      </div>

      {pickerSubject && (
        <SubjectPicker
          subject={pickerSubject}
          onClose={() => setPickerSubject(null)}
          onPick={(topic, level) => startStudy(pickerSubject.name, topic, level)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          dailyGoal={dailyGoal}
          sessionSize={sessionSize}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
        />
      )}

      {generatorOpen && (
        <GeneratorModal
          subjects={content.subjects}
          onClose={() => setGeneratorOpen(false)}
          onGenerated={async (subject, topic, level) => {
            await refreshSubjects();
            setGeneratorOpen(false);
            startStudy(subject, topic, level);
          }}
        />
      )}
    </div>
  );
}

function SubjectPicker({ subject, onClose, onPick }) {
  const levels = subject.levels?.length ? subject.levels : [{ level: "medio", label: LEVEL_LABELS.medio }];
  const [level, setLevel] = useState(levels[0]?.level || "medio");
  const curriculum = subject.curricula?.find((c) => c.level === level);
  const topics = curriculum ? curriculum.categories.flatMap((c) => c.topics) : subject.topics;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18}/></button>
        <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
        <h2>{subject.name}</h2>
        <p>Escolha o nível e depois o tópico para estudar.</p>
        {levels.length > 1 && (
          <div className="filter-row">
            {levels.map((l) => (
              <button key={l.level} className={l.level === level ? "filter active" : "filter"} onClick={() => setLevel(l.level)}>{l.label}</button>
            ))}
          </div>
        )}
        <div className="modal-topics">
          {topics.length ? topics.map((topic) => (
            <button key={topic} onClick={() => onPick(topic, level)}>{topic}<ChevronRight size={16}/></button>
          )) : <p className="empty-state">Nenhum tópico cadastrado para este nível ainda.</p>}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ dailyGoal, sessionSize, onClose, onSave }) {
  const [goal, setGoal] = useState(dailyGoal);
  const [size, setSize] = useState(sessionSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18}/></button>
        <h2>Configurações</h2>
        <p>Preferências do seu ambiente de estudos.</p>
        <div className="modal-topics">
          <label className="settings-row">Meta diária (minutos)
            <input type="number" min="5" max="180" value={goal} onChange={(e) => setGoal(Number(e.target.value) || 5)} />
          </label>
          <label className="settings-row">Cards por sessão
            <input type="number" min="5" max="100" value={size} onChange={(e) => setSize(Number(e.target.value) || 5)} />
          </label>
          <button className="primary small" onClick={() => { onSave(goal, size); onClose(); }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function GeneratorModal({ subjects, onClose, onGenerated }) {
  const [subject, setSubject] = useState(subjects[0]?.name || "");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("medio");
  const [count, setCount] = useState(10);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    if (!subject.trim() || !topic.trim()) {
      setStatus("Informe a matéria e o tópico.");
      return;
    }
    setBusy(true);
    setStatus("Gerando cards com IA...");
    try {
      await generateFlashcards({ subject, topic, educationLevel: level, count });
      setStatus("Cards gerados e salvos no Firebase!");
      onGenerated(subject.trim(), topic.trim(), level);
    } catch (error) {
      setStatus(error.message || "Não foi possível gerar os cards agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18}/></button>
        <h2><Wand2 size={18}/> Gerar cards com IA</h2>
        <p>Usa o mesmo backend do aplicativo — os cards ficam disponíveis no app e no site.</p>
        <div className="modal-topics">
          <label className="settings-row">Matéria
            <input list="subject-list" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Direito Constitucional" />
            <datalist id="subject-list">{subjects.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </label>
          <label className="settings-row">Tópico
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Direitos Fundamentais" />
          </label>
          <label className="settings-row">Nível
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {Object.entries(LEVEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="settings-row">Quantidade de cards
            <input type="number" min="1" max="30" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
          </label>
          <button className="primary small" onClick={handleGenerate} disabled={busy}>{busy ? "Gerando..." : "Gerar cards"}</button>
          {status && <small className="feedback-status">{status}</small>}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
