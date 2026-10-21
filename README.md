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

## Mineraalpagina (v1.26.0)

In de page-footer van het Minerals-sjabloon (Mineral #), elk met SRI:

- `product-gallery.js`: Product Hero-galerij. Schuift naar `offsetLeft` van de dia (v1.30.0), samen met de Webflow-stijl `flex-basis: round(up, 100%, 1px)` op de dia: anders bleef op sommige breedtes een streepje van 1 px van de vorige dia zichtbaar. Foto's in een strook met scroll-snap (vegen werkt vanzelf), thumbnails `button[data-gallery-thumb="0|1"]` schuiven naar de foto en krijgen `is-active` + `aria-pressed`; `[data-gallery-meta]` krijgt `is-light` op een donkere foto. Minder beweging: springen zonder schuiven.
- `product-tabs.js` (met `defer`, draait vóór het Lumos Tab-script): tab zonder tekst (knop + paneel) weg; datasheet-link zonder bestand weg; de zin "available upon request" (`[data-doc-request]`) alleen als er geen datasheet is.
- `minerals-filter.js` (v1.30.0): overgang bij filteren — weggaande kaarten faden uit en krimpen iets, blijvers schuiven naar hun nieuwe plek (FLIP, Web Animations), nieuwkomers komen met de site-fade-up 60 ms na elkaar binnen; opnieuw kiezen tijdens een overgang gaat verder vanaf de huidige stand; minder beweging = direct.
- `minerals-filter.js`: ook een keuzemenu `select[data-minerals-filter-select]`; zonder eigen gegevenslijst op de pagina haalt het de lijst en de industrienamen op van `data-minerals-source` (bv. `/minerals`).

## Story Map (About us, Story Slides)

Bewegende kaarten in twee dia's van de Story Slides. De kaart is de foto van de dia (zonder raster); de Webflow-componenten **Story Map Europe** en **Story Map World** (in de slot Visual van Story Slide) bevatten een inline SVG met raster, coördinaten, vierkantjes en (Europe) een vizier, in rust al in de eindstand. Het script bouwt die op zodra de dia in beeld schuift (lijnen tekenen, labels faden, vierkantjes groeien), laat daarna het vizier van Nederland naar Duitsland en Spanje lopen (coördinaten lopen mee, de tijd tikt) of de stippen om de beurt oplichten (World), en tekent een witte flare over de rasterlijnen die met vertraging achter de muis aan loopt. Tijd (tikt, beide kaarten) en coördinaten staan in de hoeken, 0,75rem groot en 1rem van de kaderlijn (zijkant en onder gelijk) (`data-pin`), ook bij minder beweging. Kaartpunten buiten de uitsnede (staand scherm) worden overgeslagen. Reduced motion: niets. Geen GSAP nodig.

In Webflow, page-footer van About us:

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.33.0/dist/story-map.js" integrity="…" crossorigin="anonymous" defer></script>
```

## Contact (v1.38.0)
Page-footer van Contact, alle drie met SRI en `defer`:
- `contact-map.js` — Contact Map: kaart bouwt op bij laden (lijnen, vierkantjes vanuit het midden, vizier, adreskaart), klik op een vierkantje schuift het vizier naar die vestiging en opent de adreskaart op een plek met ruimte; flare rond de muis zoals Story Map; klok (Nederlandse tijd) en coördinaten van de actieve vestiging. viewBox per breedte (`data-vb-desktop` / `data-vb-compact`).
- `form-steps.js` — formulier in stappen (`.form_fieldset_wrap.is-step`, `[data-form-next]`, `[data-form-back]`, `[data-form-submit]`, teller `[data-form-step-current]`). Zonder script alle stappen onder elkaar.
- `quote-slider.js` — Quote Slider: kop "Request a quote for <mineraal>", verborgen veld `input[data-quote-product]` en "View product" (`[data-quote-link] a`) volgen de slide in beeld (`data-name` / `data-slug` op `.mineral-slide_wrap`).
- v1.40.0/v1.40.1: naam bij elk vierkantje (`.contact-map_marker_label` in de knop; `is-active` wit, `is-hover`, `is-left` als hij rechts botst met een ander vierkantje, een andere naam of de open adreskaart). De namen staan in Webflow op opacity 0 en faden in na de opbouw. Niet-actieve vierkantjes lichten om de beurt op met een uitdijende ring, zoals de wereldkaart van de Story Map.
- v1.35.1: klik op een vierkantje tijdens het schuiven wordt onthouden en daarna uitgevoerd; Quote Slider start vanuit `[data-quote-slider]` en haalt de 15 streepjes uit de tabvolgorde (pijlen en pijltoetsen blijven).
- v1.38.0: adreskaart groeit uit de hoek bij het vierkantje (`transform-origin` per plek); ≤ 991 loopt de kaart door achter adreskaart en formulier (`data-vb-band`, `data-vb-line-end`); producttitel boven het offerteformulier wisselt letter voor letter (oude naam uit het masker omhoog, nieuwe erin, sr-only kopie voor schermlezers); stappen gebruiken `form-errors.js`.

## Formulieren (v1.38.0)
Site-footer: `form-errors.js` — verzendknoppen altijd klikbaar; bij versturen of Continue een rode melding (`.form_field_error`) onder elk fout verplicht veld, `aria-invalid` + `aria-describedby`, focus op het eerste foute veld; melding verdwijnt zodra het veld klopt. Teksten per formulier uit `data-error-required/-email/-choice/-terms` (vertaalbaar), anders Engels. Zet `novalidate` op elk formulier; zonder script de gewone browsercontrole.

## Nav (`nav.js`, vanaf v1.36.0)

Site settings › Custom code › Footer (site-breed). Taalvenster open/dicht, ingeklapte balk na scrollen, balkkleur per onderdeel uit wat eronder ligt (foto-pixels via een kleine canvaskopie, verlopen en halfdoorzichtige lagen tellen mee; video en een nog niet geladen foto = donker), en de ouderlink actief op detailpagina's. De CSS staat in de site-head. Vangnet op een sectie: `data-section="dark|light"` of `data-nav-color="Light|Dark"` (prop Nav Color). Meten: `window.PMS_NAV_DEBUG = 1` vóór het script zet `data-nav-luminance` op elk onderdeel en tijden in `window.PMS_NAV_TIMES`.

## Readout (`readout.js`, vanaf v1.49.0; nu v1.55.0)

Formules, kwaliteiten en coördinaten "lezen uit" als een meetapparaat: op het moment dat de tekst verschijnt (inlaadanimatie, slide wordt actief, kaart bouwt op) rollen letters en cijfers ±0,5–0,75 s door willekeurige tekens en vallen ze van links naar rechts op hun plek. Hoofdletter blijft hoofdletter, cijfer blijft cijfer; ₂, °, ′, spaties en leestekens blijven staan. Elk teken houdt tijdens het rollen de breedte van het echte teken (SVG-tekst: `textLength`), dus niets verschuift; daarna staat de oorspronkelijke tekst er weer. Schermlezers horen alleen de echte tekst. Zonder GSAP of met "minder beweging": niets, de echte tekst staat er. Gebruikt de GSAP die Webflow laadt.

In Webflow site-breed (footer):

```html
<script src="https://cdn.jsdelivr.net/gh/Cut-the-Code-Agency/pms-web-assets@v1.55.0/dist/readout.js" integrity="sha384-…" crossorigin="anonymous"></script>
```

Markup: `data-readout` op het element met de tekst (een wrapper mag: alle tekst erin doet mee) of op een SVG-`<text>`; `data-readout="off"` zet het uit. Met een selector als waarde op een wrapper (`data-readout=".sm-coord"` op `story-map_wrap`) doen alleen de elementen erin mee die erop passen: voor tekst in een embed. Speelt alleen bij onzichtbaar → zichtbaar terwijl het element in beeld is (of binnen 3 s nadat het vlak onder of boven de rand verscheen, binnen 60 % schermhoogte), dus samen met de bestaande inlaadanimatie en opnieuw bij een slidewissel; niet bij tekst die er al stond en niet bij wat meevliegt in de paginaovergang.
