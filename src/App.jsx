import { useEffect, useMemo, useState } from "react";
import { BookOpen, Brain, ChevronRight, Check, Clock3, Flame, Home, Library, Search, Settings, Sparkles, ThumbsDown, ThumbsUp, TrendingUp, RotateCcw, X } from "lucide-react";

const SUBJECTS = [
  { name: "Português", cards: 4283, progress: 73, color: "violet", topics: ["Morfologia", "Sintaxe", "Interpretação de Texto"] },
  { name: "Direito Constitucional", cards: 2187, progress: 48, color: "blue", topics: ["Direitos Fundamentais", "Organização do Estado", "Controle de Constitucionalidade"] },
  { name: "Informática", cards: 3124, progress: 61, color: "cyan", topics: ["Redes", "Segurança da Informação", "Sistemas Operacionais"] },
  { name: "Criminalística", cards: 1482, progress: 34, color: "orange", topics: ["Local de Crime", "Vestígios", "Cadeia de Custódia"] }
];

const CARDS = [
  { id: "pt-001", subject: "Português", topic: "Morfologia", difficulty: "medium", front: "Qual é a função principal de um substantivo na língua portuguesa?", back: "Nomear seres, objetos, lugares, sentimentos, ações ou conceitos.", explanation: "O substantivo funciona como núcleo de grupos nominais e pode designar entidades concretas ou abstratas.", curiosity: "Substantivos abstratos podem nomear sentimentos e qualidades, como alegria, coragem e beleza." },
  { id: "pt-002", subject: "Português", topic: "Sintaxe", difficulty: "hard", front: "Na frase “Os alunos estudaram para a prova”, qual é o sujeito?", back: "“Os alunos”.", explanation: "O sujeito é o termo sobre o qual se declara algo. O verbo “estudaram” concorda com “Os alunos”.", curiosity: "A concordância verbal é uma pista importante para identificar o sujeito." },
  { id: "dc-001", subject: "Direito Constitucional", topic: "Direitos Fundamentais", difficulty: "medium", front: "Qual princípio determina que ninguém será obrigado a fazer ou deixar de fazer algo senão em virtude de lei?", back: "O princípio da legalidade.", explanation: "A legalidade estabelece que obrigações impostas aos particulares precisam encontrar fundamento legal.", curiosity: "A Constituição brasileira prevê a legalidade no artigo 5º, inciso II." }
];

const FEEDBACK_REASONS = ["Pergunta confusa", "Resposta incorreta", "Explicação ruim", "Muito fácil", "Muito difícil", "Conteúdo repetido", "Desatualizado"];

