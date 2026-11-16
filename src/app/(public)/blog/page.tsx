import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Plant care blog",
  description:
    "Practical, fact-checked plant care articles — watering mistakes, repotting basics, seasonal care and more, written to editorial standards.",
  alternates: { canonical: "/blog" },
};

/*
 * BLOCKING route (`instant = false`): the listing reads cookies via the
 * session client, so it renders on demand — same documented decision as
 * /blog/[slug] and /plant/[slug]. The database read must complete before
 * the response so a DB failure renders the honest error state, not a
 * stale shell.
 */
export const instant = false;

/*
 * /blog — completed MVP slice (FR-SEO-003 blog shell, real DB-backed).
 *
 * Lists PUBLISHED blog_posts (RLS: public read of `status='published'`
 * rows only). Uses the session client (cookie read → request-time render,
 * Cache Components), so the build never queries the database. Honest
 * states: DB failure → explicit error state; zero published posts →
 * truthful empty state (never fabricated articles).
 */

interface BlogRow {
  slug: string;
  title: string;
  excerpt: string | null;
  reading_minutes: number | null;
  cover_image_url: string | null;
}

export default async function BlogPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, reading_minutes, cover_image_url")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const posts = (data ?? []) as BlogRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Plant care blog</h1>
      <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
        Practical articles to keep your plants alive — written and
        fact-checked, never auto-generated filler.
      </p>

      {error ? (
        <p
          role="alert"
          className="border-border-muted bg-surface-muted mt-8 rounded-lg border px-4 py-6 text-sm"
        >
          Articles are temporarily unavailable — please try again shortly.
        </p>
      ) : posts.length === 0 ? (
        <div className="border-border-muted bg-surface-muted mt-8 rounded-lg border px-4 py-10 text-center">
          <p className="text-sm font-medium">No articles published yet</p>
          <p className="text-foreground-muted mt-2 text-sm">
            The first guides are being written and fact-checked. In the
            meantime, the{" "}
            <Link href="/library" className="underline hover:text-foreground">
              plant library
            </Link>{" "}
            already has practical care basics.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {posts.map((post) => (
            <li
              key={post.slug}
              className="border-border-muted bg-surface overflow-hidden rounded-xl border"
            >
              <Link href={`/blog/${post.slug}`} className="group block">
                {/* Cover thumbnail ONLY when the post actually has one in the
                    DB — never fabricated imagery (task §1). Supabase storage
                    hosts are the only allowed remote source. */}
                {post.cover_image_url && (
                  <div className="border-border-muted relative aspect-[16/9] overflow-hidden border-b">
                    <Image
                      src={post.cover_image_url}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 768px, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-semibold group-hover:underline">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                  {post.reading_minutes !== null && (
                    <p className="text-foreground-muted mt-2 text-xs">
                      {post.reading_minutes} min read
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
