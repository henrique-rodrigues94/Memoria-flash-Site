import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, ChevronRight, Flame, Home, Library,
  Search, Settings, Sparkles, ThumbsDown, ThumbsUp, TrendingUp,
  LogIn, LogOut
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
import "./styles.css";

const REASONS = ["Pergunta confusa","Resposta incorreta","Explicação ruim","Muito fácil","Muito difícil","Conteúdo repetido","Desatualizado"];

function authErrorMessage(error) {
  const code = error?.code || "";

  if (code.includes("popup-blocked")) {
    return "O navegador bloqueou a janela do Google. Vamos tentar o login por redirecionamento.";
  }
  if (code.includes("popup-closed-by-user")) {
    return "A janela de login foi fechada antes de concluir.";
  }
  if (code.includes("unauthorized-domain")) {
    return "Este domínio ainda não está autorizado no Firebase Authentication.";
  }
  if (code.includes("operation-not-allowed")) {
    return "O login com Google não está ativado no Firebase Authentication.";
  }
  if (code.includes("api-key-not-valid")) {
    return "A configuração do Firebase no .env está inválida.";
  }
  if (code.includes("network-request-failed")) {
    return "Falha de conexão. Verifique a internet e tente novamente.";
  }
  return error?.message || "Não foi possível entrar com o Google.";
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
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setAuthReady(true);
      setAuthBusy(false);
    });

    // Se o Google redirecionou de volta para o site, consome o resultado.
    getRedirectResult(auth).catch((error) => {
      if (!active) return;
      if (error?.code !== "auth/no-auth-event") {
        setAuthError(authErrorMessage(error));
      }
      setAuthBusy(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
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

  async function startStudy(subject = null, topic = null, level = null) {
    setStudyLoading(true);
    try {
      const data = await loadContent({ subject, topic, level });
      setStudyCards(data.cards);
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
      setFeedbackStatus(result.persisted ? "Obrigado. Esse feedback ajudará o agente a melhorar o conteúdo." : "Faça login para sincronizar o feedback.");
      setFeedback("down-sent");
    } catch {
      setFeedbackStatus("Não foi possível salvar agora.");
    }
  }

  async function login() {
    if (!auth || !firebaseConfigured || authBusy) return;

    setAuthBusy(true);
    setAuthError("");

    try {
      // Aguarda a persistência antes do popup para evitar corrida entre
      // inicialização do Auth e criação da sessão.
      await authPersistenceReady;

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      await signInWithPopup(auth, provider);
      // onAuthStateChanged encerra o estado de loading.
    } catch (error) {
      const code = error?.code || "";

      // Popup bloqueado/indisponível: usa redirect, que funciona melhor
      // em ambientes incorporados e alguns navegadores com bloqueio de popup.
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
          <button className={tab === "study" ? "nav-item active" : "nav-item"} onClick={() => startStudy()}><BookOpen size={19}/> Estudar</button>
          <button className={tab === "stats" ? "nav-item active" : "nav-item"} onClick={() => setTab("stats")}><TrendingUp size={19}/> Progresso</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-icon"><Flame size={18}/></div><div><strong>Seu estudo</strong><span>{user ? user.displayName || "Conta conectada" : "Modo visitante"}</span></div></div>
          <button className="nav-item"><Settings size={19}/> Configurações</button>
          {user ? (
            <button className="nav-item" onClick={logout} disabled={authBusy}><LogOut size={19}/> {authBusy ? "Saindo..." : "Sair"}</button>
          ) : (
            <button className="nav-item" onClick={login} disabled={!firebaseConfigured || !authReady || authBusy}>
              <LogIn size={19}/>
              {!firebaseConfigured ? "Firebase não configurado" : !authReady ? "Verificando sessão..." : authBusy ? "Entrando..." : "Entrar com Google"}
            </button>
          )}
          {authError && <small className="feedback-status">{authError}</small>}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><Brain size={20}/> MemoriaFlash</div>
          <div className="top-search"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar matéria ou tópico..." /></div>
          <button className="profile">{user?.displayName?.[0]?.toUpperCase() || "M"}</button>
        </header>

        {tab === "home" && (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow"><Sparkles size={15}/> Seu centro de estudos</span>
                <h1>Estude no seu ritmo.</h1>
                <p>Escolha uma matéria, revise seus cards e envie feedback para ajudar o conteúdo a evoluir.</p>
                <button className="primary" onClick={() => startStudy()} disabled={studyLoading}>Começar estudo <ChevronRight size={18}/></button>
              </div>
              <div className="hero-orbit"><Brain size={92}/><span>{content.subjects.length}</span><small>matérias</small></div>
            </section>

            <section className="section-head"><div><h2>Conteúdo disponível</h2><p>{content.source === "firebase" ? "Grade curricular carregada do Firebase. Os cards são buscados ao iniciar o estudo." : "Modo de demonstração até o Firebase ser configurado."}</p></div></section>
            <div className="subject-grid">
              {filteredSubjects.map((subject) => (
                <article className="subject-card" key={subject.id}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="subject-main"><h3>{subject.name}</h3><span>{subject.topics.length.toLocaleString("pt-BR")} tópicos</span></div>
                  <div className="progress"><div style={{width: "0%"}}/></div>
                  <div className="subject-foot"><span>{subject.levels?.length || 0} níveis</span><button onClick={() => startStudy(subject.name)} disabled={studyLoading}>Estudar <ChevronRight size={15}/></button></div>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><Library size={15}/> Biblioteca</span><h1>Matérias e tópicos</h1><p>Selecione exatamente o conteúdo que deseja estudar.</p></div>
            <div className="library-list">
              {filteredSubjects.map((subject) => (
                <article className="library-row" key={subject.id}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="row-main"><h3>{subject.name}</h3><span>{subject.levels?.length || 0} níveis · {subject.topics.length} tópicos</span></div>
                  <div className="topic-pills">{subject.topics.slice(0, 4).map((topic) => <button key={topic} onClick={() => startStudy(subject.name, topic)}>{topic}</button>)}</div>
                  <button className="icon-button" onClick={() => startStudy(subject.name)}><ChevronRight size={18}/></button>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "study" && (
          <div className="study-page">
            {studyLoading ? <div className="loading-state"><span className="spinner" /> Buscando cards no Firebase...</div> :
            !card ? <div className="empty-state"><h3>Nenhum card disponível</h3><p>Não há cards de definição para esse filtro no Firebase.</p><button className="secondary" onClick={() => setTab("library")}>Voltar para biblioteca</button></div> : (
              <>
                <div className="study-head"><div><span className="eyebrow"><BookOpen size={15}/> {card.subject || "Estudo"} · {card.topic || "Geral"}</span><h1>Sessão de estudo</h1></div><span className="counter">{(studyIndex % studyCards.length) + 1} / {studyCards.length}</span></div>
                <div className="study-progress"><div style={{width: `${(((studyIndex % studyCards.length) + 1) / studyCards.length) * 100}%`}}/></div>
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
                {feedback === "down-sent" && <div className="study-actions"><button onClick={nextCard} className="secondary">Próximo card <ChevronRight size={17}/></button></div>}
              </>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><TrendingUp size={15}/> Desempenho</span><h1>Seu progresso</h1><p>O progresso individual será persistido no Firebase quando você estiver autenticado.</p></div>
            <div className="stats-grid"><div className="big-stat"><span>Cards na sessão</span><strong>{studyCards.length}</strong><em>disponíveis agora</em></div><div className="big-stat"><span>Fonte</span><strong>{content.source === "firebase" ? "Firebase" : "Demo"}</strong><em>camada de dados</em></div><div className="big-stat"><span>Conta</span><strong>{user ? "Conectada" : "Visitante"}</strong><em>{user?.email || "Entre para salvar progresso"}</em></div></div>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
