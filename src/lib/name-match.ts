/** Lower case without accents or dotted/dotless i differences, so "Şükrü" and "sukru" compare equal. */
function fold(text: string) {
  return text.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Whether every word of the query starts some word of the name: "cumber" and "benedict c" match "Benedict Cumberbatch". */
export function nameMatches(name: string, query: string) {
  const words = fold(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const parts = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => words.some((w) => w.startsWith(p)));
}
