import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CoverPicker } from "@/components/profile/cover-picker";
import { getCurrentUser } from "@/lib/auth";
import { coverImageUrl } from "@/lib/cover";
import { prisma } from "@/lib/prisma";
import { NotificationForm } from "./notification-form";
import { AvatarForm, PrivacyForm, UsernameForm } from "./settings-forms";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/settings")}`);
  const { isPrivate, coverPath, coverPositionY } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { isPrivate: true, coverPath: true, coverPositionY: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground text-sm">
          {user.email} ·{" "}
          <Link href={`/profile/${user.username}`} className="hover:text-foreground underline underline-offset-2">
            Profilini gör
          </Link>
        </p>
      </div>

      <Card title="Profil fotoğrafı">
        <AvatarForm username={user.username} avatarUrl={user.avatarUrl} />
      </Card>
      <Card title="Profil kapağı">
        <div className="space-y-3">
          {coverPath ? (
            <div className="bg-muted relative aspect-[3/1] overflow-hidden rounded-xl border">
              <Image
                src={coverImageUrl(coverPath)}
                alt="Profil kapağın"
                fill
                unoptimized
                className="object-cover"
                style={{ objectPosition: `50% ${coverPositionY}%` }}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              İzlediğin bir dizi ya da filmden bir sahne seç; profilinin üstünde görünür.
            </p>
          )}
          <CoverPicker hasCover={Boolean(coverPath)} />
        </div>
      </Card>
      <Card title="Kullanıcı adı">
        <UsernameForm username={user.username} />
      </Card>
      <Card title="Gizlilik">
        <PrivacyForm isPrivate={isPrivate} />
      </Card>
      <Card title="Bildirimler">
        <NotificationForm />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="bg-card space-y-4 rounded-2xl border p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
