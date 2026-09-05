export const FRUITS_OF_THE_DAY = ["mango", "apple", "orange", "guava", "banana", "pomegranate", "grapes"] as const;
export type FruitOfTheDay = typeof FRUITS_OF_THE_DAY[number];

export function getFruitOfTheDay(date = new Date()): FruitOfTheDay {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  let hash = 0;
  for (const character of local) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return FRUITS_OF_THE_DAY[hash % FRUITS_OF_THE_DAY.length];
}
