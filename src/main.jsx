import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, ChevronRight, Clock3, Flame, Home, Library,
  Search, Settings, Sparkles, ThumbsDown, ThumbsUp, TrendingUp,
  X, Check, RotateCcw
} from "lucide-react";
import "./styles.css";

const subjects = [
  { name: "Português", cards: 4283, progress: 73, color: "violet", topics: ["Morfologia", "Sintaxe", "Interpretação de Texto"] },
  { name: "Direito Constitucional", cards: 2187, progress: 48, color: "blue", topics: ["Direitos Fundamentais", "Organização do Estado", "Controle de Constitucionalidade"] },
  { name: "Informática", cards: 3124, progress: 61, color: "cyan", topics: ["Redes", "Segurança da Informação", "Sistemas Operacionais"] },
  { name: "Criminalística", cards: 1482, progress: 34, color: "orange", topics: ["Local de Crime", "Vestígios", "Cadeia de Custódia"] }
];

const demoCards = [
  {
    id: "pt-001",
    subject: "Português",
    topic: "Morfologia",
    difficulty: "medium",
    type: "definition",
    front: "Qual é a função principal de um substantivo na língua portuguesa?",
    back: "Nomear seres, objetos, lugares, sentimentos, ações ou conceitos.",
    explanation: "O substantivo funciona como núcleo de grupos nominais e pode designar entidades concretas ou abstratas. Ele pode ser classificado, por exemplo, como comum ou próprio, concreto ou abstrato.",
    curiosity: "Substantivos abstratos podem nomear sentimentos e qualidades, como alegria, coragem e beleza."
  },
  {
    id: "pt-002",
    subject: "Português",
    topic: "Sintaxe",
    difficulty: "hard",
    type: "applied",
    front: "Na frase “Os alunos estudaram para a prova”, qual é o sujeito?",
    back: "“Os alunos”.",
    explanation: "O sujeito é o termo sobre o qual se declara algo. O verbo “estudaram” concorda com “Os alunos” em número e pessoa.",
    curiosity: "A identificação do sujeito pode ser feita, entre outras formas, observando a concordância verbal."
  },
  {
    id: "dc-001",
    subject: "Direito Constitucional",
    topic: "Direitos Fundamentais",
    difficulty: "medium",
    type: "quiz",
    front: "Qual princípio garante que ninguém será obrigado a fazer ou deixar de fazer algo senão em virtude de lei?",
    back: "O princípio da legalidade.",
    explanation: "A legalidade estabelece que obrigações impostas aos particulares precisam encontrar fundamento legal. No estudo para concursos, é importante diferenciar legalidade de reserva legal.",
    curiosity: "A Constituição brasileira prevê a legalidade no artigo 5º, inciso II."
  }
];

