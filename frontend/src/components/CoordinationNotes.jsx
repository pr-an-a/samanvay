import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Bureau, Button, Card, ErrorBox } from "./ui";
import { bureauName, formatDateTime } from "../labels";

const MAX = 500;

const involved = (link) => [link.case_a.source_bureau, link.case_b.source_bureau];

/** Can this user post on this confirmed match? Mirrors the server rule: involved bureaus and Admin. */
export const canPost = (user, link) => user?.role === "ADMIN" || involved(link).includes(user?.bureau);

/**
 * Coordination notes on confirmed matches. `links` are the confirmed matches notes can be posted on; `notes` is the
 * whole thread, oldest first. Notes cannot be edited or deleted.
 */
export default function CoordinationNotes({ links, notes, onPosted }) {
  const { user } = useAuth();
  const postable = links.filter((l) => canPost(user, l));
  const [linkId, setLinkId] = useState(postable[0]?.id);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const chosen = postable.find((l) => l.id === (linkId ?? postable[0]?.id));
  const pair = (l) => `${l.case_a.case_id} and ${l.case_b.case_id}`;

  async function post(e) {
    e.preventDefault();
    if (!body.trim() || !chosen) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/links/${chosen.id}/notes`, { method: "POST", body: { body: body.trim() } });
      setBody("");
      onPosted();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-tour-target="notes" title="Coordination notes" sub="Short notes between the bureaus on this college. They cannot be edited or deleted, and each one is in the audit log.">
      {notes.length === 0 ? (
        <p className="text-base text-ink-2">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {notes.map((n) => (
            <li key={n.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                {n.bureau === "ADMIN" ? <span className="rounded-full bg-sand px-2.5 py-0.5 text-sm text-ink">Administrator</span> : <Bureau code={n.bureau} />}
                <span className="font-semibold">{n.author}</span>
                <span className="tabular text-muted">{formatDateTime(n.timestamp)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-lg">{n.body}</p>
            </li>
          ))}
        </ul>
      )}

      {postable.length > 0 ? (
        <form onSubmit={post} className="mt-4 space-y-3">
          {postable.length > 1 && (
            <label className="block text-base text-ink-2">
              About
              <select value={chosen?.id} onChange={(e) => setLinkId(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink">
                {postable.map((l) => <option key={l.id} value={l.id}>Cases {pair(l)}</option>)}
              </select>
            </label>
          )}
          <label className="block text-base text-ink-2" htmlFor="note-body">
            Add a note for {chosen ? involved(chosen).filter((b) => b !== user.bureau).map(bureauName).join(" and ") || "the other bureau" : "the other bureau"}
          </label>
          <textarea
            id="note-body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX))}
            rows={2}
            className="w-full rounded-lg border border-line p-3 text-base"
            placeholder="e.g. We’ve issued a show-cause notice. Please hold your reply."
          />
          <div className="flex items-center justify-between gap-3">
            <span className="tabular text-sm text-muted">{body.length}/{MAX}</span>
            <Button type="submit" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post note"}</Button>
          </div>
          <ErrorBox error={error} />
        </form>
      ) : (
        <p className="mt-4 text-base text-muted">Only the bureaus on this match and the Administrator can add notes.</p>
      )}
    </Card>
  );
}