export default function App() {
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState(CARDS);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [reason, setReason] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studied, setStudied] = useState(() => Number(localStorage.getItem("flashmind-studied") || 1284));
  const [streak, setStreak] = useState(() => Number(localStorage.getItem("flashmind-streak") || 7));

  const current = cards[index % cards.length];
  const filtered = useMemo(() => SUBJECTS.filter(s => `${s.name} ${s.topics.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    const onKey = e => {
      if (tab !== "study") return;
      if (e.code === "Space") { e.preventDefault(); setRevealed(true); }
      if (e.key === "1" && revealed) rate("up");
      if (e.key === "2" && revealed) rate("down");
      if (e.key === "Enter" && revealed && !reason) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openStudy(subject, topic) {
    const list = CARDS.filter(c => (!subject || c.subject === subject) && (!topic || c.topic === topic));
    setCards(list.length ? list : CARDS);
    setIndex(0); setRevealed(false); setFeedback(null); setReason(""); setTab("study");
  }
  function next() {
    setStudied(v => { const n = v + 1; localStorage.setItem("flashmind-studied", String(n)); return n; });
    setIndex(v => (v + 1) % cards.length); setRevealed(false); setFeedback(null); setReason("");
  }
  function rate(value) { setFeedback(value); if (value === "up") setReason(""); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Brain size={22}/></div><div><strong>FlashMind</strong><span>Study Web</span></div></div>
      <nav>
        <Nav active={tab === "home"} icon={<Home size={19}/>} onClick={() => setTab("home")}>Início</Nav>
        <Nav active={tab === "library"} icon={<Library size={19}/>} onClick={() => setTab("library")}>Meus cards</Nav>
        <Nav active={tab === "study"} icon={<BookOpen size={19}/>} onClick={() => openStudy()}>Estudar</Nav>
        <Nav active={tab === "stats"} icon={<TrendingUp size={19}/>} onClick={() => setTab("stats")}>Progresso</Nav>
      </nav>
      <div className="sidebar-bottom">
        <div className="streak-card"><div className="streak-icon"><Flame size={18}/></div><div><strong>{streak} dias</strong><span>sequência atual</span></div></div>
        <Nav icon={<Settings size={19}/>} onClick={() => setSettingsOpen(true)}>Configurações</Nav>
        <div className="user-mini"><div className="avatar">H</div><div><strong>Henrique</strong><span>Conta gratuita</span></div></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="mobile-brand"><Brain size={20}/> FlashMind</div><div className="top-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar matéria, tópico ou card..." /></div><button className="profile">H</button></header>

      {tab === "home" && <HomePage studied={studied} streak={streak} subjects={filtered} onStudy={openStudy} onLibrary={() => setTab("library")} onStats={() => setTab("stats")} />}
      {tab === "library" && <LibraryPage subjects={filtered} onStudy={openStudy} selected={selectedSubject} setSelected={setSelectedSubject} />}
      {tab === "study" && <StudyPage card={current} index={index} total={cards.length} revealed={revealed} setRevealed={setRevealed} feedback={feedback} reason={reason} setReason={setReason} rate={rate} next={next} />}
      {tab === "stats" && <StatsPage studied={studied} />}
    </main>

    <div className="mobile-nav"><MobileNav active={tab === "home"} icon={<Home size={19}/>} label="Início" onClick={() => setTab("home")} /><MobileNav active={tab === "library"} icon={<Library size={19}/>} label="Cards" onClick={() => setTab("library")} /><MobileNav active={tab === "study"} icon={<BookOpen size={19}/>} label="Estudar" onClick={() => openStudy()} /><MobileNav active={tab === "stats"} icon={<TrendingUp size={19}/>} label="Progresso" onClick={() => setTab("stats")} /></div>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSettingsOpen(false)}><X size={18}/></button><h2>Configurações</h2><p>Preferências do seu ambiente de estudos.</p><div className="modal-topics"><button>Meta diária <span>18 min</span></button><button>Cards por sessão <span>20</span></button><button>Modo de estudo <span>Revisão inteligente</span></button></div></div></div>}
  </div>;
}

function Nav({ active, icon, onClick, children }) { return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}>{icon}{children}</button>; }
function MobileNav({ active, icon, label, onClick }) { return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>; }

function HomePage({ studied, streak, subjects, onStudy, onLibrary, onStats }) {
  return <div className="page">
    <section className="hero"><div><span className="eyebrow"><Sparkles size={15}/> Seu centro de estudos</span><h1>Continue de onde você parou.</h1><p>Revise seus cards, descubra novos conteúdos e mantenha sua memória em dia.</p><button className="primary" onClick={() => onStudy()}>Começar estudo <ChevronRight size={18}/></button></div><div className="hero-orbit"><Brain size={92}/><span>{streak}</span><small>dias</small></div></section>
    <section className="section-head"><div><h2>Estudar hoje</h2><p>Uma sessão rápida para manter sua sequência.</p></div><button className="link-button" onClick={onStats}>Ver progresso <ChevronRight size={16}/></button></section>
    <div className="today-grid"><Metric icon={<BookOpen size={19}/>} tone="purple" value="31" label="cards novos"/><Metric icon={<RotateCcw size={19}/>} tone="orange" value="23" label="para revisar"/><Metric icon={<Check size={19}/>} tone="green" value="84%" label="retenção média"/><Metric icon={<Clock3 size={19}/>} tone="blue" value="18 min" label="meta diária"/></div>
    <section className="section-head"><div><h2>Suas matérias</h2><p>{studied.toLocaleString("pt-BR")} cards já estudados.</p></div><button className="link-button" onClick={onLibrary}>Ver todas <ChevronRight size={16}/></button></section>
    <div className="subject-grid">{subjects.map(s => <SubjectCard key={s.name} subject={s} onStudy={onStudy}/>)}</div>
  </div>;
}
function Metric({ icon, tone, value, label }) { return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><strong>{value}</strong><span>{label}</span></div>; }
function SubjectCard({ subject, onStudy }) { return <article className="subject-card"><div className={`subject-icon ${subject.color}`}><BookOpen size={20}/></div><div className="subject-main"><h3>{subject.name}</h3><span>{subject.cards.toLocaleString("pt-BR")} cards</span></div><div className="progress"><div style={{ width: `${subject.progress}%` }}/></div><div className="subject-foot"><span>{subject.progress}% concluído</span><button onClick={() => onStudy(subject.name)}>Estudar <ChevronRight size={15}/></button></div></article>; }

function LibraryPage({ subjects, onStudy, selected, setSelected }) { return <div className="page"><div className="page-title"><span className="eyebrow"><Library size={15}/> Biblioteca</span><h1>Meus cards</h1><p>Escolha uma matéria e aprofunde por tópico.</p></div><div className="filter-row"><button className="filter active">Todos</button><button className="filter">Mais recentes</button><button className="filter">Para revisar</button></div><div className="library-list">{subjects.map(s => <article className="library-row" key={s.name} onClick={() => setSelected(s)}><div className={`subject-icon ${s.color}`}><BookOpen size={20}/></div><div className="row-main"><h3>{s.name}</h3><span>{s.cards.toLocaleString("pt-BR")} cards disponíveis</span></div><div className="topic-pills">{s.topics.map(t => <span key={t}>{t}</span>)}</div><button className="icon-button" onClick={e => {e.stopPropagation(); onStudy(s.name)}}><ChevronRight size={18}/></button></article>)}</div>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}><X size={18}/></button><div className={`subject-icon ${selected.color}`}><BookOpen size={20}/></div><h2>{selected.name}</h2><p>Selecione um tópico para estudar.</p><div className="modal-topics">{selected.topics.map(t => <button key={t} onClick={() => {setSelected(null); onStudy(selected.name, t)}}>{t}<ChevronRight size={16}/></button>)}</div></div></div>}</div>; }

function StudyPage({ card, index, total, revealed, setRevealed, feedback, reason, setReason, rate, next }) { return <div className="study-page"><div className="study-head"><div><span className="eyebrow"><BookOpen size={15}/> {card.subject} · {card.topic}</span><h1>Sessão de estudo</h1></div><span className="counter">{(index % total) + 1} / {total}</span></div><div className="study-progress"><div style={{ width: `${((index + 1) / total) * 100}%` }}/></div><article className="flashcard"><div className="card-face">{!revealed ? <><span className="card-label">PERGUNTA</span><h2>{card.front}</h2><button className="primary" onClick={() => setRevealed(true)}>Mostrar resposta <ChevronRight size={17}/></button><p className="keyboard-hint">Espaço para revelar</p></> : <><span className="card-label">RESPOSTA</span><h2 className="answer">{card.back}</h2><div className="explanation"><strong>📘 Explicação</strong><p>{card.explanation}</p><strong>💡 Curiosidade</strong><p>{card.curiosity}</p></div><div className="feedback-bar"><span>Como foi este card?</span><button className={feedback === "up" ? "feedback selected-up" : "feedback"} onClick={() => rate("up")}><ThumbsUp size={16}/> Gostei</button><button className={feedback === "down" ? "feedback selected-down" : "feedback"} onClick={() => rate("down")}><ThumbsDown size={16}/> Precisa melhorar</button></div>{feedback === "down" && <div className="feedback-reasons"><span>O que precisa melhorar?</span>{FEEDBACK_REASONS.map(r => <button key={r} className={reason === r ? "reason selected" : "reason"} onClick={() => setReason(r)}>{r}</button>)}<button className="primary small" disabled={!reason} onClick={next}>Enviar e continuar</button></div>}{feedback !== "down" && <div className="study-actions"><button onClick={next} className="secondary">Próximo card <ChevronRight size={17}/></button></div>}</>}</div></article></div>; }

function StatsPage({ studied }) { return <div className="page"><div className="page-title"><span className="eyebrow"><TrendingUp size={15}/> Desempenho</span><h1>Seu progresso</h1><p>Veja sua consistência e evolução.</p></div><div className="stats-grid"><div className="big-stat"><span>Cards estudados</span><strong>{studied.toLocaleString("pt-BR")}</strong><em>+18% esta semana</em></div><div className="big-stat"><span>Retenção</span><strong>84%</strong><em>+4,2% esta semana</em></div><div className="big-stat"><span>Sequência</span><strong>7 dias</strong><em>melhor: 21 dias</em></div></div><div className="chart-card"><div className="chart-head"><h2>Atividade semanal</h2><p>Cards revisados por dia</p></div><div className="bars">{[42,58,36,74,63,91,48].map((v,i) => <div className="bar-col" key={i}><div className="bar" style={{height: `${v}%`}}/><span>{["S","T","Q","Q","S","S","D"][i]}</span></div>)}</div></div></div>; }
