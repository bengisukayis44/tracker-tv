/** Emotions a viewer can attach to an episode (Prisma enum `Emotion`), in display order. */
export const EMOTIONS = [
  { value: "HUZUNLU", label: "Hüzünlü", emoji: "😢" },
  { value: "MUTLU", label: "Mutlu", emoji: "😊" },
  { value: "HEYECANLI", label: "Heyecanlı", emoji: "🤩" },
  { value: "GERGIN", label: "Gergin", emoji: "😬" },
  { value: "KORKMUS", label: "Korkmuş", emoji: "😱" },
  { value: "SASKIN", label: "Şaşkın", emoji: "😮" },
  { value: "SINIRLI", label: "Sinirli", emoji: "😠" },
  { value: "DUYGULANMIS", label: "Duygulanmış", emoji: "🥹" },
  { value: "SIKILMIS", label: "Sıkılmış", emoji: "🥱" },
  { value: "EGLENMIS", label: "Eğlenmiş", emoji: "😂" },
] as const;

export type EmotionValue = (typeof EMOTIONS)[number]["value"];

export const EMOTION_VALUES = EMOTIONS.map((e) => e.value) as [EmotionValue, ...EmotionValue[]];

export function emotionMeta(value: string) {
  return EMOTIONS.find((e) => e.value === value);
}
