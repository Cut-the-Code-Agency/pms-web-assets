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

## Wijzigen

```sh
npm install
npm run build        # src/chromite.js → dist/chromite.js
npx serve .          # test.html bekijken
```

Daarna committen, een nieuwe tag zetten (`v1.0.1`, …) en het versienummer in Webflow ophogen. Een tag nooit verplaatsen: jsDelivr cachet hem permanent.

Het model (`model/chromite.glb`) is gemaakt uit de aangeleverde GLTF met
`gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024`.
