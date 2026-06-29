import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { insytBrand } from "@/lib/brand";

export function BrandLogo({
  className,
  href = "/dashboard",
  showProduct = true,
  variant = "default",
}: {
  className?: string;
  href?: string;
  showProduct?: boolean;
  variant?: "default" | "light" | "mark";
}) {
  // As variantes "light" e "mark" aparecem sobre fundos escuros (login, sidebar),
  // por isso usam o logo com o wordmark em branco.
  const logoSrc =
    variant === "light" || variant === "mark"
      ? insytBrand.logoLight
      : insytBrand.logo;

  const content =
    variant === "mark" ? (
      <Image
        src={logoSrc}
        alt="INSYT"
        width={36}
        height={28}
        className="h-7 w-auto"
        priority
      />
    ) : (
      <div className={cn("flex items-center gap-3", className)}>
        <Image
          src={logoSrc}
          alt="INSYT"
          width={120}
          height={32}
          className="h-8 w-auto"
          priority
        />
        {showProduct ? (
          <div className="hidden border-l border-current/15 pl-3 sm:block">
            <p
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.18em]",
                variant === "light" ? "text-white/70" : "text-[var(--insyt-muted)]",
              )}
            >
              {insytBrand.product}
            </p>
          </div>
        ) : null}
      </div>
    );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}
