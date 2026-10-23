"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createList, deleteList, setListMembership, updateList } from "@/app/actions/lists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListForm } from "./list-form";

/** "Yeni liste" on one's own profile: creates an empty list and opens it. */
export function NewListButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus />
        Yeni liste
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni liste</DialogTitle>
            <DialogDescription>
              Dizi ve film sayfalarındaki &ldquo;Listeye ekle&rdquo; ile doldurabilirsin.
            </DialogDescription>
          </DialogHeader>
          <ListForm
            submitLabel="Oluştur"
            onSubmit={async (fields) => {
              const result = await createList(fields);
              if (result.ok) {
                setOpen(false);
                router.push(`/list/${result.id}`);
              }
              return result;
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The owner's "Düzenle" and "Sil" on a list page. */
export function ListOwnerControls({
  list,
  profileHref,
}: {
  list: { id: string; name: string; description: string | null; isPublic: boolean };
  profileHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const remove = () =>
    startTransition(async () => {
      const result = await deleteList(list.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${list.name} listesi silindi.`);
      router.push(profileHref);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil />
        Düzenle
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
        <Trash2 />
        Listeyi sil
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Listeyi düzenle</DialogTitle>
            <DialogDescription>Adını, açıklamasını ve kimlerin görebileceğini değiştir.</DialogDescription>
          </DialogHeader>
          <ListForm
            initial={list}
            submitLabel="Kaydet"
            onSubmit={async (fields) => {
              const result = await updateList(list.id, fields);
              if (result.ok) {
                setEditing(false);
                router.refresh();
                toast.success("Liste güncellendi.");
              }
              return result;
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Listeyi sil?</DialogTitle>
            <DialogDescription>
              {list.name} listesi silinir; içindeki dizi ve filmlerin izleme kayıtların yerinde kalır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "Listeden çıkar" under a title on the owner's list page. */
export function RemoveFromListButton({ listId, titleId, name }: { listId: string; titleId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full"
      disabled={pending}
      aria-label={`${name}: listeden çıkar`}
      onClick={() =>
        startTransition(async () => {
          const result = await setListMembership(listId, titleId, false);
          if (!result.ok) return void toast.error(result.error);
          router.refresh();
          toast.success(`${name} listeden çıkarıldı.`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Çıkar
    </Button>
  );
}