function App() {
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [studyCards, setStudyCards] = useState(demoCards);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const card = studyCards[studyIndex % studyCards.length];

  function startStudy(subject) {
    const filtered = demoCards.filter(c => !subject || c.subject === subject);
    setStudyCards(filtered.length ? filtered : demoCards);
    setStudyIndex(0);
    setRevealed(false);
    setFeedback(null);
    setTab("study");
  }

  function nextCard() {
    setStudyIndex(i => (i + 1) % studyCards.length);
    setRevealed(false);
    setFeedback(null);
    setShowFeedback(false);
    setFeedbackReason("");
  }

  function sendFeedback(type) {
    if (type === "up") {
      setFeedback("up");
      setShowFeedback(false);
      return;
    }
    setFeedback("down");
    setShowFeedback(true);
  }

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.topics.some(t => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Brain size={22}/></div>
          <div><strong>FlashMind</strong><span>Study Web</span></div>
        </div>

        <nav>
          <button className={tab === "home" ? "nav-item active" : "nav-item"} onClick={() => setTab("home")}><Home size={19}/> Início</button>
          <button className={tab === "library" ? "nav-item active" : "nav-item"} onClick={() => setTab("library")}><Library size={19}/> Meus cards</button>
          <button className={tab === "study" ? "nav-item active" : "nav-item"} onClick={() => startStudy(null)}><BookOpen size={19}/> Estudar</button>
          <button className={tab === "stats" ? "nav-item active" : "nav-item"} onClick={() => setTab("stats")}><TrendingUp size={19}/> Progresso</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon"><Flame size={18}/></div>
            <div><strong>7 dias</strong><span>sequência atual</span></div>
          </div>
          <button className="nav-item"><Settings size={19}/> Configurações</button>
          <div className="user-mini"><div className="avatar">H</div><div><strong>Henrique</strong><span>Conta gratuita</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><Brain size={20}/> FlashMind</div>
          <div className="top-search">
            <Search size={18}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar matéria, tópico ou card..." />
          </div>
          <button className="profile">H</button>
        </header>

        {tab === "home" && (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow"><Sparkles size={15}/> Seu centro de estudos</span>
                <h1>Continue de onde você parou.</h1>
                <p>Revise seus cards, descubra novos conteúdos e mantenha sua memória em dia.</p>
                <button className="primary" onClick={() => startStudy(null)}>Começar estudo <ChevronRight size={18}/></button>
              </div>
              <div className="hero-orbit"><Brain size={92}/><span>7</span><small>dias</small></div>
            </section>

            <section className="section-head"><div><h2>Estudar hoje</h2><p>Uma sessão rápida para manter sua sequência.</p></div><button className="link-button" onClick={() => setTab("stats")}>Ver progresso <ChevronRight size={16}/></button></section>
            <div className="today-grid">
              <div className="metric-card"><span className="metric-icon purple"><BookOpen size={19}/></span><strong>31</strong><span>cards novos</span></div>
              <div className="metric-card"><span className="metric-icon orange"><RotateCcw size={19}/></span><strong>23</strong><span>para revisar</span></div>
              <div className="metric-card"><span className="metric-icon green"><Check size={19}/></span><strong>84%</strong><span>retenção média</span></div>
              <div className="metric-card"><span className="metric-icon blue"><Clock3 size={19}/></span><strong>18 min</strong><span>meta diária</span></div>
            </div>

            <section className="section-head"><div><h2>Suas matérias</h2><p>Escolha um conteúdo para estudar.</p></div><button className="link-button" onClick={() => setTab("library")}>Ver todas <ChevronRight size={16}/></button></section>
            <div className="subject-grid">
              {filteredSubjects.map(subject => (
                <article className="subject-card" key={subject.name}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="subject-main"><h3>{subject.name}</h3><span>{subject.cards.toLocaleString("pt-BR")} cards</span></div>
                  <div className="progress"><div style={{width: subject.progress + "%"}}/></div>
                  <div className="subject-foot"><span>{subject.progress}% concluído</span><button onClick={() => startStudy(subject.name)}>Estudar <ChevronRight size={15}/></button></div>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><Library size={15}/> Biblioteca</span><h1>Meus cards</h1><p>Selecione uma matéria ou tópico para montar sua sessão.</p></div>
            <div className="filter-row"><button className="filter active">Todos</button><button className="filter">Português</button><button className="filter">Direito</button><button className="filter">Informática</button></div>
            <div className="library-list">
              {filteredSubjects.map(subject => (
                <article className="library-row" key={subject.name} onClick={() => setSelectedSubject(subject)}>
                  <div className={"subject-icon " + subject.color}><BookOpen size={20}/></div>
                  <div className="row-main"><h3>{subject.name}</h3><span>{subject.cards.toLocaleString("pt-BR")} cards disponíveis</span></div>
                  <div className="topic-pills">{subject.topics.map(t => <span key={t}>{t}</span>)}</div>
                  <button className="icon-button" onClick={(e) => {e.stopPropagation(); startStudy(subject.name)}}><ChevronRight size={18}/></button>
                </article>
              ))}
            </div>
            {selectedSubject && (
              <div className="modal-backdrop" onClick={() => setSelectedSubject(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setSelectedSubject(null)}><X size={18}/></button>
                  <div className={"subject-icon " + selectedSubject.color}><BookOpen size={20}/></div>
                  <h2>{selectedSubject.name}</h2><p>Escolha um tópico para estudar.</p>
                  <div className="modal-topics">{selectedSubject.topics.map(t => <button key={t} onClick={() => {setSelectedSubject(null); startStudy(selectedSubject.name)}}>{t}<ChevronRight size={16}/></button>)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "study" && (
          <div className="study-page">
            <div className="study-head"><div><span className="eyebrow"><BookOpen size={15}/> {card.subject} · {card.topic}</span><h1>Sessão de estudo</h1></div><span className="counter">{(studyIndex % studyCards.length) + 1} / {studyCards.length}</span></div>
            <div className="study-progress"><div style={{width: (((studyIndex % studyCards.length)+1) / studyCards.length) * 100 + "%"}}/></div>
            <article className={"flashcard " + (revealed ? "revealed" : "")}>
              {!revealed ? (
                <div className="card-face">
                  <span className="card-label">PERGUNTA</span>
                  <h2>{card.front}</h2>
                  <button className="primary" onClick={() => setRevealed(true)}>Mostrar resposta</button>
                </div>
              ) : (
                <div className="card-face">
                  <span className="card-label">RESPOSTA</span>
                  <h2 className="answer">{card.back}</h2>
                  <div className="explanation"><strong>📘 Explicação</strong><p>{card.explanation}</p><strong>💡 Curiosidade</strong><p>{card.curiosity}</p></div>
                  <div className="feedback-bar">
                    <span>Como foi este card?</span>
                    <button className={feedback === "up" ? "feedback selected-up" : "feedback"} onClick={() => sendFeedback("up")}><ThumbsUp size={16}/> Gostei</button>
                    <button className={feedback === "down" ? "feedback selected-down" : "feedback"} onClick={() => sendFeedback("down")}><ThumbsDown size={16}/> Precisa melhorar</button>
                  </div>
                  {showFeedback && (
                    <div className="feedback-reasons">
                      <span>O que precisa melhorar?</span>
                      {["Pergunta confusa","Resposta incorreta","Explicação ruim","Muito fácil","Muito difícil","Conteúdo repetido","Desatualizado"].map(reason => (
                        <button key={reason} className={feedbackReason === reason ? "reason selected" : "reason"} onClick={() => setFeedbackReason(reason)}>{reason}</button>
                      ))}
                      <button className="primary small" onClick={() => {setShowFeedback(false);}}>Enviar feedback</button>
                    </div>
                  )}
                </div>
              )}
            </article>
            {revealed && !showFeedback && <div className="study-actions"><button onClick={nextCard} className="secondary">Próximo card <ChevronRight size={17}/></button></div>}
          </div>
        )}

        {tab === "stats" && (
          <div className="page">
            <div className="page-title"><span className="eyebrow"><TrendingUp size={15}/> Desempenho</span><h1>Seu progresso</h1><p>Acompanhe sua evolução de forma simples.</p></div>
            <div className="stats-grid">
              <div className="big-stat"><span>Cards estudados</span><strong>1.284</strong><em>+18% esta semana</em></div>
              <div className="big-stat"><span>Retenção</span><strong>84%</strong><em>+4,2% esta semana</em></div>
              <div className="big-stat"><span>Sequência</span><strong>7 dias</strong><em>melhor: 21 dias</em></div>
            </div>
            <div className="chart-card"><div className="chart-head"><div><h2>Atividade semanal</h2><p>Cards revisados por dia</p></div></div><div className="bars">{[42,58,36,74,63,91,48].map((v,i)=><div className="bar-col" key={i}><div className="bar" style={{height:v+"%"}}/><span>{["S","T","Q","Q","S","S","D"][i]}</span></div>)}</div></div>
          </div>
        )}
      </main>

      <div className="mobile-nav">
        <button className={tab==="home"?"active":""} onClick={() => setTab("home")}><Home size={19}/><span>Início</span></button>
        <button className={tab==="library"?"active":""} onClick={() => setTab("library")}><Library size={19}/><span>Cards</span></button>
        <button className={tab==="study"?"active":""} onClick={() => startStudy(null)}><BookOpen size={19}/><span>Estudar</span></button>
        <button className={tab==="stats"?"active":""} onClick={() => setTab("stats")}><TrendingUp size={19}/><span>Progresso</span></button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
