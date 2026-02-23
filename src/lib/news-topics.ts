export type NewsTopicId =
  | "tech"
  | "ai"
  | "business"
  | "politics"
  | "world"
  | "science"
  | "sport"
  | "culture"
  | "lifestyle";

export type NewsTopic = {
  id: NewsTopicId;
  label: string;
  keywords: string[];
};

export const NEWS_TOPICS: NewsTopic[] = [
  { id: "tech", label: "Technologie", keywords: ["technologie", "tech", "software", "app", "startup", "digital"] },
  { id: "ai", label: "AI", keywords: ["ai", "umělá inteligence", "chatgpt", "openai", "llm", "model"] },
  { id: "business", label: "Byznys", keywords: ["byznys", "business", "ekonomika", "firma", "trh", "invest"] },
  { id: "politics", label: "Politika", keywords: ["politika", "vláda", "volby", "parlament", "senát", "prezident"] },
  { id: "world", label: "Svět", keywords: ["svět", "zahraničí", "eu", "usa", "ukrajina", "nato"] },
  { id: "science", label: "Věda", keywords: ["věda", "science", "výzkum", "studie", "vesmír", "nasa"] },
  { id: "sport", label: "Sport", keywords: ["sport", "fotbal", "hokej", "tenis", "liga", "mistrovství"] },
  { id: "culture", label: "Kultura", keywords: ["kultura", "film", "hudba", "seriál", "divadlo", "festival"] },
  { id: "lifestyle", label: "Životní styl", keywords: ["zdraví", "wellness", "cestování", "recept", "móda", "životní styl"] },
];

function normalize(text: string | null | undefined) {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
}

export function detectNewsTopics(input: {
  title?: string | null;
  excerpt?: string | null;
  sourceName?: string | null;
  url?: string | null;
}): NewsTopicId[] {
  const haystack = normalize([input.title, input.excerpt, input.sourceName, input.url].filter(Boolean).join(" "));
  const matches = NEWS_TOPICS.filter((topic) => topic.keywords.some((kw) => haystack.includes(normalize(kw))));
  return matches.map((topic) => topic.id);
}

export function topicLabel(topicId: NewsTopicId) {
  return NEWS_TOPICS.find((topic) => topic.id === topicId)?.label ?? topicId;
}
