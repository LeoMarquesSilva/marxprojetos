import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteReviewViewer } from "@/components/site-review-viewer";
import { fetchReviewByToken, listReviewComments } from "@/app/actions/review";
import { absoluteUrl } from "@/lib/site-url";

// Link privado de revisão: fora de buscador mesmo com o link em mãos. O
// título e a imagem são o que aparece quando o link é enviado no WhatsApp —
// as prévias de proposta trazem um og.jpg da abertura do site.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const review = await fetchReviewByToken(token);
  const robots = { index: false, follow: false };
  if (!review) return { title: "Revisão do site", robots };

  const isProposal = review.review_site_path.startsWith("proposta-");
  const name = review.title.replace(/^Proposta\s*[—-]\s*/, "");
  const title = isProposal ? `Prévia do novo site — ${name}` : `Revisão do site — ${name}`;
  const description = isProposal
    ? "Prévia criada pela INSYT. Navegue e comente direto na página."
    : "Navegue pelo site e deixe seus comentários direto na página.";

  return {
    title,
    description,
    robots,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      ...(isProposal
        ? {
            images: [
              {
                url: absoluteUrl(`/sites/${review.review_site_path}/og.jpg`),
                width: 1200,
                height: 630,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function SiteReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const review = await fetchReviewByToken(token);

  if (!review) notFound();

  const comments = await listReviewComments(token);

  return (
    <SiteReviewViewer
      token={token}
      sitePath={review.review_site_path}
      title={review.title}
      availableSince={review.review_enabled_at}
      initialApprovedAt={review.review_approved_at}
      initialComments={comments}
    />
  );
}
