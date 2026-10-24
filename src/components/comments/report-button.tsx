"use client";

import { useId, useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportComment } from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLoginRedirect } from "@/components/watch/use-login-redirect";

const REASONS = [
  { value: "SPOILER", label: "İşaretlenmemiş spoiler" },
  { value: "ABUSE", label: "Hakaret veya taciz" },
  { value: "SPAM", label: "Reklam veya alakasız" },
  { value: "OTHER", label: "Diğer" },
] as const;

/** "Şikayet et" on someone else's comment: pick a reason, the admins see it in their panel. */
export function ReportButton({
  commentId,
  username,
  signedIn,
}: {
  commentId: string;
  username: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>();
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();
  const goToLogin = useLoginRedirect();
  const id = useId();

  const submit = () =>
    startTransition(async () => {
      const result = await reportComment(commentId, reason ?? "");
      if (!result.ok) return void toast.error(result.error);
      setOpen(false);
      setReported(true);
      toast.success("Şikayetin iletildi. Teşekkürler!");
    });

  if (reported)
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 px-2 text-sm">
        <Flag className="size-4" />
        Şikayet edildi
      </span>
    );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        aria-label={`@${username} yorumunu şikayet et`}
        onClick={() => (signedIn ? setOpen(true) : goToLogin())}
      >
        <Flag />
        <span className="max-sm:sr-only">Şikayet et</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yorumu şikayet et</DialogTitle>
            <DialogDescription>Neden uygunsuz? Şikayetin yalnızca site yöneticisine gider.</DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="sr-only">Şikayet nedeni</legend>
            {REASONS.map((r) => (
              <label
                key={r.value}
                htmlFor={`${id}-${r.value}`}
                className="has-[:checked]:border-primary flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
              >
                <input
                  id={`${id}-${r.value}`}
                  type="radio"
                  name={`${id}-reason`}
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-primary size-4"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Vazgeç
            </Button>
            <Button onClick={submit} disabled={pending || !reason}>
              {pending && <Loader2 className="animate-spin" />}
              Şikayet et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
