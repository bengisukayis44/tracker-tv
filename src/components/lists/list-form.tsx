"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/app/actions/watch";
import { LIST_DESCRIPTION_MAX, LIST_NAME_MAX, type ListFields } from "@/lib/validations/list";

/** Name, description and "Herkese açık" of a list; for creating and editing. */
export function ListForm({
  initial,
  submitLabel,
  onSubmit,
  withDescription = true,
}: {
  initial?: { name: string; description: string | null; isPublic: boolean };
  submitLabel: string;
  onSubmit: (fields: ListFields) => Promise<ActionResult>;
  withDescription?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const id = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await onSubmit({ name, description, isPublic });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-semibold">
          Liste adı
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIST_NAME_MAX}
          placeholder="ör. Hafta sonu izlenecekler"
          autoFocus
        />
      </div>
      {withDescription && (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-description`} className="text-sm font-semibold">
            Açıklama <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
          </label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIST_DESCRIPTION_MAX}
            rows={2}
          />
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="accent-primary size-4"
        />
        Herkese açık (kapalıysa yalnızca sen görürsün)
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
