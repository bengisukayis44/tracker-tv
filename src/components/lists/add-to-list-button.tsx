"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Loader2, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { createList, getListChoices, setListMembership, type ListChoice } from "@/app/actions/lists";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLoginRedirect } from "@/components/watch/use-login-redirect";
import { ListForm } from "./list-form";

/** "Listeye ekle" on a series or movie page: tick the lists it should be in, or make a new one. */
export function AddToListButton({
  titleId,
  titleName,
  signedIn,
}: {
  titleId: string;
  titleName: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListChoice[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();
  const goToLogin = useLoginRedirect();
  const router = useRouter();

  const load = () =>
    startTransition(async () => {
      const result = await getListChoices(titleId);
      if (!result.ok) return void toast.error(result.error);
      setLists(result.lists);
      setCreating(result.lists.length === 0);
    });

  const toggle = (list: ListChoice) => {
    const contains = !list.contains;
    // Ticks at once; put back if saving fails
    setLists(
      (all) =>
        all?.map((l) => (l.id === list.id ? { ...l, contains, count: l.count + (contains ? 1 : -1) } : l)) ?? null,
    );
    startTransition(async () => {
      const result = await setListMembership(list.id, titleId, contains);
      if (!result.ok) {
        setLists((all) => all?.map((l) => (l.id === list.id ? list : l)) ?? null);
        return void toast.error(result.error);
      }
      router.refresh();
      toast.success(contains ? `${list.name} listesine eklendi.` : `${list.name} listesinden çıkarıldı.`);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          if (!signedIn) return goToLogin();
          setOpen(true);
          setLists(null);
          load();
        }}
      >
        <ListPlus />
        Listeye ekle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Listeye ekle</DialogTitle>
            <DialogDescription>{titleName} hangi listelerinde olsun?</DialogDescription>
          </DialogHeader>

          {lists === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Yükleniyor…
            </div>
          ) : (
            <div className="space-y-4">
              {lists.length > 0 && (
                <ul className="divide-y rounded-lg border">
                  {lists.map((list) => (
                    <li key={list.id}>
                      <label className="hover:bg-accent flex cursor-pointer items-center gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={list.contains}
                          onChange={() => toggle(list)}
                          className="accent-primary size-4"
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold">{list.name}</span>
                        {!list.isPublic && <Lock aria-label="Gizli liste" className="text-muted-foreground size-3.5" />}
                        <span className="text-muted-foreground text-xs">{list.count}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {creating ? (
                <ListForm
                  submitLabel="Oluştur ve ekle"
                  withDescription={false}
                  onSubmit={async (fields) => {
                    const result = await createList({ ...fields, titleId });
                    if (result.ok) {
                      router.refresh();
                      toast.success(`${fields.name.trim()} listesi oluşturuldu.`);
                      setCreating(false);
                      load();
                    }
                    return result;
                  }}
                />
              ) : (
                <Button variant="ghost" className="w-full" onClick={() => setCreating(true)}>
                  <Plus />
                  Yeni liste oluştur
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
