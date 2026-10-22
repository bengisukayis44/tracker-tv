"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { setFollowing } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { useLoginRedirect } from "@/components/watch/use-login-redirect";

/** "Takip et" / "Takip ediliyor" on someone else's profile. */
export function FollowButton({
  userId,
  username,
  isFollowing,
  signedIn,
  size = "default",
}: {
  userId: string;
  username: string;
  isFollowing: boolean;
  signedIn: boolean;
  size?: "default" | "sm";
}) {
  const [following, setFollowingState] = useState(isFollowing);
  const [pending, startTransition] = useTransition();
  const goToLogin = useLoginRedirect();
  const router = useRouter();

  const toggle = () => {
    if (!signedIn) return goToLogin();
    const next = !following;
    setFollowingState(next);
    startTransition(async () => {
      const result = await setFollowing(userId, next);
      if (!result.ok) {
        setFollowingState(!next);
        return void toast.error(result.error);
      }
      router.refresh();
      toast.success(next ? `@${username} takip ediliyor.` : `@${username} takipten çıkarıldı.`);
    });
  };

  return (
    <Button
      size={size}
      variant={following ? "secondary" : "default"}
      aria-pressed={following}
      aria-label={following ? `@${username} takipten çık` : `@${username} takip et`}
      onClick={toggle}
      disabled={pending}
    >
      {following ? <UserCheck /> : <UserPlus />}
      {following ? "Takip ediliyor" : "Takip et"}
    </Button>
  );
}
