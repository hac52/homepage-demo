/* Homepage catalog presentation: monthly offers first, then products by category. */
(() => {
  "use strict";

  const categoriesFor = (product) => {
    const source = product?.kategorie || product?.motto || "Weitere Produkte";
    return [...new Set(String(source).split(/[,;|]/).map((value) => value.trim()).filter(Boolean))];
  };
  const money = (value) => `${Number(value).toFixed(2).replace(".", ",")} €`;

  function makeProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
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

  function init() {
    const overview = document.getElementById("overviewSection");
    const container = overview?.querySelector(".container");
    const filterBar = document.getElementById("filterBar");
    const grid = document.getElementById("productGrid");
    if (!container || !filterBar || !grid || typeof window.renderProducts !== "function") return;

    const styles = document.createElement("style");
    styles.textContent = `
      .monthly-offers { margin: 1.5rem auto 2rem; padding: 1.5rem; border-radius: 24px; background: var(--card-bg); border: 2px solid var(--accent); box-shadow: var(--shadow); }
      .monthly-offers h2, .category-section h2 { margin-bottom: .35rem; }
      .section-intro { color: var(--text-muted); margin-bottom: 1rem; }
      .offer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
      .offer-badge { align-self: flex-start; background: var(--primary); color: #fff; padding: .3rem .8rem; border-radius: 999px; font-size: .82rem; font-weight: 800; margin-bottom: .7rem; }
      .offer-prices { display: flex; align-items: baseline; gap: .75rem; margin-bottom: 1rem; }
      .offer-prices s { color: var(--text-muted); }
      .offer-prices strong { color: var(--primary); font-size: 1.35rem; }
      .offer-empty { padding: 1rem; background: rgba(254, 228, 64, .12); border-radius: 14px; color: var(--text-muted); }
      .category-section { margin: 2rem auto 1rem; }
      .category-buttons { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1rem; }
      .category-button { border: 1px solid var(--border-color); border-radius: 999px; padding: .65rem 1rem; background: var(--card-bg); color: var(--text-color); font: inherit; font-weight: 700; cursor: pointer; }
      .category-button:hover, .category-button[aria-pressed="true"] { background: var(--purple); border-color: var(--purple); color: #fff; }
      #catalogPrompt { text-align: center; padding: 2rem; color: var(--text-muted); background: var(--card-bg); border-radius: 18px; box-shadow: var(--shadow); }
      #filterBar[hidden], #productGrid[hidden] { display: none; }
      @media (max-width: 600px) { .monthly-offers { padding: 1rem; } }
    `;
    document.head.appendChild(styles);

    const offers = document.createElement("section");
    offers.className = "monthly-offers";
    offers.setAttribute("aria-labelledby", "monthlyOffersTitle");
    offers.innerHTML = '<h2 id="monthlyOffersTitle">⭐ Angebot des Monats</h2><p class="section-intro">Besondere Produkte zum reduzierten Preis.</p><div class="offer-grid" id="monthlyOfferGrid"></div>';
    container.insertBefore(offers, filterBar);

    const categorySection = document.createElement("section");
    categorySection.className = "category-section";
    categorySection.setAttribute("aria-labelledby", "categoryTitle");
    categorySection.innerHTML = '<h2 id="categoryTitle">Entdecke unsere Kategorien</h2><p class="section-intro">Wähle eine Kategorie aus, um die passenden Produkte zu entdecken.</p><div class="category-buttons" id="categoryButtons"></div>';
    container.insertBefore(categorySection, filterBar);

    const prompt = document.createElement("p");
    prompt.id = "catalogPrompt";
    prompt.textContent = "Wähle oben eine Kategorie aus – dann werden die Produkte angezeigt.";
    grid.before(prompt);
    filterBar.hidden = true;
    grid.hidden = true;

    let selectedCategory = null;
    let products = [];
    const originalRender = window.renderProducts;

    function updateOffers() {
      const offerGrid = document.getElementById("monthlyOfferGrid");
      const activeOffers = products.filter((product) => product.angebot === true
        && Number.isFinite(Number(product.preis))
        && Number.isFinite(Number(product.angebotspreis))
        && Number(product.angebotspreis) > 0
        && Number(product.angebotspreis) < Number(product.preis));
      offerGrid.replaceChildren();
      if (!activeOffers.length) {
        const empty = document.createElement("p");
        empty.className = "offer-empty";
        empty.textContent = "Hier erscheinen deine Monatsangebote, sobald du sie festgelegt hast. Lege dafür beim Produkt „angebot: true“ und einen reduzierten „angebotspreis“ fest.";
        offerGrid.appendChild(empty);
        return;
      }
      activeOffers.forEach((product) => offerGrid.appendChild(makeProductCard(product)));
    }

    function updateCategories() {
      const buttonBox = document.getElementById("categoryButtons");
      const categories = [...new Set(products.flatMap(categoriesFor))].sort((a, b) => a.localeCompare(b, "de"));
      buttonBox.replaceChildren();
      categories.forEach((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "category-button";
        button.textContent = category;
        button.setAttribute("aria-pressed", String(selectedCategory === category));
        button.addEventListener("click", () => {
          selectedCategory = category;
          buttonBox.querySelectorAll(".category-button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
          document.getElementById("searchInput").value = "";
          document.getElementById("colorFilter").value = "alle";
          document.getElementById("mottoFilter").value = "alle";
          document.querySelectorAll(".dynamic-filter").forEach((select) => { select.value = "alle"; });
          filterBar.hidden = false;
          window.filterProducts();
          grid.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        buttonBox.appendChild(button);
      });
    }

    // Keep an independent catalog snapshot: `let allProducts` in index.html is
    // module-scoped from other scripts and is therefore not available as window.allProducts.
    async function loadCatalogSections() {
      try {
        const response = await fetch(`./produkte.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`produkte.json HTTP-Status ${response.status}`);
        const data = await response.json();
        products = Array.isArray(data.produkte) ? data.produkte : [];
        updateOffers();
        updateCategories();
      } catch (error) {
        console.warn("Kategorien und Monatsangebote konnten nicht geladen werden.", error);
      }
    }

    window.renderProducts = function (list) {
      const available = Array.isArray(list) ? list : [];
      if (!selectedCategory) {
        prompt.hidden = false;
        grid.hidden = true;
        grid.replaceChildren();
        return;
      }
      prompt.hidden = true;
      grid.hidden = false;
      originalRender(available.filter((product) => categoriesFor(product).includes(selectedCategory)));
    };

    loadCatalogSections();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
