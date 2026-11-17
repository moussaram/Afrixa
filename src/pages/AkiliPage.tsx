import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Bot, MessageSquarePlus, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import akiliMark from "/akili-mark.svg";

type AkiliMessage = {
  role: "user" | "model";
  content: string;
  id: string;
  createdAt: string;
};

type ConversationSummary = {
  id: string;
  title: string | null;
  updated_at: string;
};

const db = supabase as any;

const welcomeMessage: AkiliMessage = {
  id: "welcome",
  role: "model",
  content: "Aye ! Je suis Akili, ton assistant sur Afrixa. Je peux répondre à tes questions, t'aider avec tes contenus et accompagner tes projets. Qu'est-ce qu'on fait ensemble aujourd'hui ? 🌍",
  createdAt: new Date().toISOString(),
};

const suggestions = [
  "Comment développer mon audience sur Afrixa ?",
  "Aide-moi à trouver une idée de vidéo",
  "Comment mieux vendre mes produits ?",
];

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function AkiliPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<AkiliMessage[]>([welcomeMessage]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshConversations = async () => {
    if (!user) return;
    const { data } = await db.from("akili_conversations")
      .select("id,title,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);
    setConversations((data ?? []) as ConversationSummary[]);
  };

  useEffect(() => {
    void refreshConversations();
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([welcomeMessage]);
    setDraft("");
    setError(null);
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const openConversation = async (id: string) => {
    if (!user) return;
    const { data, error: loadError } = await db.from("akili_conversations")
      .select("id,messages")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError || !data) {
      setError("Impossible de charger cette conversation.");
      return;
    }
    const stored = Array.isArray(data.messages) ? data.messages : [];
    setMessages([welcomeMessage, ...stored.map((item: any, index: number) => ({
      id: `${id}-${index}`,
      role: item.role === "user" ? "user" : "model",
      content: String(item.content ?? ""),
      createdAt: item.createdAt ?? new Date().toISOString(),
    }))]);
    setConversationId(id);
    setHistoryOpen(false);
    setError(null);
  };

  const sendMessage = async (value: string) => {
    const content = value.trim();
    if (!content || loading || !user) return;
    setDraft("");
    setError(null);
    const userMessage: AkiliMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("akili-chat", {
        body: {
          message: content,
          conversationId,
          context: "general",
          page: window.location.pathname,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.answer || typeof data.answer !== "string") {
        throw new Error("Réponse invalide");
      }
      setConversationId(data.conversationId ?? conversationId);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "model",
        content: data.answer,
        createdAt: new Date().toISOString(),
      }]);
      void refreshConversations();
    } catch (err) {
      console.error("Akili chat request failed", err);
      setError("Akili n'a pas pu répondre pour le moment. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  };

  const sendFeedback = async (message: AkiliMessage, rating: 1 | -1) => {
    if (!user) return;
    const { error: feedbackError } = await db.from("akili_feedback").insert({
      user_id: user.id,
      message_content: message.content.slice(0, 4000),
      rating,
    });
    if (feedbackError) setError("Ton avis n'a pas pu être envoyé.");
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link to="/profile" aria-label="Retour au profil" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={akiliMark} alt="Akili" className="h-10 w-10 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-bold leading-tight">Akili</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ton assistant Afrixa
            </p>
          </div>
          <button onClick={() => setHistoryOpen((open) => !open)} aria-label="Historique des conversations"
            className="rounded-xl p-2.5 hover:bg-muted" title="Historique">
            <Bot className="h-5 w-5" />
          </button>
          <button onClick={startNewConversation} aria-label="Nouvelle conversation"
            className="rounded-xl p-2.5 hover:bg-muted" title="Nouvelle conversation">
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </div>
      </header>

      {historyOpen && (
        <section className="mx-auto w-full max-w-4xl px-4 pt-3">
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Conversations récentes</p>
              <button onClick={() => setHistoryOpen(false)} className="text-xs text-muted-foreground">Fermer</button>
            </div>
            {conversations.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Tes conversations apparaîtront ici.</p>
            ) : conversations.map((item) => (
              <button key={item.id} onClick={() => void openConversation(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted ${conversationId === item.id ? "bg-muted" : ""}`}>
                <MessageSquarePlus className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.title || "Nouvelle conversation"}</span>
                <span className="text-[11px] text-muted-foreground">{formatTime(item.updated_at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section ref={scrollRef} className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 pb-8">
        {messages.length === 1 && (
          <div className="mx-auto my-auto flex max-w-lg flex-col items-center py-8 text-center">
            <div className="mb-5 rounded-[2rem] bg-gradient-to-br from-sky-400/15 via-blue-500/10 to-fuchsia-500/15 p-4 ring-1 ring-primary/15 shadow-xl shadow-primary/10">
              <img src={akiliMark} alt="" className="h-24 w-24" />
            </div>
            <div className="mb-2 flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-sm font-semibold">Bienvenue sur Akili</span></div>
            <h2 className="text-2xl font-bold tracking-tight">On avance ensemble ?</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Pose-moi une question, prépare un contenu ou demande des conseils pour ton activité sur Afrixa.
            </p>
            <div className="mt-6 grid w-full gap-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => void sendMessage(suggestion)}
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <article key={message.id} className={`flex items-end gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "model" && <img src={akiliMark} alt="" className="mb-1 h-8 w-8 shrink-0 rounded-xl" />}
            <div className={`max-w-[min(88%,42rem)] rounded-3xl px-4 py-3 shadow-sm ${message.role === "user" ? "rounded-br-lg bg-primary text-primary-foreground" : "rounded-bl-lg border border-border bg-card"}`}>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
              <div className={`mt-2 flex items-center justify-between gap-4 text-[10px] ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                <span>{formatTime(message.createdAt)}</span>
                {message.role === "model" && message.id !== "welcome" && (
                  <span className="flex items-center gap-2">
                    <button onClick={() => void sendFeedback(message, 1)} aria-label="Bonne réponse" title="Utile"><ThumbsUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => void sendFeedback(message, -1)} aria-label="Mauvaise réponse" title="Pas utile"><ThumbsDown className="h-3.5 w-3.5" /></button>
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
        {loading && (
          <div className="flex items-end gap-2.5">
            <img src={akiliMark} alt="" className="h-8 w-8 rounded-xl" />
            <div className="rounded-3xl rounded-bl-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Akili réfléchit<span className="animate-pulse">…</span>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mx-auto rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      </section>

      <footer className="sticky bottom-0 border-t border-border/60 bg-background/95 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-end gap-2 px-4">
          <div className="flex min-h-12 flex-1 items-end rounded-3xl border border-border bg-card px-4 py-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
            <textarea ref={inputRef} rows={1} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown} placeholder="Écris ton message à Akili…" aria-label="Message à Akili"
              className="max-h-36 min-h-7 flex-1 resize-y bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <button type="submit" disabled={!draft.trim() || loading}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-blue-600 to-fuchsia-600 text-white shadow-lg shadow-primary/20 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Envoyer le message">
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl px-5 text-center text-[10px] text-muted-foreground">
          Akili peut se tromper. Vérifie les informations importantes avant d'agir.
        </p>
      </footer>
    </main>
  );
}
