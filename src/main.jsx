import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, ChevronRight, Crown, Clock3, Library, LogIn,
  LogOut, RotateCcw, Search, Sparkles, ThumbsDown, ThumbsUp,
  TrendingUp, WandSparkles,
} from "lucide-react";
import {
  GoogleAuthProvider, getIdToken, getRedirectResult, onAuthStateChanged,
  signInWithPopup, signInWithRedirect, signOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, authPersistenceReady, db, firebaseConfigured } from "./lib/firebase";
import { createUserDeck, flattenDeckCards, subscribeToUserDecks } from "./services/decks";
import { saveCardFeedback } from "./services/feedback";
import { saveCardProgress } from "./services/progress";
import "./styles.css";

const REASONS = [
  "Pergunta confusa", "Resposta incorreta", "Explicação ruim",
  "Muito fácil", "Muito difícil", "Conteúdo repetido", "Desatualizado",
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
  return <main className="login-screen"><div className="login-card">
    <div className="brand login-brand"><div className="brand-mark"><Brain size={25}/></div><div><strong>MemoriaFlash</strong><span>Estude melhor</span></div></div>
    <div className="login-icon"><BookOpen size={34}/></div>
    <h1>Seus estudos em qualquer lugar.</h1>
    <p>Entre com sua conta Google para acessar os mesmos baralhos e cards do aplicativo mobile.</p>
    <button className="primary login-button" onClick={onLogin} disabled={busy || !firebaseConfigured}>
      <LogIn size={18}/> {busy ? "Entrando..." : "Entrar com Google"}
    </button>
    {!firebaseConfigured && <small>Firebase não está configurado neste ambiente.</small>}
    {error && <div className="auth-error">{error}</div>}
    <div className="login-benefits"><span>✓ Baralhos sincronizados</span><span>✓ Cards do aplicativo</span><span>✓ Progresso sincronizado</span></div>
  </div></main>;
}

function AdSlot({ isPro, slot = "" }) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT;
  useEffect(() => {
    if (isPro || !client || !slot) return;
    const id = "memoriaflash-adsense";
    if (!document.getElementById(id)) {
      const script = document.createElement("script");
      script.id = id; script.async = true; script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      document.head.appendChild(script);
    }
  }, [isPro, client, slot]);
  if (isPro || !client || !slot) return null;
  return <div className="ad-slot" aria-label="Publicidade">
    <ins className="adsbygoogle" style={{display:"block"}} data-ad-client={client}
      data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
  </div>;
}

