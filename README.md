# Microhome

A website where customers design their own off-grid modular home of under 25 m², see it in 3D, get an estimated price, and send you a quote request.

It is a single static page. There is no server, no database and no sign-up. Designs are saved in each visitor's browser.

## What it does

- **Main design: accessible two-module home.** A 16.5 m² module (3.0 × 5.5 m) and an 8.4 m² module (2.0 × 4.2 m), 24.9 m² in total. Wheelchair-ready: 1 m doors, 80 cm paths, 1.5 m turning circles, roll-in shower, grab bars, ramp or platform lift. Bigger combinations of the same two modules up to 41.4 m², and all earlier layouts, are kept as options.

- **Landing page** with an animated hero, a factory-to-site assembly animation, the signature homes, features, specifications and questions.
- **Designer** where people pick a plan, change the shape, move doors, windows and furniture, and see the 3D model and price update.
- **Auto-arrange and arrangement search** that place furniture with clear walkways, short pipe runs and beds kept at least 1.8 m from any exit.
- **Ready for two**: a checklist of everything a couple needs, Japanese and Korean space-saving furniture (tatami bed with drawers, oshiire, kotatsu, ofuro, jang, bapsang), overhead cabinets and a storage target of 2,500 L. All 21 layouts pass it.
- **Off-grid sizing** for solar, battery and rainwater storage, with a draggable compass to set north and check the sun.
- **Zoom** buttons for the plan and 3D view, plus the + and − keys.
- **Cost estimate** with every line, cost-saving ideas and a lowest-price button. All prices are editable.
- **Quote request** by email, download or a form service.
- Works on phones, tablets and desktops, in light and dark mode.

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `microhome`.
2. Upload everything in this folder (drag the files onto the repository page and commit). Keep `index.html` in the top level.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/microhome/`.

To open the designer directly, add `#design` to the address.

## Set up your business details

Open `index.html` (or `src/template.html` if you rebuild) and edit the block near the top:

```js
window.MICROHOME_CONFIG = {
  name: 'Microhome',      // brand name shown across the site
  email: '',              // where quote requests go
  quoteEndpoint: ''       // optional form service URL that accepts a JSON POST
};
```

- **email**: when set, customers can send their quote request straight from their email app.
- **quoteEndpoint**: when set, requests are posted automatically as JSON with the contact details, a design summary and the full design. Services such as Formspree or Getform give you a URL to paste here.

Default prices are factory-direct estimates. Put in your own in the designer's **Prices** tab, or change the defaults in `src/01-data-geometry-costs.js` (`PRICE_DEF` and the `cost` values in `CAT`).

## Change the code

The page is built from the files in `src/`:

| File | What is in it |
|---|---|
| `01-data-geometry-costs.js` | Furniture and opening catalogue, prices, module geometry, checks, cost estimate |
| `02-auto-arrange-layouts.js` | Door and window placement, auto-arrange, the preset layouts |
| `03-plan-drawing.js` | Plan drawing, dragging, motion helpers |
| `04-ui-3d-site.js` | Panels, 3D view, smart menu, quote form, landing page and its animations |
| `template.html` | Page markup and styles |
| `layouts.json` | Pre-computed preset layouts, so the site loads instantly |

After editing, rebuild `index.html`:

```bash
python3 tools/build.py            # readable
python3 tools/build.py --minify   # smaller, needs Node.js
```

If you change the presets or the auto-arrange rules, regenerate `layouts.json` (or delete its contents and set it to `null` in `template.html`; the site then computes the layouts in each visitor's browser, which takes a few seconds on the first visit).

## Libraries

Loaded from cdnjs at runtime: [three.js r128](https://threejs.org) for the 3D view (only when the designer opens) and [GSAP 3.12.5](https://gsap.com) with ScrollTrigger for the landing page animations. Fonts: Archivo from Google Fonts.

## Before you launch

- Have the disclaimer, privacy wording and quote form reviewed for your country.
- Replace the default prices with your own quotes.
- Choose a license for the code if you want others to reuse it.

Prices shown by the site are planning estimates, not offers.
