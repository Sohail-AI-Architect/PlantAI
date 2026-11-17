import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MarkdownLite } from "@/components/blog/markdown-lite";
import { JsonLd } from "@/components/seo/json-ld";

/*
 * /blog/[slug] — completed MVP slice: a real published article from
 * blog_posts (RLS: public read of `status='published'` only).
 *
 * BLOCKING route (`instant = false`) so unknown slugs return a real 404
 * status (same documented decision as /plant/[slug]). generateMetadata uses
 * the post's own SEO fields (fallbacks: title / excerpt) — per-species and
 * per-article metadata, never a shared generic title (SEO_STRATEGY.md §4).
 */
export const instant = false;

/** Absolute base for JSON-LD item URLs (Google requires absolute URLs). */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface PostRow {
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_image_url: string | null;
  cover_image_credit: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
}

async function loadPost(slug: string): Promise<PostRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(
      "slug, title, excerpt, content_md, cover_image_url, cover_image_credit, published_at, reading_minutes, seo_title, seo_description"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as PostRow) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Article not found" };

  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? post.excerpt ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            {
              "@type": "ListItem",
              position: 2,
              name: "Blog",
              item: `${siteUrl}/blog`,
            },
            { "@type": "ListItem", position: 3, name: post.title },
          ],
        }}
      />
      <nav aria-label="Breadcrumb" className="text-foreground-muted text-xs">
        <Link href="/" className="hover:text-foreground underline">
          Home
        </Link>{" "}
        ›{" "}
        <Link href="/blog" className="hover:text-foreground underline">
          Blog
        </Link>{" "}
        › <span aria-current="page">{post.title}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        <p className="text-foreground-muted mt-2 flex flex-wrap gap-x-3 text-xs">
          {post.published_at && (
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString("en", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
          {post.reading_minutes !== null && (
            <span>{post.reading_minutes} min read</span>
          )}
        </p>
      </header>

      {post.cover_image_url && (
        <figure className="mt-6">
          <div className="border-border-muted bg-surface-muted relative aspect-[16/9] overflow-hidden rounded-xl border">
            <Image
              src={post.cover_image_url}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
            />
          </div>
          {post.cover_image_credit && (
            <figcaption className="text-foreground-muted mt-2 text-xs">
              {post.cover_image_credit}
            </figcaption>
          )}
        </figure>
      )}

      <div className="text-foreground mt-8">
        <MarkdownLite source={post.content_md} />
      </div>

      <p className="text-foreground-muted border-border-muted mt-10 border-t pt-4 text-xs leading-relaxed">
        Plant care guidance here is general education, not a diagnosis for a
        specific ailing plant. Identification questions? Try the{" "}
        <Link href="/identify" className="underline hover:text-foreground">
          identify tool
        </Link>
        .
      </p>
    </article>
  );
}
