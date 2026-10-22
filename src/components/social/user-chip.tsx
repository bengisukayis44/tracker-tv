import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Avatar and @name linking to the profile. */
export function UserChip({
  user,
  detail,
  children,
}: {
  user: { username: string; avatarUrl: string | null };
  detail?: string;
  /** e.g. a follow button */
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-3">
      <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="hover:text-primary block truncate font-semibold">@{user.username}</span>
          {detail && <span className="text-muted-foreground block truncate text-xs">{detail}</span>}
        </span>
      </Link>
      {children}
    </div>
  );
}
