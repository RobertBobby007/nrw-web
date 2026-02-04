"use client";

import { useEffect } from "react";

export function HydrationFlag() {
  useEffect(() => {
    (window as { __nrw_hydrated?: boolean }).__nrw_hydrated = true;
  }, []);

  return null;
}
