IMAGES — WHAT TO DROP IN HERE
==============================

Placeholder slots in the site. Replace each file with a real image (keep
filenames the same so nothing else needs updating).

REQUIRED
--------
hero-bg.jpg        Background for the hero section. Dark, atmospheric — a
                   moody shot of the deli interior, fresh food styled on
                   a slate board, or steam off a coffee. The site will
                   overlay it at ~18% opacity, so detail doesn't matter
                   as much as mood. Landscape, min 1920x1080.

og-image.jpg       The preview image shown when the site is shared on
                   Facebook / WhatsApp / iMessage etc. Bright, clear hero
                   shot — a loaded sandwich or the shopfront. 1200x630
                   exactly (Open Graph standard).

favicon.svg        Tiny browser-tab icon. A simple monogram or the "D"
                   from the logo works best.

OPTIONAL — IMPROVES THE SITE
----------------------------
about.jpg          Used in the About section (portrait, 4:5 aspect ratio).
                   Hands making a sandwich, or the deli counter angle.

wholesale.jpg     Used in the Wholesale section (1:1 square).
                   Styled sandwich platter, overhead.

gallery/
  gallery-01.jpg   Hero sandwich cross-section
  gallery-02.jpg   Salad bar overhead
  gallery-03.jpg   Hot food in a bowl
  gallery-04.jpg   Deli counter closeup
  gallery-05.jpg   Takeaway coffee
  gallery-06.jpg   Sweet treats / cakes
  gallery-07.jpg   Staff portrait
  gallery-08.jpg   Shopfront

ONCE YOU HAVE REAL IMAGES
-------------------------
In index.html, replace each <div class="image-placeholder" ...> with an
actual <img> tag, e.g.:
    <img src="assets/images/about.jpg" alt="Making a fresh sandwich at The Deli Depot" />

Keep the alt text descriptive — it matters for accessibility and SEO.

COMPRESSION TIP
---------------
Before uploading, run images through https://squoosh.app (free) to get
file size down. Aim for under 300KB per image. The site will feel much
snappier, especially on mobile.
