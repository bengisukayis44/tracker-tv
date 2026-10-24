"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions/watch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A panel action: runs straight away, or after a confirmation dialog when `confirm` is given. */
export function ConfirmButton({
  children,
  action,
  done,
  confirm,
  variant = "outline",
  ariaLabel,
  redirectTo,
}: {
  children: React.ReactNode;
  action: () => Promise<ActionResult>;
  /** Toast after success */
  done: string;
  confirm?: { title: string; text: string; label: string };
  variant?: "outline" | "destructive" | "secondary" | "ghost";
  ariaLabel?: string;
  /** Where to go afterwards (e.g. away from a deleted user's page); otherwise the page refreshes */
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      setOpen(false);
      toast.success(done);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        aria-label={ariaLabel}
        disabled={pending}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {pending && !confirm && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {confirm && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.text}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Vazgeç
              </Button>
              <Button variant="destructive" onClick={run} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {confirm.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
