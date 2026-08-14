import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, RotateCcw, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { saveCardFeedback } from "../services/feedback";
import { saveCardProgress } from "../services/progress";
import "../study.css";

const REASONS = [
  "Pergunta confusa",
  "Resposta incorreta",
  "Explicação ruim",
  "Muito fácil",
  "Muito difícil",
  "Conteúdo repetido",
  "Desatualizado",
];

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
    reps,
    interval,
    efactor: nextEf,
    dueDate: new Date(now.getTime() + interval * 86400000).toISOString(),
    lastReviewed: now.toISOString(),
  };
}

function prepareQueue(cards) {
  const now = Date.now();
  return [...cards].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    const aIsDue = aDue <= now;
    const bIsDue = bDue <= now;
    if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
    if (aIsDue && bIsDue) return aDue - bDue;
    return Number(a.reps || 0) - Number(b.reps || 0);
  });
}

export default function StudySession({ user, deck, cards = [], onExit }) {
  const queue = useMemo(() => prepareQueue(cards), [cards]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  useEffect(() => {
    setIndex(0);
    setRevealed(false);
    setFinished(false);
    setFeedback(null);
    setFeedbackReason("");
    setFeedbackComment("");
    setFeedbackStatus("");
  }, [cards]);

  const card = queue[index];
  const progress = queue.length ? Math.round((index / queue.length) * 100) : 0;

  async function gradeCard(grade) {
    if (!card || saving || !user) return;
    setSaving(true);
    setFeedbackStatus("");
    try {
      const srs = calculateSrs(card, grade);
      await saveCardProgress(user.uid, card.id, {
        reviewed: true,
        grade,
        deckId: deck?.id || card.deckId || null,
        ...srs,
      });

      if (index >= queue.length - 1) {
        setFinished(true);
      } else {
        setIndex((value) => value + 1);
        setRevealed(false);
      }
      setFeedback(null);
      setFeedbackReason("");
      setFeedbackComment("");
    } catch (error) {
      setFeedbackStatus(error?.message || "Não foi possível salvar seu progresso.");
    } finally {
      setSaving(false);
    }
  }

  async function sendFeedback(rating) {
    if (!card || !user) return;
    setFeedback(rating);
    if (rating === "down") return;
    setFeedbackStatus("Salvando feedback...");
    const result = await saveCardFeedback({ userId: user.uid, card, rating: "positive" });
    setFeedbackStatus(result.persisted ? "Feedback salvo." : "Não foi possível sincronizar agora.");
  }

  async function sendNegativeFeedback() {
    if (!card || !feedbackReason || !user) return;
    setFeedbackStatus("Salvando feedback...");
    const result = await saveCardFeedback({
      userId: user.uid,
      card,
      rating: "negative",
      reason: feedbackReason,
      comment: feedbackComment,
    });
    setFeedbackStatus(result.persisted ? "Obrigado pelo feedback." : "Não foi possível sincronizar agora.");
    setFeedback("down-sent");
  }

  if (!queue.length || finished) {
    return (
      <main className="study-shell study-complete">
        <header className="study-topbar">
          <button className="study-exit" onClick={onExit} aria-label="Sair do estudo"><ArrowLeft size={18} /> Sair do estudo</button>
          <span className="study-brand">MemoriaFlash</span>
          <span className="study-counter">{queue.length} cards</span>
        </header>
        <section className="study-complete-card">
          <div className="complete-icon"><Check size={34} /></div>
          <span className="study-kicker">Sessão concluída</span>
          <h1>Ótimo trabalho.</h1>
          <p>Você terminou os cards disponíveis nesta sessão. Seu progresso foi salvo.</p>
          <button className="primary" onClick={onExit}>Voltar para meus baralhos</button>
        </section>
      </main>
    );
  }

  return (
    <main className="study-shell">
      <header className="study-topbar">
        <button className="study-exit" onClick={onExit} disabled={saving}><ArrowLeft size={18} /> Sair do estudo</button>
        <div className="study-title">
          <strong>{deck?.title || card.deckTitle || "Sessão de estudo"}</strong>
          <span>{deck?.category || card.subject || "Revisão"}</span>
        </div>
        <span className="study-counter">{index + 1} / {queue.length}</span>
      </header>

      <div className="study-progress-line"><div style={{ width: `${Math.max(4, progress)}%` }} /></div>

      <section className="study-stage">
        <article className={revealed ? "study-card revealed" : "study-card"}>
          <div className="study-card-inner">
            <span className="study-card-label">{revealed ? "RESPOSTA" : "PERGUNTA"}</span>
            <h1>{revealed ? card.back : card.front}</h1>

            {revealed && (
              <div className="study-card-extra">
                {card.explanation && <div><strong>📘 Explicação</strong><p>{card.explanation}</p></div>}
                {card.curiosity && <div><strong>💡 Curiosidade</strong><p>{card.curiosity}</p></div>}
              </div>
            )}

            {!revealed && <button className="reveal-button" onClick={() => setRevealed(true)}>Mostrar resposta</button>}
          </div>
        </article>

        <div className="study-actions">
          {!revealed ? (
            <div className="study-hint">Tente responder mentalmente antes de revelar.</div>
          ) : (
            <>
              <div className="rating-title">Como você se saiu?</div>
              <div className="rating-actions">
                <button className="rating rating-hard" onClick={() => gradeCard("hard")} disabled={saving}><RotateCcw size={18}/><span><strong>Difícil</strong><small>Revisar logo</small></span></button>
                <button className="rating rating-good" onClick={() => gradeCard("good")} disabled={saving}><Clock3 size={18}/><span><strong>Bom</strong><small>Revisar depois</small></span></button>
                <button className="rating rating-easy" onClick={() => gradeCard("easy")} disabled={saving}><ThumbsUp size={18}/><span><strong>Fácil</strong><small>Intervalo maior</small></span></button>
              </div>
            </>
          )}
        </div>

        <div className="study-feedback">
          <span>Qualidade do conteúdo</span>
          <button className={feedback === "up" ? "content-feedback active" : "content-feedback"} onClick={() => sendFeedback("up")}><ThumbsUp size={15}/> Gostei</button>
          <button className={feedback === "down" || feedback === "down-sent" ? "content-feedback active negative" : "content-feedback"} onClick={() => sendFeedback("down")}><ThumbsDown size={15}/> Precisa melhorar</button>
        </div>

        {feedback === "down" && (
          <div className="feedback-panel">
            <button className="feedback-close" onClick={() => setFeedback(null)}><X size={16}/></button>
            <strong>O que precisa melhorar?</strong>
            <div className="reason-list">{REASONS.map(reason => <button key={reason} className={feedbackReason === reason ? "reason selected" : "reason"} onClick={() => setFeedbackReason(reason)}>{reason}</button>)}</div>
            <textarea value={feedbackComment} onChange={event => setFeedbackComment(event.target.value)} placeholder="Comentário opcional..." rows={2}/>
            <button className="primary small" disabled={!feedbackReason} onClick={sendNegativeFeedback}>Enviar feedback</button>
          </div>
        )}

        {feedbackStatus && <div className="study-status">{feedbackStatus}</div>}
      </section>
    </main>
  );
}
