import React, { useEffect, useState } from "react";
import { CheckCircle2, HelpCircle, MessageSquare, Send, ThumbsUp, TriangleAlert, X } from "lucide-react";
import { submitSupportRequest, SUPPORT_TYPES } from "../services/support";

const TYPE_ICONS = { card_error: TriangleAlert, wrong_answer: TriangleAlert, suggestion: MessageSquare, praise: ThumbsUp, bug: TriangleAlert, other: HelpCircle };

export default function HelpPage({ user, reportCard = null, onClearCard }) {
  const [type, setType] = useState(reportCard ? "card_error" : "suggestion");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (reportCard) {
      setType("card_error");
      setMessage("");
      setStatus("");
      setError("");
    }
  }, [reportCard]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setStatus("");
    try {
      const result = await submitSupportRequest({ userId: user.uid, user, type, message, card: reportCard });
      setStatus(result.persisted ? "Mensagem enviada. Obrigado por ajudar a melhorar o MemoriaFlash!" : "Não foi possível sincronizar agora. Tente novamente.");
      if (result.persisted) { setMessage(""); onClearCard?.(); }
    } catch (err) { setError(err?.message || "Não foi possível enviar sua mensagem."); }
    finally { setBusy(false); }
  }

  return <div className="page help-page">
    <div className="page-title"><span className="eyebrow"><HelpCircle size={15} /> AJUDA E FEEDBACK</span><h1>Como podemos melhorar?</h1><p>Relate um problema, corrija um card, envie uma sugestão ou mande um elogio.</p></div>
    {reportCard && <section className="help-card-context"><div><span>Card selecionado</span><strong>{reportCard.front || "Card sem pergunta"}</strong><small>{reportCard.deckTitle || reportCard.subject || "Conteúdo de estudo"}</small></div><button type="button" onClick={onClearCard} aria-label="Remover card selecionado"><X size={18} /></button></section>}
    <form className="help-form" onSubmit={submit}>
      <div className="help-type-grid">{SUPPORT_TYPES.map((item) => { const Icon = TYPE_ICONS[item.value] || HelpCircle; return <button type="button" key={item.value} className={type === item.value ? "help-type active" : "help-type"} onClick={() => { setType(item.value); setError(""); }}><Icon size={19} /><span>{item.label}</span>{type === item.value && <CheckCircle2 size={16} />}</button>; })}</div>
      <label className="help-field"><span>Mensagem</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={7} placeholder={type === "praise" ? "Conte o que você gostou..." : "Explique o que aconteceu ou sua sugestão..."} /><small>{message.length}/2000</small></label>
      {error && <div className="help-alert error"><TriangleAlert size={17} />{error}</div>}
      {status && <div className="help-alert success"><CheckCircle2 size={17} />{status}</div>}
      <div className="help-form-foot"><p>Seu feedback será enviado junto com sua conta para podermos analisar e melhorar o conteúdo.</p><button className="primary" type="submit" disabled={busy || message.trim().length < 5}><Send size={17} />{busy ? "Enviando..." : "Enviar feedback"}</button></div>
    </form>
    <section className="help-info"><div><CheckCircle2 size={20} /><div><strong>Resposta errada?</strong><span>O card e o contexto são enviados junto para análise.</span></div></div><div><MessageSquare size={20} /><div><strong>Sugestão?</strong><span>Envie ideias de recursos, navegação ou experiência de estudo.</span></div></div><div><ThumbsUp size={20} /><div><strong>Gostou?</strong><span>Elogios ajudam a saber o que devemos manter.</span></div></div></section>
  </div>;
}
