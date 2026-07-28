"use client";

import { useState } from "react";

export function PortfolioProjectCover({
  sources,
  alt,
  priority = false,
}: {
  sources: string[];
  alt: string;
  priority?: boolean;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];

  if (!source) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="h-full w-full bg-[radial-gradient(circle_at_72%_18%,rgba(247,66,17,.75),transparent_32%),linear-gradient(145deg,#25211f,#0e0e0d_70%)]"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary manual cover URLs need runtime fallback
    <img
      src={source}
      alt={alt}
      width={1440}
      height={960}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="h-full w-full object-cover object-top"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}
