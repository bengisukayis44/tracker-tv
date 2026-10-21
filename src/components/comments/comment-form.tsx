"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/app/actions/watch";
import { COMMENT_MAX_LENGTH } from "@/lib/validations/comment";

export type CommentDraft = { content: string; isSpoiler: boolean };

/** Text and "Spoiler içerir" box, used both for new comments and for editing one. */
export function CommentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: CommentDraft;
  submitLabel: string;
  /** Resolves with the action result; the form clears itself after a successful new comment */
  onSubmit: (draft: CommentDraft) => Promise<ActionResult>;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [isSpoiler, setIsSpoiler] = useState(initial?.isSpoiler ?? false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const id = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await onSubmit({ content, isSpoiler });
      if (!result.ok) return setError(result.error);
      if (!initial) {
        setContent("");
        setIsSpoiler(false);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={`${id}-content`} className="sr-only">
        {initial ? "Yorumu düzenle" : "Yorumun"}
      </label>
      <Textarea
        id={`${id}-content`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={COMMENT_MAX_LENGTH}
        rows={3}
        placeholder="Ne düşündün? Başkalarıyla paylaş…"
        autoFocus={Boolean(initial)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={`${id}-spoiler`} className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            id={`${id}-spoiler`}
            type="checkbox"
            checked={isSpoiler}
            onChange={(e) => setIsSpoiler(e.target.checked)}
            className="accent-primary size-4"
          />
          Spoiler içerir
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {content.length}/{COMMENT_MAX_LENGTH}
          </span>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
              Vazgeç
            </Button>
          )}
          <Button type="submit" size="sm" disabled={pending || !content.trim()}>
            {pending && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
