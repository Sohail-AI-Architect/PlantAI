import Link from "next/link";

/*
 * Homepage care fundamentals — original, human-written educational content.
 *
 * Rendered on the public homepage so visitors get practical guidance even
 * before they identify a plant. Every statement is general indoor-plant
 * education (not a diagnosis), and the section links back to the library,
 * the identify tool and the About page. Anchor ids are also used by the
 * header/library "Care basics" links.
 */

const CARE_SECTIONS = [
  { id: "watering", label: "Watering" },
  { id: "light", label: "Light" },
  { id: "potting-mix", label: "Soil & drainage" },
  { id: "feeding", label: "Feeding" },
  { id: "problems", label: "Common problems" },
] as const;

const PROBLEMS = [
  {
    symptom: "Yellowing lower leaves",
    likely: "Usually too much water or soil that never drains properly. Older leaves do also yellow and drop naturally.",
    fix: "Let the top third of the pot dry out, empty the saucer, and check the drainage hole. Pick off the soggy leaves and skip feeding until you see new growth.",
  },
  {
    symptom: "Crisp brown leaf edges",
    likely: "Dry soil, dry air, or fertilizer salts building up in the pot.",
    fix: "Water slowly until it runs out of the bottom, then flush once more with plain water. Move the plant away from radiators, heaters and draughty doors.",
  },
  {
    symptom: "Wilting even though the soil is wet",
    likely: "Roots damaged by waterlogging, or a pot that has been baking in direct sun.",
    fix: "Stop watering and lift the root ball out to look. If the roots are brown and soft, cut away the mushy parts and repot in fresh, airy mix. Move it somewhere cooler and brighter but out of harsh sun.",
  },
  {
    symptom: "Long, pale, stretched-out stems",
    likely: "Not enough light. The plant is reaching for the nearest window.",
    fix: "Move it closer to brighter light and turn the pot each week. In spring, trim the weakest stems back to encourage a fuller shape.",
  },
  {
    symptom: "Sticky leaves or fine webbing",
    likely: "Aphids, scale, mealybugs or spider mites feeding on the sap.",
    fix: "Keep the plant away from the others, wipe both sides of the leaves, and treat with insecticidal soap or a houseplant pest treatment. Repeat weekly until you stop seeing them.",
  },
  {
    symptom: "Little flies around the soil",
    likely: "Fungus gnats, which lay eggs in potting mix that stays damp.",
    fix: "Let the surface dry out between waterings and improve airflow. Yellow sticky traps catch the adults; if they keep coming back, repot into fresh mix.",
  },
  {
    symptom: "White crust on the soil or pot rim",
    likely: "Minerals from tap water and fertilizer left behind as the soil dries.",
    fix: "Scrape off the crust and flush the pot with plenty of plain water. Use a weaker fertilizer mix, and repot if the crust returns quickly.",
  },
];

