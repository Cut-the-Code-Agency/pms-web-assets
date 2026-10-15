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

### Reis-modus (Home, vanaf v1.15.0)

Geen markup in Webflow: de instellingen staan op de script-tag in de page-footer van Home.

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.15.0/dist/chromite.js"
  data-chromite-start=".home-hero_visual"
  data-chromite-land="[data-swiper-slide-index='0'] .mineral-slide_visual"
  data-chromite-light=".home-hero_title.is-light, .mineral-slide_title.is-light"
  data-chromite-size="0.95" data-chromite-tilt="35"></script>
```

De steen begint op de plek van de foto in het startvlak (die foto is de fallback en verdwijnt als het model er is). Desktop: hij blijft op die plek in beeld terwijl de hero wegscrolt en schuift kleiner naar de rechterrand; mobiel scrolt hij mee en wacht net buiten beeld rechts. Komt de landingssectie in beeld, dan vliegt hij naar het landingsvlak en volgt dat daarna, ook als de slider schuift (bij een slider met kopieën het exemplaar dat het dichtst bij het midden staat). Curve: merkcurve Position `0.75, 0, 0.5, 1`. Geen GSAP nodig.

Lichte titels (`data-chromite-light`, in de hero en in de landingsslides): het script tekent ze zelf, letter voor letter op de plek van de DOM-letters (dus ook tijdens de inlaadanimatie en de slidewissel), en houdt ze alleen waar de steen is. De DOM-kopie wordt doorzichtig. Met "minder beweging": steen staat stil in de hero en scrolt mee, geen landing.

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

## Count-up (cijfers die optellen)

Een getal telt op van 0 naar de waarde die in Webflow staat (`30%`, `1.200+`, `€ 4,5 mln`): voor- en achtervoegsel, decimalen en scheidingstekens blijven zoals in Webflow. Begint als het blok in beeld komt én zichtbaar is, zodat een Webflow-interaction die het blok laat infaden het startmoment bepaalt; na 4 s telt het hoe dan ook. 1,6 s per getal. Met `prefers-reduced-motion` blijft de eindwaarde staan. Gebruikt de GSAP (+ CustomEase) die Webflow laadt; laadt zelf niets. IIFE.

In Webflow site-breed (footer):

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.8.0/dist/count-up.js"></script>
```

Markup: `data-count-up` op het blok met het getal (bij Lumos `Block`: props Attribute Name/Value); de waarde is een extra wachttijd in seconden (`0` = meteen). Het eerste stuk tekst met cijfers in het blok telt op. Eerste toepassing: de vier cijfers in de Home Hero.

## Mask image (lichte titel boven een CMS-steen)

Een element met `data-mask-image` krijgt de foto uit het dichtstbijzijnde `[data-mask-source]` als CSS-mask. Zo is een lichte kopie van een titel alleen zichtbaar waar de (transparante) steenfoto is: wit op de steen, blauw ernaast (de blauwe titel staat eronder). Nodig omdat Webflow een CMS-foto niet aan `mask-image` kan koppelen. Werkt ook voor de kopieën die Swiper voor de lus maakt. De class van het element zet `mask-size`/`mask-repeat` en als beginwaarde een lege mask (zonder script onzichtbaar). Eerste toepassing: Mineral Slide (Featured Minerals op Home).

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.11.0/dist/mask-image.js"></script>
```

## Slide title (titel letter voor letter bij een slidewissel)

Elk element met `data-slide-split` in een Swiper-slide (Lumos Slider) splitst bij het actief worden van die slide in letters die omhoog komen (750 ms, `0.75,0,0.5,1`, 25 ms tussen letters), zoals de titels die inladen. Alle `data-slide-split`-elementen in de slide bewegen samen, zodat een blauwe titel en zijn lichte kopie gelijk lopen. Gebruikt de GSAP + SplitText + CustomEase die Webflow laadt. Met `prefers-reduced-motion` gebeurt er niets. Eerste toepassing: Mineral Slide (titel, lichte kopie, mobiele naam).

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.12.0/dist/slide-title.js"></script>
```

## Slide fixed (hoekteksten die niet meeschuiven)

Elk element met `data-slide-fixed` in een Swiper-slide (Lumos Slider) blijft tijdens het schuiven en slepen op de plek van de actieve slide staan, zodat een wissel alleen een fade en een kleine beweging omhoog is (die beweging staat in de CSS van de pagina). Alleen voor absoluut gepositioneerde elementen; in de gewone flow schuift het element mee. Het script volgt de Swiper-events en zet de tegenbeweging op de CSS-property `translate` (bij slepen direct, bij een wissel als animatie met dezelfde duur en curve als de slider), zodat `transform` vrij blijft voor de fade-beweging. Eerste toepassing: Mineral Slide (nummer en formule, en op desktop de tekst rechtsonder).

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.14.0/dist/slide-fixed.js"></script>
```

## Wijzigen

```sh
npm install
npm run build        # src/*.js → dist/*.js (chromite, card-hover, link-preview, minerals-filter, count-up, mask-image, slide-title, slide-fixed)
npx serve .          # test.html bekijken
```

Daarna committen, een nieuwe tag zetten (`v1.0.1`, …) en het versienummer in Webflow ophogen. Een tag nooit verplaatsen: jsDelivr cachet hem permanent.

Het model (`model/chromite.glb`) is gemaakt uit de aangeleverde GLTF met
`gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024`.

## Timeline (About us "Timeline", Mineral # "Supply Chain")

De blauwe lijn van de tijdlijn. Desktop (≥ 992 px, Lumos Slider variant Timeline): bij het inscrollen kleurt het eerste stuk lijn mee met de scroll naar de tweede stap; elke klik op de pijlen laat het stuk naar de volgende stap in 750 ms intekenen (`cubic-bezier(0.75,0,0.5,1)`). Bereikte stappen krijgen `is-reached` op het jaartal/vierkantje en het kaartje (blauw / donker). Swiper krijgt ruimte achter de laatste slide, zodat elke stap links kan staan. Mobiel: Swiper uit, stappen onder elkaar, de lijn vult mee met scrollen tot 60 % van het scherm. Reduced motion: geen tween. Gebruikt de GSAP (+ CustomEase) die Webflow laadt; laadt zelf niets. IIFE.

In Webflow site-breed (footer):

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.16.1/dist/timeline.js"></script>
```

Markup (component Timeline Item): `data-timeline="root"` op de sectie, `item` op elke stap, `point` op jaartal en vierkantje, `card` op het kaartje, `fill` op het blauwe lijnstuk.
