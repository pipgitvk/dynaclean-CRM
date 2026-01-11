"use client";

import { useCallback, useRef, useState } from "react";

export function useAsyncClick(asyncHandler) {
  const inFlightRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  const wrapped = useCallback(async (...args) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      await asyncHandler(...args);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [asyncHandler]);

  return [wrapped, isLoading];
}


