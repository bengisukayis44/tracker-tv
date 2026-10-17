import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Faz 1 placeholder; "İzlemeye devam et", "Daha sonra izle" and trends arrive in Faz 5
export default async function HomePage() {
  const session = await auth();

  return (
    <section className="mx-auto max-w-2xl space-y-6 py-12 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {session ? `Hoş geldin, @${session.user.username}` : "İzlediklerini takip et"}
      </h1>
      <p className="text-muted-foreground">
        Dizi ve filmlerini takip et, bölümleri puanla, hislerini kaydet ve spoiler korumalı yorumları oku.
      </p>
      <form action="/search" role="search" className="mx-auto flex max-w-lg gap-2">
        <Input name="q" placeholder="Bir dizi ara… (ör. Sherlock)" aria-label="Dizi ara" className="h-10" />
        <Button type="submit" size="lg" className="h-10">
          Ara
        </Button>
      </form>
      {!session && (
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
