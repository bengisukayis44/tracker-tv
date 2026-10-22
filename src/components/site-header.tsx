import Link from "next/link";
import { LogOut, Settings, Tv } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";
import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary border-primary/20 rounded-lg border p-2">
            <Tv className="size-4" />
          </span>
          <span className="hidden font-extrabold tracking-wide sm:inline">Tracker.tv</span>
        </Link>

        {/* Wide screens: tabs in the bar itself */}
        <SiteNav username={user?.username ?? null} className="hidden h-full lg:block" />

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full" aria-label="Hesap menüsü">
                  <Avatar>
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} />}
                    <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <span className="block font-semibold">@{user.username}</span>
                  <span className="text-muted-foreground block truncate text-xs font-normal">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Ayarlar
                  </Link>
                </DropdownMenuItem>
                <form action={logoutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut />
                      Çıkış yap
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Giriş yap</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Kayıt ol</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Narrower screens: the tabs get a row of their own under the bar */}
      <SiteNav username={user?.username ?? null} className="h-14 border-t lg:hidden" />
    </header>
  );
}
