import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { insytBrand } from "@/lib/brand";

type BrandLogoVariant = "default" | "light" | "mark" | "horizontal" | "horizontal-light";

// Proporções reais dos arquivos, para o Next reservar o espaço certo e não
// causar deslocamento de layout enquanto a imagem carrega.
const LOGO_SPECS = {
  default: { src: insytBrand.logo, width: 120, height: 92 },
  light: { src: insytBrand.logoLight, width: 120, height: 92 },
  mark: { src: insytBrand.logoLight, width: 36, height: 28 },
  horizontal: { src: insytBrand.logoHorizontal, width: 228, height: 64 },
  "horizontal-light": {
    src: insytBrand.logoHorizontalLight,
    width: 228,
    height: 64,
  },
} as const satisfies Record<
  BrandLogoVariant,
  { src: string; width: number; height: number }
>;

export function BrandLogo({
  className,
  href = "/dashboard",
  showProduct = true,
  variant = "default",
}: {
  className?: string;
  href?: string;
  showProduct?: boolean;
  variant?: BrandLogoVariant;
}) {
  const spec = LOGO_SPECS[variant];
  const isHorizontal =
    variant === "horizontal" || variant === "horizontal-light";
  const isOnDark = variant === "light" || variant === "horizontal-light";

  const content =
    variant === "mark" ? (
      <Image
        src={spec.src}
        alt={insytBrand.name}
        width={spec.width}
        height={spec.height}
        className="h-7 w-auto"
        priority
      />
    ) : (
      <div className={cn("flex items-center gap-3", className)}>
        <Image
          src={spec.src}
          alt={insytBrand.name}
          width={spec.width}
          height={spec.height}
          // O lockup horizontal é mais largo que alto, então a mesma altura
          // rende um wordmark bem maior — por isso pode ser mais baixo.
          className={isHorizontal ? "h-7 w-auto" : "h-8 w-auto"}
          priority
        />
        {showProduct ? (
          <div className="hidden border-l border-current/15 pl-3 sm:block">
            <p
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.18em]",
                isOnDark ? "text-white/70" : "text-[var(--insyt-muted)]",
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
