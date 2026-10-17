export function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bg-card mx-auto max-w-md space-y-2 rounded-2xl border p-10 text-center">
      <div className="text-muted-foreground mx-auto flex justify-center [&_svg]:size-10">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
