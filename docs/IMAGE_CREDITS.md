# PlantAI — Image Credits & Sources

> **Created:** 2026-11-15 (real-plant-imagery implementation session).
> **Rule:** every third-party image used by the app is recorded here with its
> license and source, and the same attribution is rendered in the UI
> (`src/lib/plant-images.ts` constants are the single source of truth in code).
> Images were verified via the MediaWiki `imageinfo`/`extmetadata` API on
> 2026-11-15 before download; thumbnails are 960px Wikimedia renders stored
> locally in `public/plants/` (no hotlinking, no private API keys, no custom
> image-fetch endpoint).

## Species photographs (public/plants/*.jpg)

All ten are the lead photographs of the species' English Wikipedia articles
(hosted on Wikimedia Commons). Database `plant_library.image_url` — when the
owner later sets it — always wins over these fallbacks; these entries never
overwrite or replace DB data.

| Local file | Species | Commons file (full license/author record) | Author | License |
|---|---|---|---|---|
| `monstera-deliciosa.jpg` | Monstera deliciosa | [File:Monstera deliciosa2.jpg](https://commons.wikimedia.org/wiki/File:Monstera_deliciosa2.jpg) | not machine-readable — see file page | CC BY-SA 3.0 |
| `epipremnum-aureum.jpg` | Epipremnum aureum | [File:Money Plant (Epipremnum aureum) 4.jpg](https://commons.wikimedia.org/wiki/File:Money_Plant_(Epipremnum_aureum)_4.jpg) | Mokkie | CC BY-SA 3.0 |
| `dracaena-trifasciata.jpg` | Dracaena trifasciata | [File:Snake Plant (Sansevieria trifasciata 'Laurentii').jpg](https://commons.wikimedia.org/wiki/File:Snake_Plant_(Sansevieria_trifasciata_%27Laurentii%27).jpg) | Mokkie | CC BY-SA 3.0 |
| `zamioculcas-zamiifolia.jpg` | Zamioculcas zamiifolia | [File:Zamioculcas zamiifolia 1.jpg](https://commons.wikimedia.org/wiki/File:Zamioculcas_zamiifolia_1.jpg) | User:WeFt | CC BY-SA 3.0 |
| `spathiphyllum-wallisii.jpg` | Spathiphyllum (peace lily) | [File:Peace lily - 1 - cropped.jpg](https://commons.wikimedia.org/wiki/File:Peace_lily_-_1_-_cropped.jpg) | W.carter | CC BY-SA 4.0 |
| `philodendron-hederaceum.jpg` | Philodendron hederaceum | [File:Philodendron scandens subsp oxycardium2.jpg](https://commons.wikimedia.org/wiki/File:Philodendron_scandens_subsp_oxycardium2.jpg) | KENPEI | CC BY-SA 3.0 |
| `ficus-lyrata.jpg` | Ficus lyrata | [File:Starr 031108-0130 Ficus lyrata.jpg](https://commons.wikimedia.org/wiki/File:Starr_031108-0130_Ficus_lyrata.jpg) | Forest & Kim Starr (Plants of Hawaii, hear.org) | CC BY 3.0 |
| `aloe-vera.jpg` | Aloe vera | [File:Aloe Vera houseplant.jpg](https://commons.wikimedia.org/wiki/File:Aloe_Vera_houseplant.jpg) | PilotChicago | CC BY-SA 4.0 |
| `crassula-ovata.jpg` | Crassula ovata | [File:Crassula ovata 700.jpg](https://commons.wikimedia.org/wiki/File:Crassula_ovata_700.jpg) | sannse (original on English Wikipedia) | CC BY-SA 3.0 |
| `ficus-elastica.jpg` | Ficus elastica | [File:Ficus elastica leaves 02.JPG](https://commons.wikimedia.org/wiki/File:Ficus_elastica_leaves_02.JPG) | B.navez | CC BY-SA 3.0 |

**License compliance notes (CC BY-SA 3.0/4.0, CC BY 3.0):**
- Attribution is rendered in the UI wherever an image is displayed: credit +
  author under the plant-detail photo, and via the image `alt`/`title` +
  detail-page credit link for cards. The full record lives in this file.
- Share-alike: PlantAI's own modifications of these photos are none (downloaded
  thumbnails are displayed unmodified at reduced display size), so the
  adapter/page adaptation is separate from the licensed photo itself; the
  photos are distributed under their original licenses with attribution above.
- Wikimedia redirect/UWM tracking parameters (`utm_*`) were stripped from the
  download URLs.

## Original PlantAI artwork (no third-party license)

| Local file | Purpose |
|---|---|
| `public/plants/placeholder.svg` | Graceful fallback when a species has no verified photograph. Deliberately an **illustration**, never passed off as a photo of the species. |
| `public/icon.svg` | App icon / PWA icon. |

## Pl@ntNet attribution (pre-existing, preserved)

- `PlanteNetAttribution` component continues to render the required Pl@ntNet
  service attribution on identify results and plant-detail pages.
- CC BY-SA enforcement for upstream Pl@ntNet result images is unchanged
  (`src/lib/plantnet/normalize.ts` mapImage: license must be the documented
  reusable CC BY-SA AND an author present, else the image is not displayed).
- Camera-captured user photos are the user's own content; they are never mixed
  into official species imagery, never written to `plant_library`, and never
  stored in the app at all (mock mode + persistence OFF).
