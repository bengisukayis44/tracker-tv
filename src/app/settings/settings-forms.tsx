"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changeUsername, removeAvatar, setProfilePrivate, uploadAvatar } from "./actions";

// Photos are shrunk in the browser first, so even large phone photos upload quickly
const UPLOAD_EDGE = 512;

/** Draws the image into a square-ish canvas no larger than UPLOAD_EDGE and returns a JPEG. */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, UPLOAD_EDGE / Math.min(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", 0.9),
  );
}

export function AvatarForm({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const upload = (file: File) =>
    startTransition(async () => {
      setError(undefined);
      let image: Blob;
      try {
        image = await shrinkImage(file);
      } catch {
        return setError("Bu dosya okunamadı. JPEG, PNG ya da WebP bir fotoğraf seç.");
      }
      const form = new FormData();
      form.set("avatar", new File([image], "avatar.jpg", { type: "image/jpeg" }));
      const result = await uploadAvatar(form);
      if (!result.ok) return setError(result.error);
      router.refresh();
      toast.success("Profil fotoğrafın güncellendi.");
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) return setError(result.error);
      router.refresh();
      toast.success("Profil fotoğrafın kaldırıldı.");
    });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-20 text-2xl">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="Profil fotoğrafın" />}
        <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Profil fotoğrafı seç"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button onClick={() => input.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />}
            Fotoğraf yükle
          </Button>
          {avatarUrl && (
            <Button variant="ghost" onClick={remove} disabled={pending}>
              <Trash2 />
              Kaldır
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">JPEG, PNG ya da WebP. Kare olarak kırpılır.</p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function UsernameForm({ username }: { username: string }) {
  const [value, setValue] = useState(username);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(undefined);
      const result = await changeUsername(value);
      if (!result.ok) return setError(result.error);
      setValue(result.username);
      router.refresh();
      toast.success("Kullanıcı adın güncellendi.");
    });
  };

  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">@</span>
          <Input
            aria-label="Kullanıcı adı"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase())}
            maxLength={20}
            className="pl-7"
          />
        </div>
        <Button type="submit" disabled={pending || value.trim() === username}>
          {pending && <Loader2 className="animate-spin" />}
          Kaydet
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        3–20 karakter; küçük harf, rakam ve alt çizgi. Profil adresin de değişir; giriş yaparken yeni adı kullanırsın.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}

export function PrivacyForm({ isPrivate }: { isPrivate: boolean }) {
  // Flips at once; put back if saving fails
  const [checked, setChecked] = useState(isPrivate);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (next: boolean) => {
    // Outside the transition, so the box flips before the save finishes
    setChecked(next);
    startTransition(async () => {
      const result = await setProfilePrivate(next);
      if (!result.ok) {
        setChecked(!next);
        return void toast.error(result.error);
      }
      router.refresh();
      toast.success(next ? "Profilin artık gizli." : "Profilin artık herkese açık.");
    });
  };

  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
        className="accent-primary mt-1 size-4"
      />
      <span className="space-y-1">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Lock className="size-4" />
          Profilimi gizle
        </span>
        <span className="text-muted-foreground block text-sm">
          Profilindeki izleme süreleri, listeler ve yorum geçmişi yalnızca sana görünür. Bölüm ve film sayfalarına
          yazdığın yorumlar ve topluluk istatistiklerine katkın (isimsiz) görünmeye devam eder.
        </span>
      </span>
    </label>
  );
}
