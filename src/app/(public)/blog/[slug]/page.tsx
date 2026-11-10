import { Suspense } from "react";
import type { Metadata } from "next";
import { RouteStub } from "@/components/layout/route-stub";

export const metadata: Metadata = { title: "Blog article" };

/*
 * /blog/[slug] — canonical dynamic route stub. Real articles in Phase 4+.
 *
 * Next 16 note (Cache Components): accessing `params` during prerender
 * blocks the static shell. The slug read is streamed inside <Suspense>,
 * matching the "stream" recommendation from the Next 16 prerender error.
 */
async function SlugNote({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <RouteStub
      title="Blog article"
      phase="Phase 4+"
      description={`The article /blog/${slug} will render from the blog content system once publishing starts in Phase 4.`}
    />
  );
}

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <RouteStub
          title="Blog article"
          phase="Phase 4+"
          description="Articles publish here from Phase 4 onward."
        />
      }
    >
      <SlugNote params={params} />
    </Suspense>
  );
}
