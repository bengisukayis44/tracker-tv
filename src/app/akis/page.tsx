import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Rss, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/social/feed-list";
import { FollowButton } from "@/components/social/follow-button";
import { UserChip } from "@/components/social/user-chip";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, getSuggestedUsers } from "@/lib/social";

export const metadata: Metadata = { title: "Akış" };

/** What the people you follow watched and wrote lately, plus people to follow. */
export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/akis")}`);

  const [feed, suggested] = await Promise.all([getFeed(user.id), getSuggestedUsers(user.id)]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Akış</h1>
        <p className="text-muted-foreground text-sm">
          {feed.following === 0
            ? "Takip ettiğin kişilerin izledikleri ve yorumları burada görünür."
            : `Takip ettiğin ${feed.following} kişinin son 60 gündeki izlemeleri ve yorumları.`}
        </p>
      </div>

      {feed.items.length > 0 ? (
        <FeedList items={feed.items} />
      ) : (
        <EmptyState
          icon={<Rss />}
          title={feed.following === 0 ? "Henüz kimseyi takip etmiyorsun" : "Akış şimdilik sessiz"}
          text={
            feed.following === 0
              ? "Yorumlardaki kullanıcı adlarına tıklayıp profillerinden ya da aşağıdan birilerini takip edebilirsin."
              : "Takip ettiklerin bir şey izleyip yorum yazdıkça burada göreceksin."
          }
        />
      )}

      {suggested.length > 0 && (
        <section aria-labelledby="suggested-heading" className="space-y-3">
          <h2 id="suggested-heading" className="inline-flex items-center gap-2 text-lg font-bold">
            <Users className="size-5" />
            Önerilen kişiler
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggested.map((s) => (
              <UserChip key={s.username} user={s} detail={`Son 30 günde ${s.activity} izleme`}>
                <FollowButton userId={s.id} username={s.username} isFollowing={false} signedIn size="sm" />
              </UserChip>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
