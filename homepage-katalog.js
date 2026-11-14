/* Optional monthly-offer presentation. Keeps the original product grid and filters intact. */
(() => {
  "use strict";

  const money = (value) => `${Number(value).toFixed(2).replace(".", ",")} €`;

  function makeOfferCard(product) {
    const card = document.createElement("article");
    card.className = "product-card offer-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Details zu ${product.titel || "Produkt"} öffnen`);
    card.addEventListener("click", () => window.openProduct(product.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.openProduct(product.id);
      }
    });

    const image = document.createElement("img");
    image.src = window.fixImagePath(product.bild || "");
    image.alt = product.titel || "Produktbild";
    image.className = "product-image";
    card.appendChild(image);

    const content = document.createElement("div");
    content.className = "product-content";
    const badge = document.createElement("span");
    badge.className = "offer-badge";
    badge.textContent = "Angebot des Monats";
    content.appendChild(badge);

    const title = document.createElement("h3");
    title.className = "product-title";
    title.textContent = product.titel || "Unbenanntes Modell";
    content.appendChild(title);

    const description = document.createElement("p");
    description.className = "product-desc";
    description.textContent = product.kurzbeschreibung || "";
    content.appendChild(description);

    const prices = document.createElement("p");
    prices.className = "offer-prices";
    const oldPrice = document.createElement("s");
    oldPrice.textContent = money(product.preis);
    const newPrice = document.createElement("strong");
    newPrice.textContent = money(product.angebotspreis);
    prices.append(oldPrice, newPrice);
    content.appendChild(prices);

    const actions = document.createElement("div");
    actions.className = "shop-buttons";
    actions.addEventListener("click", (event) => event.stopPropagation());
    const details = document.createElement("button");
    details.type = "button";
    details.className = "btn btn-shopify";
    details.textContent = "Angebot ansehen";
    details.addEventListener("click", () => window.openProduct(product.id));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-cart";
    add.textContent = "In den Warenkorb";
    add.addEventListener("click", () => window.addToCart(product.id));
    actions.append(details, add);
    content.appendChild(actions);
    card.appendChild(content);
    return card;
  }

  async function init() {
    const overview = document.getElementById("overviewSection");
    const container = overview?.querySelector(".container");
    const filterBar = document.getElementById("filterBar");
    if (!container || !filterBar) return;

    const style = document.createElement("style");
    style.textContent = `
      .monthly-offers { margin: 1.5rem auto 2rem; padding: 1.5rem; border-radius: 24px; background: var(--card-bg); border: 2px solid var(--accent); box-shadow: var(--shadow); }
      .monthly-offers h2 { margin-bottom: .35rem; }
      .monthly-offers-intro { color: var(--text-muted); margin-bottom: 1rem; }
      .offer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
      .offer-badge { align-self: flex-start; background: var(--primary); color: #fff; padding: .3rem .8rem; border-radius: 999px; font-size: .82rem; font-weight: 800; margin-bottom: .7rem; }
      .offer-prices { display: flex; align-items: baseline; gap: .75rem; margin-bottom: 1rem; }
      .offer-prices s { color: var(--text-muted); }
      .offer-prices strong { color: var(--primary); font-size: 1.35rem; }
      .offer-empty { padding: 1rem; background: rgba(254, 228, 64, .12); border-radius: 14px; color: var(--text-muted); }
      @media (max-width: 600px) { .monthly-offers { padding: 1rem; } }
    `;
    document.head.appendChild(style);

    const section = document.createElement("section");
    section.className = "monthly-offers";
    section.setAttribute("aria-labelledby", "monthlyOffersTitle");
    section.innerHTML = '<h2 id="monthlyOffersTitle">⭐ Angebot des Monats</h2><p class="monthly-offers-intro">Besondere Produkte zum reduzierten Preis.</p><div class="offer-grid" id="monthlyOfferGrid"></div>';
    container.insertBefore(section, filterBar);

    try {
      const response = await fetch(`./produkte.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`produkte.json HTTP-Status ${response.status}`);
      const data = await response.json();
      const products = Array.isArray(data.produkte) ? data.produkte : [];
      const offers = products.filter((product) => product.angebot === true
        && Number.isFinite(Number(product.preis))
        && Number.isFinite(Number(product.angebotspreis))
        && Number(product.angebotspreis) > 0
        && Number(product.angebotspreis) < Number(product.preis));
      const offerGrid = section.querySelector(".offer-grid");
      if (offers.length) {
        offers.forEach((product) => offerGrid.appendChild(makeOfferCard(product)));
      } else {
        const empty = document.createElement("p");
        empty.className = "offer-empty";
        empty.textContent = "Hier erscheinen deine Monatsangebote, sobald du sie festgelegt hast. Lege dafür beim Produkt „angebot: true“ und einen reduzierten „angebotspreis“ fest.";
        offerGrid.appendChild(empty);
      }
    } catch (error) {
      console.warn("Monatsangebote konnten nicht geladen werden.", error);
      const empty = document.createElement("p");
      empty.className = "offer-empty";
      empty.textContent = "Monatsangebote sind gerade nicht verfügbar.";
      section.querySelector(".offer-grid").appendChild(empty);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
