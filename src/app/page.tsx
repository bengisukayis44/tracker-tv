import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Faz 1 placeholder; "İzlemeye devam et", "Daha sonra izle" and trends arrive in Faz 5
export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <section className="mx-auto max-w-2xl space-y-6 py-12 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {user ? `Hoş geldin, @${user.username}` : "İzlediklerini takip et"}
      </h1>
      <p className="text-muted-foreground">
        Dizi ve filmlerini takip et, bölümleri puanla, hislerini kaydet ve spoiler korumalı yorumları oku.
      </p>
      <form action="/search" role="search" className="mx-auto flex max-w-lg gap-2">
        <Input
          name="q"
          placeholder="Bir dizi ya da film ara… (ör. Sherlock)"
          aria-label="Dizi ya da film ara"
          className="h-10"
        />
        <Button type="submit" size="lg" className="h-10">
          Ara
        </Button>
      </form>
      {!user && (
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Hemen başla</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Giriş yap</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
