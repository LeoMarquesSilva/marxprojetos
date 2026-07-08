import { notFound } from "next/navigation";
import { SiteReviewViewer } from "@/components/site-review-viewer";
import { fetchReviewByToken, listReviewComments } from "@/app/actions/review";

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
