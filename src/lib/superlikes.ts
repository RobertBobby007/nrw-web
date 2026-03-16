export type SuperlikePack = {
  id: string;
  credits: number;
  amountCents: number;
  currency: "czk";
  label: string;
};

export const SUPERLIKE_PACKS: SuperlikePack[] = [
  { id: "superlike_starter", credits: 3, amountCents: 4900, currency: "czk", label: "Starter 3x" },
  { id: "superlike_plus", credits: 10, amountCents: 12900, currency: "czk", label: "Plus 10x" },
  { id: "superlike_pro", credits: 25, amountCents: 24900, currency: "czk", label: "Pro 25x" },
];

export function findSuperlikePack(packId: string) {
  return SUPERLIKE_PACKS.find((pack) => pack.id === packId) ?? null;
}