function calculateSrs(card, grade) {
  const now = new Date();
  const reps = Number(card.reps || 0) + 1;
  const efactor = Number(card.efactor || 2.5);
  let interval;
  let nextEf = efactor;
  if (grade === "hard") {
    interval = reps <= 1 ? 1 : Math.max(1, Math.round(Number(card.interval || 1) * 1.2));
    nextEf = Math.max(1.3, efactor - 0.15);
  } else if (grade === "easy") {
    interval = reps === 1 ? 1 : reps === 2 ? 4 : Math.max(1, Math.round(Number(card.interval || 1) * efactor * 1.3));
    nextEf = Math.min(3, efactor + 0.15);
  } else {
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(1, Math.round(Number(card.interval || 1) * efactor));
  }
  return {
    reps, interval, efactor: nextEf,
    dueDate: new Date(now.getTime() + interval * 86400000).toISOString(),
    lastReviewed: now.toISOString(),
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState([]);
  const [deckError, setDeckError] = useState("");
  const [subscription, setSubscription] = useState({isPro:false,proPlanType:null,expiryDate:null});
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [studyLoading, setStudyLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [generateForm, setGenerateForm] = useState({subject:"",topic:"",count:10,difficulty:"medium",level:"medio"});
  const [generated, setGenerated] = useState([]);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    if (!auth) { setAuthReady(true); return undefined; }
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      if (!active) return; setUser(nextUser); setAuthReady(true); setAuthBusy(false);
    });
    getRedirectResult(auth).catch(error => {
      if (!active || error?.code === "auth/no-auth-event") return;
      setAuthError(authErrorMessage(error)); setAuthBusy(false);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) { setDecks([]); setDeckError(""); return undefined; }
    return subscribeToUserDecks(user.uid, setDecks,
      () => setDeckError("Não foi possível sincronizar seus baralhos. Verifique as regras do Firestore."));
  }, [user]);

  useEffect(() => {
    if (!db || !user) {
      setSubscription({isPro:false,proPlanType:null,expiryDate:null}); return undefined;
    }
    return onSnapshot(doc(db,"userStats",user.uid), snap => {
      const data = snap.exists() ? snap.data() : {};
      const expiryDate = data.proExpiryDate || data.proExpiryDateIso || null;
      const expiryMs = expiryDate ? new Date(expiryDate).getTime() : NaN;
      const expired = Number.isFinite(expiryMs) && expiryMs <= Date.now();
      setSubscription({isPro:Boolean(data.isPro) && !expired,proPlanType:data.proPlanType || null,expiryDate});
    }, () => setSubscription({isPro:false,proPlanType:null,expiryDate:null}));
  }, [user]);

  const allDeckCards = useMemo(() => flattenDeckCards(decks), [decks]);
  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(deck => `${deck.title} ${deck.category} ${deck.description}`.toLowerCase().includes(q));
  }, [decks, query]);
  const card = studyCards.length ? studyCards[studyIndex % studyCards.length] : null;
  const dueCards = allDeckCards.filter(item => item.dueDate && new Date(item.dueDate) <= new Date());

  async function login() {
    if (!auth || !firebaseConfigured || authBusy) return;
    setAuthBusy(true); setAuthError("");
    try {
      await authPersistenceReady;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({prompt:"select_account"});
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = error?.code || "";
      if (code.includes("popup-blocked") || code.includes("popup-failed") || code.includes("operation-not-supported-in-this-environment")) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({prompt:"select_account"});
          await signInWithRedirect(auth, provider); return;
        } catch (redirectError) { setAuthError(authErrorMessage(redirectError)); }
      } else setAuthError(authErrorMessage(error));
      setAuthBusy(false);
    }
  }

  async function logout() {
    if (!auth || authBusy) return;
    setAuthBusy(true);
    try { await signOut(auth); setTab("home"); setSelectedDeck(null); setStudyCards([]); }
    catch (error) { setAuthError(authErrorMessage(error)); }
    finally { setAuthBusy(false); }
  }

  function openDeck(deck) {
    setSelectedDeck(deck); setStudyCards(deck.cards || []); setStudyIndex(0);
    setRevealed(false); setFeedback(null); setFeedbackReason(""); setFeedbackComment(""); setFeedbackStatus(""); setTab("study");
  }

  async function gradeCard(grade) {
    if (!card) return;
    setStudyLoading(true);
    try {
      const srs = calculateSrs(card, grade);
      const updatedCard = {...card, ...srs};
      await saveCardProgress(user.uid, card.id, {
        reviewed:true, grade, deckId:card.deckId || selectedDeck?.id || null, ...srs,
      });
      setStudyCards(current => current.map((item,index) => index === studyIndex % current.length ? updatedCard : item));
      setStudyIndex(index => index + 1); setRevealed(false); setFeedback(null);
      setFeedbackReason(""); setFeedbackComment(""); setFeedbackStatus("");
    } catch (error) {
      setFeedbackStatus(error?.message || "Não foi possível salvar seu progresso.");
    } finally { setStudyLoading(false); }
  }

  async function sendFeedback(rating) {
    if (!card) return;
    setFeedback(rating);
    if (rating === "down") return;
    setFeedbackStatus("Enviando...");
    const result = await saveCardFeedback({userId:user.uid,card,rating:"positive"});
    setFeedbackStatus(result.persisted ? "Feedback salvo." : "Não foi possível sincronizar agora.");
  }

  async function sendNegativeFeedback() {
    if (!card || !feedbackReason) return;
    setFeedbackStatus("Enviando...");
    const result = await saveCardFeedback({
      userId:user.uid,card,rating:"negative",reason:feedbackReason,comment:feedbackComment,
    });
    setFeedbackStatus(result.persisted ? "Obrigado. Seu feedback ajudará o conteúdo a melhorar." : "Não foi possível sincronizar agora.");
    setFeedback("down-sent");
  }

  async function generateCards() {
    if (!generateForm.subject.trim() || !generateForm.topic.trim()) {
      setGenerateError("Informe a matéria e o tópico."); return;
    }
    if (!auth?.currentUser) { setGenerateError("Entre com sua conta Google para gerar cards."); return; }
    setGenerateBusy(true); setGenerateError(""); setSaveStatus(""); setGenerated([]);
    try {
      const token = await getIdToken(auth.currentUser);
      const base = (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/,"");
      const response = await fetch(`${base}/api/gemini/generate-flashcards`, {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          prompt:`Gere flashcards para a matéria "${generateForm.subject.trim()}" focando exclusivamente no tópico "${generateForm.topic.trim()}".`,
          subject:generateForm.subject.trim(), topic:generateForm.topic.trim(),
          selectedTopics:[generateForm.topic.trim()], educationLevel:generateForm.level,
          count:Math.min(50,Math.max(1,Number(generateForm.count)||10)),
          difficulty:generateForm.difficulty, language:"pt", cardContentType:"definition",
          sourceType:"subject",
          existingFronts:allDeckCards.map(item=>item.front).filter(Boolean).slice(0,500),
        }),
      });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Erro HTTP ${response.status}`);
      const cards = (Array.isArray(payload) ? payload : payload.cards || payload.data?.cards || [])
        .map((item,index)=>({...item,id:item.id||`${Date.now()}-${index}`,
          front:item.front||item.question||"",back:item.back||item.answer||"",
          topic:item.topic||generateForm.topic.trim(),difficulty:item.difficulty||generateForm.difficulty,
          explanation:item.explanation||"",curiosity:item.curiosity||""}))
        .filter(item=>item.front && item.back);
      if (!cards.length) throw new Error("A IA não retornou cards válidos.");
      setGenerated(cards);
    } catch (error) { setGenerateError(error?.message || "Não foi possível gerar os cards."); }
    finally { setGenerateBusy(false); }
  }

  async function saveGeneratedDeck() {
    if (!generated.length || !user) return;
    setSaveBusy(true); setSaveStatus("");
    try {
      const title = `${generateForm.subject.trim()} — ${generateForm.topic.trim()}`;
      const result = await createUserDeck({
        userId:user.uid,title,category:generateForm.subject.trim(),
        description:`Baralho gerado no MemoriaFlash Web sobre ${generateForm.topic.trim()}.`,
        cards:generated,
      });
      setSaveStatus(`${result.cards.length} cards salvos e sincronizados com o aplicativo.`);
      setGenerated([]); setTab("library");
    } catch (error) { setSaveStatus(error?.message || "Não foi possível salvar o baralho."); }
    finally { setSaveBusy(false); }
  }

  function studyGenerated() {
    if (!generated.length) return;
    setSelectedDeck(null); setStudyCards(generated); setStudyIndex(0); setRevealed(false); setFeedback(null); setTab("study");
  }

  if (!authReady) return <div className="loading-state"><span className="spinner"/> Verificando sua conta...</div>;
  if (!user) return <LoginScreen onLogin={login} busy={authBusy} error={authError}/>;

  const nav = next => {
    const icons = {home:Sparkles,library:Library,study:BookOpen,generate:WandSparkles,stats:TrendingUp};
    const labels = {home:"Início",library:"Meus baralhos",study:"Estudar",generate:"Gerar com IA",stats:"Progresso"};
    const Icon = icons[next];
    return <button className={tab===next ? "nav-item active":"nav-item"} onClick={()=>setTab(next)}><Icon size={19}/> {labels[next]}</button>;
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Brain size={22}/></div><div><strong>MemoriaFlash</strong><span>{user.displayName || "Sua conta"}</span></div></div>
      <nav>{nav("home")}{nav("library")}{nav("study")}{nav("generate")}{nav("stats")}</nav>
      <div className="sidebar-bottom">
        <div className="streak-card"><div className="streak-icon">{subscription.isPro?<Crown size={18}/>:<BookOpen size={18}/>}</div><div><strong>{subscription.isPro?"Plano PRO":"Plano gratuito"}</strong><span>{subscription.isPro?"Sem anúncios":user.email}</span></div></div>
        <button className="nav-item" onClick={logout} disabled={authBusy}><LogOut size={19}/> {authBusy?"Saindo...":"Sair"}</button>
        {deckError && <small className="feedback-status">{deckError}</small>}
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="mobile-brand"><Brain size={20}/> MemoriaFlash</div><div className="top-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar baralho ou card..."/></div><button className="profile">{user.displayName?.[0]?.toUpperCase() || "M"}</button></header>

      {tab==="home" && <div className="page">
        <section className="hero"><div><span className="eyebrow"><Sparkles size={15}/> Conta sincronizada</span><h1>Continue seus estudos.</h1><p>Estude no computador os mesmos baralhos e cards do seu aplicativo mobile.</p><button className="primary" onClick={()=>setTab("library")}>Ver meus baralhos <ChevronRight size={18}/></button></div><div className="hero-orbit"><BookOpen size={92}/><span>{decks.length}</span><small>baralhos</small></div></section>
        <AdSlot isPro={subscription.isPro} slot={import.meta.env.VITE_ADSENSE_HOME_SLOT}/>
        <section className="section-head"><div><h2>Resumo</h2><p>{allDeckCards.length.toLocaleString("pt-BR")} cards sincronizados.</p></div></section>
        <div className="today-grid"><div className="metric-card"><div className="metric-icon purple"><Library size={18}/></div><strong>{decks.length}</strong><span>baralhos</span></div><div className="metric-card"><div className="metric-icon blue"><BookOpen size={18}/></div><strong>{allDeckCards.length}</strong><span>cards</span></div><div className="metric-card"><div className="metric-icon green"><TrendingUp size={18}/></div><strong>{dueCards.length}</strong><span>para revisar</span></div><div className="metric-card"><div className="metric-icon orange"><Crown size={18}/></div><strong>{subscription.isPro?"PRO":"FREE"}</strong><span>{subscription.isPro?"sem anúncios":"plano atual"}</span></div></div>
        <section className="section-head"><div><h2>Seus baralhos</h2></div></section>
        <div className="subject-grid">{filteredDecks.slice(0,8).map(deck=><article className="subject-card" key={deck.id}><div className="subject-icon violet"><BookOpen size={20}/></div><div className="subject-main"><h3>{deck.title}</h3><span>{deck.cards.length} cards · {deck.category}</span></div><div className="progress"><div style={{width:"0%"}}/></div><div className="subject-foot"><span>Sincronizado</span><button onClick={()=>openDeck(deck)}>Estudar <ChevronRight size={15}/></button></div></article>)}</div>
        {!decks.length && <div className="empty-state"><h3>Nenhum baralho sincronizado ainda</h3><p>Crie um baralho no aplicativo ou gere cards no site e salve. O mesmo conteúdo aparecerá nas duas plataformas.</p></div>}
      </div>}

      {tab==="library" && <div className="page"><div className="page-title"><span className="eyebrow"><Library size={15}/> Biblioteca</span><h1>Meus baralhos</h1><p>Baralhos sincronizados pela sua conta Firebase.</p></div><AdSlot isPro={subscription.isPro} slot={import.meta.env.VITE_ADSENSE_LIBRARY_SLOT}/><div className="library-list">{filteredDecks.map(deck=><article className="library-row" key={deck.id} onClick={()=>openDeck(deck)}><div className="subject-icon violet"><BookOpen size={20}/></div><div className="row-main"><h3>{deck.title}</h3><span>{deck.cards.length} cards · {deck.category}</span></div><div className="topic-pills"><span>{deck.isPublic?"Público":"Meu baralho"}</span></div><button className="icon-button" onClick={e=>{e.stopPropagation();openDeck(deck)}}><ChevronRight size={18}/></button></article>)}</div>{!filteredDecks.length&&<div className="empty-state"><h3>Nenhum baralho encontrado</h3><p>Os baralhos do aplicativo aparecerão aqui quando forem sincronizados.</p></div>}</div>}

      {tab==="study" && <div className="study-page">{studyLoading?<div className="loading-state"><span className="spinner"/> Salvando progresso...</div>:!card?<div className="empty-state"><h3>Escolha um baralho para estudar</h3><p>Seus cards do aplicativo ficam disponíveis nesta sessão.</p><button className="secondary" onClick={()=>setTab("library")}>Ver baralhos</button></div>:<><div className="study-head"><div><span className="eyebrow"><BookOpen size={15}/> {card.deckTitle||selectedDeck?.title||"Meu baralho"}</span><h1>Sessão de estudo</h1></div><span className="counter">{(studyIndex%studyCards.length)+1} / {studyCards.length}</span></div><div className="study-progress"><div style={{width:`${(((studyIndex%studyCards.length)+1)/studyCards.length)*100}%`}}/></div><article className={"flashcard "+(revealed?"revealed":"")}>{!revealed?<div className="card-face"><span className="card-label">PERGUNTA</span><h2>{card.front}</h2><button className="primary" onClick={()=>setRevealed(true)}>Mostrar resposta</button></div>:<div className="card-face"><span className="card-label">RESPOSTA</span><h2 className="answer">{card.back}</h2><div className="explanation"><strong>📘 Explicação</strong><p>{card.explanation||"Sem explicação cadastrada."}</p>{card.curiosity&&<><strong>💡 Curiosidade</strong><p>{card.curiosity}</p></>}</div><div className="study-rating"><span>Como você se saiu?</span><div><button onClick={()=>gradeCard("hard")}><RotateCcw size={15}/> Difícil</button><button onClick={()=>gradeCard("good")}><Clock3 size={15}/> Bom</button><button onClick={()=>gradeCard("easy")}><ThumbsUp size={15}/> Fácil</button></div></div><div className="feedback-bar"><span>Qualidade do conteúdo</span><button className={feedback==="up"?"feedback selected-up":"feedback"} onClick={()=>sendFeedback("up")}><ThumbsUp size={16}/> Gostei</button><button className={feedback==="down"||feedback==="down-sent"?"feedback selected-down":"feedback"} onClick={()=>sendFeedback("down")}><ThumbsDown size={16}/> Precisa melhorar</button></div>{feedback==="down"&&<div className="feedback-reasons"><span>O que precisa melhorar?</span><div className="reason-list">{REASONS.map(reason=><button key={reason} className={feedbackReason===reason?"reason selected":"reason"} onClick={()=>setFeedbackReason(reason)}>{reason}</button>)}</div><textarea value={feedbackComment} onChange={e=>setFeedbackComment(e.target.value)} placeholder="Comentário opcional..." rows={3}/><button className="primary small" disabled={!feedbackReason} onClick={sendNegativeFeedback}>Enviar feedback</button></div>}{feedbackStatus&&<small className="feedback-status">{feedbackStatus}</small>}</div>}</article>{!subscription.isPro&&<AdSlot isPro={subscription.isPro} slot={import.meta.env.VITE_ADSENSE_STUDY_SLOT}/>}</>}</div>}

      {tab==="generate" && <div className="page"><div className="page-title"><span className="eyebrow"><WandSparkles size={15}/> Inteligência artificial</span><h1>Gerar flashcards</h1><p>Gere, revise, estude e salve. Ao salvar, o baralho entra no Firebase e aparece no aplicativo mobile.</p></div><AdSlot isPro={subscription.isPro} slot={import.meta.env.VITE_ADSENSE_GENERATE_SLOT}/><div className="generator-card"><div className="generator-grid"><label>Matéria<input value={generateForm.subject} onChange={e=>setGenerateForm({...generateForm,subject:e.target.value})} placeholder="Ex.: Português"/></label><label>Tópico<input value={generateForm.topic} onChange={e=>setGenerateForm({...generateForm,topic:e.target.value})} placeholder="Ex.: Morfologia"/></label><label>Quantidade<select value={generateForm.count} onChange={e=>setGenerateForm({...generateForm,count:e.target.value})}>{[5,10,15,20,30,50].map(n=><option key={n}>{n}</option>)}</select></label><label>Dificuldade<select value={generateForm.difficulty} onChange={e=>setGenerateForm({...generateForm,difficulty:e.target.value})}><option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil</option><option value="specialist">Especialista</option></select></label><label>Nível<select value={generateForm.level} onChange={e=>setGenerateForm({...generateForm,level:e.target.value})}><option value="medio">Ensino médio</option><option value="superior">Superior</option><option value="concurso">Concurso</option></select></label></div>{generateError&&<div className="auth-error">{generateError}</div>}<button className="primary" onClick={generateCards} disabled={generateBusy}><WandSparkles size={17}/> {generateBusy?"Gerando...":"Gerar flashcards"}</button></div>{generated.length>0&&<><div className="section-head"><div><h2>{generated.length} cards gerados</h2><p>Revise o conteúdo antes de salvar.</p></div></div><div className="generated-actions"><button className="primary" onClick={saveGeneratedDeck} disabled={saveBusy}><Library size={17}/> {saveBusy?"Salvando...":"Salvar e sincronizar com o aplicativo"}</button><button className="secondary" onClick={studyGenerated}>Estudar agora</button></div>{saveStatus&&<div className="feedback-status">{saveStatus}</div>}<div className="generated-list">{generated.map((item,index)=><article className="generated-card" key={item.id||index}><span>#{index+1}</span><h3>{item.front}</h3><p>{item.back}</p>{item.explanation&&<small>{item.explanation}</small>}</article>)}</div></>}</div>}

      {tab==="stats" && <div className="page"><div className="page-title"><span className="eyebrow"><TrendingUp size={15}/> Progresso</span><h1>Seu desempenho</h1><p>Dados associados à sua conta e aos cards sincronizados.</p></div><div className="today-grid"><div className="metric-card"><div className="metric-icon purple"><Library size={18}/></div><strong>{decks.length}</strong><span>baralhos</span></div><div className="metric-card"><div className="metric-icon blue"><BookOpen size={18}/></div><strong>{allDeckCards.length}</strong><span>cards</span></div><div className="metric-card"><div className="metric-icon green"><TrendingUp size={18}/></div><strong>{dueCards.length}</strong><span>para revisar</span></div><div className="metric-card"><div className="metric-icon orange"><Crown size={18}/></div><strong>{subscription.isPro?"PRO":"FREE"}</strong><span>{subscription.isPro?"sem anúncios":"com anúncios"}</span></div></div><AdSlot isPro={subscription.isPro} slot={import.meta.env.VITE_ADSENSE_STATS_SLOT}/></div>}
    </main>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
