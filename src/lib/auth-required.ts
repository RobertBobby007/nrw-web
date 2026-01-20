export type AuthRequiredDetail = {
  message?: string;
};

export function requestAuth(detail?: AuthRequiredDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthRequiredDetail>("nrw:auth_required", { detail }));
}
