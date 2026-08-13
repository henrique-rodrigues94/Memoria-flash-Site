import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, ChevronRight, Library, LogIn, LogOut,
  Search, Sparkles, TrendingUp, ThumbsDown, ThumbsUp
} from "lucide-react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth, authPersistenceReady, firebaseConfigured } from "./lib/firebase";
import { loadContent, getCards } from "./services/content";
import { subscribeToUserDecks, flattenDeckCards } from "./services/decks";
import { saveCardFeedback } from "./services/feedback";
import { saveCardProgress } from "./services/progress";
import "./styles.css";

const REASONS = [
  "Pergunta confusa",
  "Resposta incorreta",
  "Explicação ruim",
  "Muito fácil",
  "Muito difícil",
  "Conteúdo repetido",
  "Desatualizado",
];

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("unauthorized-domain")) return "Este domínio ainda não está autorizado no Firebase Authentication.";
  if (code.includes("operation-not-allowed")) return "O login com Google não está ativado no Firebase Authentication.";
  if (code.includes("popup-closed-by-user")) return "A janela de login foi fechada antes de concluir.";
  if (code.includes("network-request-failed")) return "Falha de conexão. Verifique sua internet.";
  if (code.includes("api-key-not-valid")) return "A configuração do Firebase está inválida.";
  return error?.message || "Não foi possível entrar com o Google.";
}

