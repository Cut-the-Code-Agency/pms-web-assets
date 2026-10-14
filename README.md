# PMS web assets

Bestanden die de PMS-website (Webflow) laadt via jsDelivr. **Openbaar**: zet hier alleen wat de website zelf ook toont. Werkbestanden en afspraken staan in de privé-repo `wf-pms`.

## Chromite-steen (home hero)

3D-model dat meedraait met de scroll. Three.js zit in de bundel; GSAP + ScrollTrigger worden uit Webflow gebruikt als ze geladen zijn, anders van cdnjs.

In Webflow, custom code van de home (voor `</body>`):

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.3.1/dist/chromite.js"></script>
```

Markup in de hero:

```html
<div class="chromite_wrap" data-chromite>
  <img data-chromite-fallback src="…">   <!-- stilstaande afbeelding tot het model er is -->
</div>
```

Hero-modus (`data-chromite-mode="hero"`): zet het vlak als eerste element vóór de hero. De steen draait vanzelf, schuift tijdens de hero kleiner naar de rechterrand, blijft tijdens de volgende sectie en scrolt dan mee weg. Tekst en lijnen die over de steen moeten wisselen van kleur krijgen in Webflow de class `u-blend-difference`.

Opties op `[data-chromite]`: `data-chromite-mode` (`inline` of `hero`), `data-chromite-end` (hero: tot waar de laag loopt), `data-chromite-tilt` (kanteling in graden, 90 = liggend), `data-chromite-land` (hero: selector van het vlak waarin de steen landt, bv. de beeldplek van de eerste slide; de steen volgt dat vlak daarna en wordt afgeknipt aan de slider), `data-chromite-clip`, `data-chromite-trigger` (selector van het scrollbereik, standaard de dichtstbijzijnde `<section>`), `data-chromite-turns` (standaard `1`), `data-chromite-material` (`stone` of `metal`).

## Card hover (Card Primary)

Hover van de kaarten: vierkantje schaalt in vanuit linksboven, titel schuift mee, tekst schuift open (Certificate, CTA), foto zoomt (CTA). Erin 450 ms, eruit 250 ms; een onderbroken hover keert terug vanaf de huidige stand. Gebruikt de GSAP (+ CustomEase) die Webflow laadt; laadt zelf niets. Alleen met muis en vanaf 768 px; op mobiel doet Webflow Interactions de CTA (uitschuiven bij scrollen).

In Webflow staat het script site-breed (footer):

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.4.0/dist/card-hover.js"></script>
```

Markup (in de component Card Primary): `data-card-hover="card"` op de groep, `marker`, `title`, `text`, `image` op de onderdelen. Rust-stand staat in de classes (vierkantje `scale(0)`, titel `translateX(-…)`, tekst `height: 0; opacity: 0`). Varianten die de foto laten zoomen: `ZOOM` in `src/card-hover.js` (op variant-id).

## Link preview (Services Overview op Home)

Lijst met links waarbij een foto meekomt. Desktop (muis, ≥ 992 px): bij hover schaalt de foto van die link in vanuit linksboven op de cursor, volgt de muis met easing en schuift naar de foto van een andere link; het nummer wordt blauw. Mobiel en tablet: de link in het midden van het scherm is actief (nummer blauw); pas als het scrollen 250 ms stilstaat vloeit de foto van die link langzaam over (1,2 s), zodat snel scrollen niet alle foto's langs laat flitsen. Gebruikt de GSAP (+ CustomEase) die Webflow laadt; laadt zelf niets. Gebouwd als IIFE, zodat het niet botst met `card-hover.js`.

In Webflow site-breed (footer):

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.7.0/dist/link-preview.js"></script>
```

Markup: `data-link-preview="section"` op de wrapper, `list`, `item` (component Service Link), `image` (verborgen houder met de foto), `preview` (desktop-vlak), `stage` (mobiel sticky vlak). Het nummer `.service-link_number` krijgt `is-active`.

## Wijzigen

```sh
npm install
npm run build        # src/chromite.js → dist/chromite.js, src/card-hover.js → dist/card-hover.js, src/link-preview.js → dist/link-preview.js
npx serve .          # test.html bekijken
```

Daarna committen, een nieuwe tag zetten (`v1.0.1`, …) en het versienummer in Webflow ophogen. Een tag nooit verplaatsen: jsDelivr cachet hem permanent.

Het model (`model/chromite.glb`) is gemaakt uit de aangeleverde GLTF met
`gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024`.
