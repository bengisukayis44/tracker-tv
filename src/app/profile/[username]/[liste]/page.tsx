import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/social/follow-button";
import { UserChip } from "@/components/social/user-chip";
import { getCurrentUser } from "@/lib/auth";
import { getProfileUser } from "@/lib/profile";
import { FOLLOW_LISTS, getFollowList, getFollowState, type FollowList } from "@/lib/social";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ username: string; liste: string }> };

const isFollowList = (value: string): value is FollowList => Object.hasOwn(FOLLOW_LISTS, value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, liste } = await params;
  const user = await getProfileUser(decodeURIComponent(username));
  if (!user || !isFollowList(liste)) return { title: "Sayfa bulunamadı" };
  return { title: `@${user.username} · ${FOLLOW_LISTS[liste].label}` };
}

/** Who follows a profile (/takipciler) or whom it follows (/takip-edilenler). */
export default async function FollowListPage({ params }: Props) {
  const { username, liste } = await params;
  if (!isFollowList(liste)) notFound();
  const [user, viewer] = await Promise.all([getProfileUser(decodeURIComponent(username)), getCurrentUser()]);
  if (!user) notFound();
  const isMe = viewer?.id === user.id;
  const profileHref = `/profile/${user.username}`;

  // A private profile keeps its circle to its owner, like the rest of it
  const hidden = user.isPrivate && !isMe;
  const [counts, people] = await Promise.all([
    getFollowState(user.id, null),
    hidden ? [] : getFollowList(user.id, liste, viewer?.id ?? null),
  ]);
  const count = { takipciler: counts.followers, "takip-edilenler": counts.following };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link
          href={profileHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />@{user.username}
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">{FOLLOW_LISTS[liste].label}</h1>
      </div>

      <nav aria-label="Takip listeleri" className="flex gap-1 border-b pb-px">
        {(Object.keys(FOLLOW_LISTS) as FollowList[]).map((key) => (
          <Link
            key={key}
            href={`${profileHref}/${key}`}
            aria-current={key === liste ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
              key === liste
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {FOLLOW_LISTS[key].label} <span className="text-muted-foreground font-normal">{count[key]}</span>
          </Link>
        ))}
      </nav>

      {hidden ? (
        <EmptyState
          icon={<Lock />}
          title="Bu profil gizli"
          text={`@${user.username} takip listelerini yalnızca kendisi görebiliyor.`}
        />
      ) : people.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={FOLLOW_LISTS[liste].empty}
          text={
            liste === "takipciler"
              ? `@${user.username} profilini takip edenler burada görünür.`
              : `@${user.username} birini takip ettiğinde burada görünür.`
          }
        />
      ) : (
        <ul aria-label={FOLLOW_LISTS[liste].label} className="grid gap-2 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id}>
              <UserChip user={p}>
                {/* Private profiles cannot be followed, and nobody follows themselves */}
                {p.id !== viewer?.id && (!p.isPrivate || p.isFollowing) && (
                  <FollowButton
                    userId={p.id}
                    username={p.username}
                    isFollowing={p.isFollowing}
                    signedIn={viewer !== null}
                    size="sm"
                  />
                )}
              </UserChip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
