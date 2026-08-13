import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, ChevronRight, Clock3, Flame, Home, Library,
  Search, Settings, Sparkles, ThumbsDown, ThumbsUp, TrendingUp,
  LogIn, LogOut, Check, RotateCcw
} from "lucide-react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, firebaseConfigured } from "./lib/firebase";
import { loadContent } from "./services/content";
import { saveCardFeedback } from "./services/feedback";
import { saveCardProgress } from "./services/progress";
import "./styles.css";

const REASONS = ["Pergunta confusa","Resposta incorreta","Explicação ruim","Muito fácil","Muito difícil","Conteúdo repetido","Desatualizado"];

function App() {
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [content, setContent] = useState({ subjects: [], cards: [], source: "loading" });
  const [loading, setLoading] = useState(true);
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    loadContent().then((data) => {
      setContent(data);
      setStudyCards(data.cards);
      setLoading(false);
    });
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

  function startStudy(subject = null, topic = null) {
    const filtered = content.cards.filter((c) =>
      (!subject || c.subject === subject) &&
      (!topic || c.topic === topic)
    );
    const cards = filtered.length ? filtered : content.cards;
    setStudyCards(cards);
    setStudyIndex(0);
    setRevealed(false);
    setFeedback(null);
    setFeedbackReason("");
    setFeedbackComment("");
    setFeedbackStatus("");
    setTab("study");
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
      setFeedbackStatus(result.persisted ? "Feedback salvo." : "Feedback registrado nesta sessão.");
    } catch {
      setFeedbackStatus("Não foi possível salvar agora.");
    }
  }

  async function sendNegativeFeedback() {
    if (!card || !feedbackReason) return;
    setFeedbackStatus("Enviando...");
    try {
      const result = await saveCardFeedback({
        userId: user?.uid,
        card,
        rating: "negative",
        reason: feedbackReason,
        comment: feedbackComment,
      });
      setFeedbackStatus(result.persisted ? "Obrigado. Esse feedback ajudará o agente a melhorar o conteúdo." : "Feedback registrado nesta sessão.");
      setFeedback("down-sent");
    } catch {
      setFeedbackStatus("Não foi possível salvar agora.");
    }
  }

  async function login() {
    if (!auth) return;
    await signInWithPopup(auth, new (await import("firebase/auth")).GoogleAuthProvider());
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
            <button className="nav-item" onClick={() => signOut(auth)}><LogOut size={19}/> Sair</button>
          ) : (
            <button className="nav-item" onClick={login} disabled={!firebaseConfigured}><LogIn size={19}/> Entrar com Google</button>
          )}
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
                <button className="primary" onClick={() => startStudy()}>Começar estudo <ChevronRight size={18}/></button>
              </div>
              <div className="hero-orbit"><Brain size={92}/><span>{content.cards.length}</span><small>cards</small></div>
            </section>

            <section className="section-head"><div><h2>Conteúdo disponível</h2><p>{content.source === "firebase" ? "Dados carregados do Firebase." : "Modo de demonstração até o Firebase ser configurado."}</p></div></section>
            <div className="subject-grid">
              {filteredSubjects.map((subject) => (
                <article className="subject-card" key={subject.id}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="subject-main"><h3>{subject.name}</h3><span>{Number(subject.cards).toLocaleString("pt-BR")} cards</span></div>
                  <div className="progress"><div style={{width: `${subject.progress || 0}%`}}/></div>
                  <div className="subject-foot"><span>{subject.topics.length} tópicos</span><button onClick={() => startStudy(subject.name)}>Estudar <ChevronRight size={15}/></button></div>
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
                  <div className="row-main"><h3>{subject.name}</h3><span>{Number(subject.cards).toLocaleString("pt-BR")} cards</span></div>
                  <div className="topic-pills">{subject.topics.slice(0, 4).map((topic) => <button key={topic} onClick={() => startStudy(subject.name, topic)}>{topic}</button>)}</div>
                  <button className="icon-button" onClick={() => startStudy(subject.name)}><ChevronRight size={18}/></button>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "study" && (
          <div className="study-page">
            {!card ? <div className="empty-state"><h3>Nenhum card disponível</h3><p>Quando o agente alimentar o Firebase, os cards aparecerão aqui.</p></div> : (
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
                      <div className="feedback-bar">
                        <span>Como foi este card?</span>
                        <button className={feedback === "up" ? "feedback selected-up" : "feedback"} onClick={() => sendFeedback("up")}><ThumbsUp size={16}/> Gostei</button>
                        <button className={feedback === "down" || feedback === "down-sent" ? "feedback selected-down" : "feedback"} onClick={() => sendFeedback("down")}><ThumbsDown size={16}/> Precisa melhorar</button>
                      </div>
                      {feedback === "down" && (
                        <div className="feedback-reasons">
                          <span>O que precisa melhorar?</span>
                          <div className="reason-list">{REASONS.map((reason) => <button key={reason} className={feedbackReason === reason ? "reason selected" : "reason"} onClick={() => setFeedbackReason(reason)}>{reason}</button>)}</div>
                          <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Comentário opcional..." rows={3}/>
                          <button className="primary small" disabled={!feedbackReason} onClick={sendNegativeFeedback}>Enviar feedback</button>
                        </div>
                      )}
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
            <div className="stats-grid">
              <div className="big-stat"><span>Cards na sessão</span><strong>{studyCards.length}</strong><em>disponíveis agora</em></div>
              <div className="big-stat"><span>Fonte</span><strong>{content.source === "firebase" ? "Firebase" : "Demo"}</strong><em>camada de dados</em></div>
              <div className="big-stat"><span>Conta</span><strong>{user ? "Conectada" : "Visitante"}</strong><em>{user?.email || "Entre para salvar progresso"}</em></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