function LoginScreen({ onLogin, busy, error }) {
  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark"><Brain size={25} /></div>
          <div><strong>MemoriaFlash</strong><span>Estude melhor</span></div>
        </div>
        <div className="login-icon"><BookOpen size={34} /></div>
        <h1>Seus estudos em qualquer lugar.</h1>
        <p>Entre com sua conta Google para acessar os mesmos baralhos e cards do aplicativo mobile.</p>
        <button className="primary login-button" onClick={onLogin} disabled={busy || !firebaseConfigured}>
          <LogIn size={18} />
          {busy ? "Entrando..." : "Entrar com Google"}
        </button>
        {!firebaseConfigured && <small>Firebase não está configurado neste ambiente.</small>}
        {error && <div className="auth-error">{error}</div>}
        <div className="login-benefits">
          <span>✓ Baralhos sincronizados</span>
          <span>✓ Cards do aplicativo</span>
          <span>✓ Progresso sincronizado</span>
        </div>
      </div>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [content, setContent] = useState({ subjects: [], source: "loading" });
  const [decks, setDecks] = useState([]);
  const [deckError, setDeckError] = useState("");
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [studyLoading, setStudyLoading] = useState(false);
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

    getRedirectResult(auth).catch((error) => {
      if (!active || error?.code === "auth/no-auth-event") return;
      setAuthError(authErrorMessage(error));
      setAuthBusy(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setDecks([]);
      setDeckError("");
      return undefined;
    }

    return subscribeToUserDecks(
      user.uid,
      setDecks,
      () => setDeckError("Não foi possível sincronizar seus baralhos. Verifique as regras do Firestore."),
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadContent()
      .then(setContent)
      .catch((error) => console.error("MemoriaFlash content:", error));
  }, [user]);

  const allDeckCards = useMemo(() => flattenDeckCards(decks), [decks]);

  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((deck) =>
      `${deck.title} ${deck.category} ${deck.description}`.toLowerCase().includes(q),
    );
  }, [decks, query]);

  const card = studyCards.length ? studyCards[studyIndex % studyCards.length] : null;

  async function login() {
    if (!auth || !firebaseConfigured || authBusy) return;
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
    try {
      await signOut(auth);
      setTab("home");
      setSelectedDeck(null);
      setStudyCards([]);
    } catch (error) {
      setAuthError(authErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function openDeck(deck) {
    setSelectedDeck(deck);
    setStudyCards(deck.cards || []);
    setStudyIndex(0);
    setRevealed(false);
    setFeedback(null);
    setTab("study");
  }

  async function openOfficialCards(subject, topic, level) {
    setStudyLoading(true);
    try {
      const cards = await getCards({
        subject,
        topic,
        level,
        cardType: "definition",
      });
      setStudyCards(cards);
      setSelectedDeck(null);
      setStudyIndex(0);
      setRevealed(false);
      setFeedback(null);
      setTab("study");
    } finally {
      setStudyLoading(false);
    }
  }

  async function nextCard() {
    if (card) {
      await saveCardProgress(user.uid, card.id, {
        reviewed: true,
        deckId: card.deckId || selectedDeck?.id || null,
      });
    }
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
    const result = await saveCardFeedback({
      userId: user.uid,
      card,
      rating: "positive",
    });
    setFeedbackStatus(result.persisted ? "Feedback salvo." : "Não foi possível sincronizar agora.");
  }

  async function sendNegativeFeedback() {
    if (!card || !feedbackReason) return;
    setFeedbackStatus("Enviando...");
    const result = await saveCardFeedback({
      userId: user.uid,
      card,
      rating: "negative",
      reason: feedbackReason,
      comment: feedbackComment,
    });
    setFeedbackStatus(
      result.persisted
        ? "Obrigado. Seu feedback ajudará o conteúdo a melhorar."
        : "Não foi possível sincronizar agora.",
    );
    setFeedback("down-sent");
  }

  if (!authReady) {
    return <div className="loading-state"><span className="spinner" /> Verificando sua conta...</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={login} busy={authBusy} error={authError} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Brain size={22}/></div>
          <div><strong>MemoriaFlash</strong><span>{user.displayName || "Sua conta"}</span></div>
        </div>

        <nav>
          <button className={tab === "home" ? "nav-item active" : "nav-item"} onClick={() => setTab("home")}><Sparkles size={19}/> Início</button>
          <button className={tab === "library" ? "nav-item active" : "nav-item"} onClick={() => setTab("library")}><Library size={19}/> Meus baralhos</button>
          <button className={tab === "study" ? "nav-item active" : "nav-item"} onClick={() => setTab("study")}><BookOpen size={19}/> Estudar</button>
          <button className={tab === "stats" ? "nav-item active" : "nav-item"} onClick={() => setTab("stats")}><TrendingUp size={19}/> Progresso</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon"><BookOpen size={18}/></div>
            <div><strong>Conta sincronizada</strong><span>{user.email}</span></div>
          </div>
          <button className="nav-item" onClick={logout} disabled={authBusy}><LogOut size={19}/> {authBusy ? "Saindo..." : "Sair"}</button>
          {deckError && <small className="feedback-status">{deckError}</small>}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><Brain size={20}/> MemoriaFlash</div>
          <div className="top-search"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar baralho ou card..." /></div>
          <button className="profile">{user.displayName?.[0]?.toUpperCase() || "M"}</button>
        </header>

        {tab === "home" && (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow"><Sparkles size={15}/> Conta sincronizada</span>
                <h1>Continue seus estudos.</h1>
                <p>Os baralhos e cards do aplicativo mobile aparecem aqui automaticamente através do Firebase.</p>
                <button className="primary" onClick={() => setTab("library")}>Ver meus baralhos <ChevronRight size={18}/></button>
              </div>
              <div className="hero-orbit"><BookOpen size={92}/><span>{decks.length}</span><small>baralhos</small></div>
            </section>

            <section className="section-head"><div><h2>Seus baralhos</h2><p>{allDeckCards.length.toLocaleString("pt-BR")} cards sincronizados da sua conta.</p></div></section>
            <div className="subject-grid">
              {filteredDecks.slice(0, 8).map((deck) => (
                <article className="subject-card" key={deck.id}>
                  <div className="subject-icon violet"><BookOpen size={20}/></div>
                  <div className="subject-main"><h3>{deck.title}</h3><span>{deck.cards.length} cards · {deck.category}</span></div>
                  <div className="progress"><div style={{width: "0%"}}/></div>
                  <div className="subject-foot"><span>Sincronizado</span><button onClick={() => openDeck(deck)}>Estudar <ChevronRight size={15}/></button></div>
                </article>
              ))}
            </div>

            {!decks.length && (
              <div className="empty-state">
                <h3>Nenhum baralho sincronizado ainda</h3>
                <p>Crie ou gere um baralho no aplicativo mobile. Quando ele for salvo no Firebase, aparecerá automaticamente aqui.</p>
              </div>
            )}
          </div>
        )}

        {tab === "library" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><Library size={15}/> Biblioteca</span><h1>Meus baralhos</h1><p>Esta lista vem diretamente da coleção <code>decks</code> do Firebase.</p></div>
            <div className="library-list">
              {filteredDecks.map((deck) => (
                <article className="library-row" key={deck.id} onClick={() => openDeck(deck)}>
                  <div className="subject-icon violet"><BookOpen size={20}/></div>
                  <div className="row-main"><h3>{deck.title}</h3><span>{deck.cards.length} cards · {deck.category}</span></div>
                  <div className="topic-pills"><span>{deck.isPublic ? "Público" : "Meu baralho"}</span></div>
                  <button className="icon-button" onClick={(e) => { e.stopPropagation(); openDeck(deck); }}><ChevronRight size={18}/></button>
                </article>
              ))}
            </div>
            {!filteredDecks.length && <div className="empty-state"><h3>Nenhum baralho encontrado</h3><p>Os baralhos do aplicativo aparecerão aqui quando estiverem sincronizados.</p></div>}
          </div>
        )}

        {tab === "study" && (
          <div className="study-page">
            {studyLoading ? (
              <div className="loading-state"><span className="spinner"/> Buscando cards...</div>
            ) : !card ? (
              <div className="empty-state"><h3>Escolha um baralho para estudar</h3><p>Seus cards do aplicativo ficam disponíveis nesta sessão.</p><button className="secondary" onClick={() => setTab("library")}>Ver baralhos</button></div>
            ) : (
              <>
                <div className="study-head">
                  <div><span className="eyebrow"><BookOpen size={15}/> {card.deckTitle || selectedDeck?.title || "Meu baralho"}</span><h1>Sessão de estudo</h1></div>
                  <span className="counter">{(studyIndex % studyCards.length) + 1} / {studyCards.length}</span>
                </div>
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
                      {feedback === "down" && (
                        <div className="feedback-reasons"><span>O que precisa melhorar?</span><div className="reason-list">{REASONS.map((reason) => <button key={reason} className={feedbackReason === reason ? "reason selected" : "reason"} onClick={() => setFeedbackReason(reason)}>{reason}</button>)}</div><textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Comentário opcional..." rows={3}/><button className="primary small" disabled={!feedbackReason} onClick={sendNegativeFeedback}>Enviar feedback</button></div>
                      )}
                      {feedbackStatus && <small className="feedback-status">{feedbackStatus}</small>}
                    </div>
                  )}
                </article>
                {revealed && <div className="study-actions"><button onClick={nextCard} className="secondary">Próximo card <ChevronRight size={17}/></button></div>}
              </>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><TrendingUp size={15}/> Sincronização</span><h1>Seus dados</h1><p>Os dados de estudo são associados à sua conta Google/Firebase.</p></div>
            <div className="stats-grid">
              <div className="big-stat"><span>Baralhos</span><strong>{decks.length}</strong><em>sincronizados</em></div>
              <div className="big-stat"><span>Cards</span><strong>{allDeckCards.length}</strong><em>disponíveis</em></div>
              <div className="big-stat"><span>Conta</span><strong>Google</strong><em>{user.email}</em></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