export function CareBasics() {
  return (
    <section
      id="care-basics"
      aria-labelledby="care-basics-heading"
      className="border-border-muted bg-surface border-y"
    >
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-brand-700 text-xs font-semibold uppercase tracking-wide">
          Indoor plant care basics
        </p>
        <h2
          id="care-basics-heading"
          className="mt-2 text-3xl font-bold tracking-tight"
        >
          Keep your plants healthy, one habit at a time
        </h2>
        <p className="text-foreground-muted mt-3 max-w-3xl text-base leading-relaxed">
          Houseplants rarely fail for mysterious reasons. Most of the time it
          comes down to watering — usually too much of it — followed by light,
          soil and feeding. The advice below is what actually matters from week
          to week. Treat it as a starting point rather than a rulebook; your
          room, your pot and your plant will tell you what needs adjusting.
        </p>
        <p className="text-foreground-muted mt-2 text-xs">
          Written by the PlantAI editorial team · Reviewed 23 November 2026
        </p>

        <nav
          aria-label="Care guide sections"
          className="border-border-muted mt-6 flex flex-wrap gap-2 border-y py-3"
        >
          {CARE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="border-border-muted bg-surface-muted hover:border-brand-300 hover:text-brand-800 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              {section.label}
            </a>
          ))}
          <Link
            href="/library"
            className="text-brand-700 hover:text-brand-800 px-2 py-1.5 text-xs font-semibold underline"
          >
            Browse plant-specific guides →
          </Link>
        </nav>

        <div className="mt-10 space-y-12">
          <article id="watering" className="scroll-mt-24">
            <h3 className="text-xl font-bold tracking-tight">
              1. Watering: how often, how much, and avoiding root rot
            </h3>
            <p className="text-foreground-muted mt-3 leading-relaxed">
              There is no watering schedule that works for every plant. A small
              terracotta pot on a sunny sill can dry out in three days; a large
              plastic pot in a shaded corner might stay damp for two weeks. The
              only reliable test is the soil itself, so get used to sticking a
              finger into the top few centimetres before you reach for the
              watering can.
            </p>
            <h4 className="mt-5 font-semibold">What works</h4>
            <ul className="text-foreground-muted mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
              <li>
                Water when the top 2–3 cm feels dry. If it is still cool and
                damp, come back in a day or two.
              </li>
              <li>
                Give the pot a proper soak, not a token splash. Water until a
                little comes out of the drainage hole, so the lower roots get
                wet too.
              </li>
              <li>
                Tip away anything left in the saucer after 15 minutes. Roots
                that sit in water are the quickest way to lose a plant.
              </li>
              <li>
                Morning is the easiest time to water. Any splashes on the leaves
                have the day to dry off.
              </li>
              <li>
                Ease off in winter. Most houseplants are barely growing then and
                need much less water, not more.
              </li>
            </ul>
            <p className="border-brand-200 bg-brand-50 text-foreground mt-5 rounded-r-lg border-l-4 px-4 py-3 text-sm leading-relaxed">
              If you are unsure, wait. A plant that dries out for a few extra
              days usually recovers. One that has been sitting wet for a
              fortnight often does not.
            </p>
            <h4 className="mt-5 font-semibold">
              Too much water, or not enough?
            </h4>
            <p className="text-foreground-muted mt-2 leading-relaxed">
              Overwatering tends to show up as yellow lower leaves, soft stems,
              mould on the soil, fungus gnats or a sour smell from the pot.
              Underwatering looks different: dry, papery leaf edges, curling
              leaves, and soil that has shrunk away from the sides. Both can
              make a plant wilt, which is why the soil check matters more than
              the way the leaves look.
            </p>
            <p className="text-foreground-muted mt-3 leading-relaxed">
              If you suspect root rot, take the plant out of its pot and look at
              the roots. Healthy ones are firm and pale. Rotten ones are brown,
              soft and often smell bad. Cut the damaged roots off with clean
              scissors, repot into fresh, free-draining mix, and go easy on the
              water until new growth starts. A pot with a hole in the bottom and
              an airy mix will prevent most of this before it begins.
            </p>
          </article>

          <article id="light" className="scroll-mt-24">
            <h3 className="text-xl font-bold tracking-tight">
              2. Light: bright indirect, low light and direct sun
            </h3>
            <p className="text-foreground-muted mt-3 leading-relaxed">
              Light is what a plant uses to make new leaves, so it is worth
              getting right before you worry about anything else. Most foliage
              houseplants want <strong>bright indirect light</strong>: close to
              a window, but out of the fierce midday beam. If you can sit there
              and read a book comfortably during the day, it is probably about
              right.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="border-border-muted bg-surface-muted rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Bright indirect</h4>
                <p className="text-foreground-muted mt-1 text-sm leading-relaxed">
                  Near a window with a sheer curtain, or a few feet back from a
                  sunny one. Monstera, pothos, philodendron and most ferns are
                  happy here.
                </p>
              </div>
              <div className="border-border-muted bg-surface-muted rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Low light</h4>
                <p className="text-foreground-muted mt-1 text-sm leading-relaxed">
                  A north-facing window or a spot well back from the light.
                  Snake plants and ZZ plants cope, but they will grow slowly and
                  should not be watered often.
                </p>
              </div>
              <div className="border-border-muted bg-surface-muted rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Direct sun</h4>
                <p className="text-foreground-muted mt-1 text-sm leading-relaxed">
                  Full sun through glass, which suits succulents and some
                  flowering plants but scorches many foliage plants, especially
                  in summer.
                </p>
              </div>
            </div>
            <h4 className="mt-5 font-semibold">What the plant is telling you</h4>
            <ul className="text-foreground-muted mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
              <li>
                Stretched stems, big gaps between leaves and pale growth mean it
                is reaching for more light.
              </li>
              <li>
                Bleached patches, brown scorch marks or leaves that feel hot
                mean it is getting too much direct sun.
              </li>
              <li>
                Steady growth and a reasonably compact shape mean the spot is
                working.
              </li>
            </ul>
            <p className="text-foreground-muted mt-4 leading-relaxed">
              Turn the pot a quarter turn every week or so, otherwise one side
              will grow leggy while the other sulks. When you move a plant to a
              brighter spot, do it gradually over a week or two. Leaves grown in
              shade burn easily when they are suddenly pushed into full sun.
            </p>
          </article>

          <article id="potting-mix" className="scroll-mt-24">
            <h3 className="text-xl font-bold tracking-tight">
              3. Potting mix and drainage: give roots room to breathe
            </h3>
            <p className="text-foreground-muted mt-3 leading-relaxed">
              Garden soil does not belong in a houseplant pot. It compacts, holds
              water for far too long and leaves the roots with no air. A decent
              indoor mix is chunky and open: it holds some moisture without
              turning into mud. Most bags sold as houseplant compost are a
              reasonable start, and a handful of perlite or bark will improve
              almost any of them.
            </p>
            <ul className="text-foreground-muted mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
              <li>
                A drainage hole is not optional. A decorative outer pot is fine,
                as long as the inner pot drains and never stands in water.
              </li>
              <li>
                Coir or peat holds moisture, bark keeps the mix open, and perlite
                helps water pass through. Succulents and cacti need more grit
                and less of the moisture-holding stuff.
              </li>
              <li>
                Move up only 2–5 cm in pot diameter at a time. A pot that is far
                too big stays wet around roots that cannot use the space.
              </li>
              <li>
                Spring is the safest time to repot. Refresh the mix every year
                or two, or sooner if it has broken down and stopped draining.
              </li>
            </ul>
            <p className="text-foreground-muted mt-4 leading-relaxed">
              After watering, water should run through within a few seconds. If
              it pools on the surface or the soil stays wet for more than a
              week, the mix has had it or the pot is holding water somewhere.
              Terracotta dries out faster than glazed or plastic because the
              walls breathe. That makes it a good choice for plants you tend to
              overwater, and a poor one for ferns that like to stay damp. Pick
              the pot to suit the plant and your own habits, not just the shelf.
            </p>
          </article>

          <article id="feeding" className="scroll-mt-24">
            <h3 className="text-xl font-bold tracking-tight">
              4. Feeding: gentle, seasonal and easy to overdo
            </h3>
            <p className="text-foreground-muted mt-3 leading-relaxed">
              Fertilizer is not medicine. It supports a plant that is already
              growing well; it will not rescue one that is struggling with bad
              light, soggy soil or pests. Indoor plants also grow more slowly
              than outdoor ones, so they need far less than the bottle suggests.
              Feed while the plant is putting out new growth, usually from
              spring through early autumn, and leave it alone over winter.
            </p>
            <ul className="text-foreground-muted mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
              <li>
                Use a balanced liquid houseplant feed at half the recommended
                strength. Every two to four weeks is enough for most foliage
                plants.
              </li>
              <li>
                Water first, then feed. Fertilizer on dry roots can burn them.
              </li>
              <li>
                Skip it for a few weeks after repotting. Fresh mix already has
                nutrients in it.
              </li>
              <li>
                Flush the pot with plain water every few months to wash out the
                salts that collect near the surface.
              </li>
              <li>
                Slow-release granules are convenient, but it is easy to use too
                many in a small pot. Use less than the label says.
              </li>
            </ul>
            <p className="text-foreground-muted mt-4 leading-relaxed">
              A white crust on the soil, burnt leaf tips, unusually dark or
              distorted growth and very leggy stems can all mean too much feed.
              Stop feeding, flush the soil well, and start again at a weaker
              strength once the plant settles down.
            </p>
          </article>

          <article id="problems" className="scroll-mt-24">
            <h3 className="text-xl font-bold tracking-tight">
              5. Common indoor plant problems — and what to check first
            </h3>
            <p className="text-foreground-muted mt-3 leading-relaxed">
              Before you buy a treatment, check water, light, drainage and
              airflow. A surprising number of plant “diseases” turn out to be
              growing conditions in disguise. This table is a place to start
              when you are trying to work out what you are looking at — not a
              diagnosis.
            </p>
            <div className="border-border-muted mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      What you see
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Likely cause
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      What to try
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PROBLEMS.map((problem) => (
                    <tr
                      key={problem.symptom}
                      className="border-border-muted border-t align-top"
                    >
                      <td className="px-4 py-3 font-medium">
                        {problem.symptom}
                      </td>
                      <td className="text-foreground-muted px-4 py-3">
                        {problem.likely}
                      </td>
                      <td className="text-foreground-muted px-4 py-3">
                        {problem.fix}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-foreground-muted mt-3 text-xs leading-relaxed">
              If nothing improves after a couple of weeks, keep the plant away
              from the rest and look closely at the undersides of the leaves.
              For an expensive or unusual plant, a local grower or
              horticulturist will know your climate far better than a general
              guide can.
            </p>
          </article>

          <article id="routine" className="scroll-mt-24">
            <h3 className="text-xl font-bold tracking-tight">
              A five-minute weekly check that prevents most problems
            </h3>
            <ol className="text-foreground-muted mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed">
              <li>
                Push a finger into each pot. Water the ones that are dry at the
                top and leave the rest alone.
              </li>
              <li>
                Turn a few leaves over and look for pests, webbing or sticky
                patches.
              </li>
              <li>
                Rotate the pots and pull off anything dead or yellowing.
              </li>
              <li>
                Check that saucers are empty and drainage holes are not blocked.
              </li>
              <li>
                Look for new growth. If it is there, whatever you are doing is
                working.
              </li>
            </ol>
          </article>
        </div>

        <div className="border-border-muted bg-surface-muted mt-10 rounded-xl border p-5 sm:p-6">
          <h3 className="text-lg font-bold tracking-tight">
            How identification fits into plant care
          </h3>
          <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
            PlantAI compares your photo with reference images and returns likely
            matches with confidence scores. A high score is a useful hint, not
            proof. Closely related species can look almost identical, and two
            cultivars of the same plant may want slightly different care. Use
            the result to find the right guide, then double-check anything that
            matters — especially edibility, toxicity, pets or children — with a
            qualified expert or a reliable local source.
          </p>
          <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
            Identification will not tell you why a plant is sick. If something
            is ailing, check the watering, light and drainage first, then use the{" "}
            <Link href="/identify" className="underline hover:text-foreground">
              identify tool
            </Link>{" "}
            to confirm the species and the{" "}
            <Link href="/library" className="underline hover:text-foreground">
              plant library
            </Link>{" "}
            for its particular needs. The{" "}
            <Link href="/about" className="underline hover:text-foreground">
              About page
            </Link>{" "}
            explains how Pl@ntNet processes photos and where the limits are.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/identify"
              className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              Identify a plant
            </Link>
            <Link
              href="/library"
              className="border-border-muted hover:bg-surface rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              Browse care guides
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
