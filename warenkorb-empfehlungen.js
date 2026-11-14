/* Tag-based cart recommendations and clickable cart-item previews. */
(() => {
  "use strict";

  const TAG_WEIGHT = { motto: 4, kategorie: 4, eigenschaften: 2, farbe: 1 };
  let products = [];

  function productTags(product) {
    const tags = [];
    for (const field of ["motto", "kategorie"]) {
      const values = Array.isArray(product?.[field]) ? product[field] : [product?.[field]];
      values.filter(Boolean).forEach((value) => {
        String(value).split(/[,;|]/).map((tag) => tag.trim().toLocaleLowerCase("de")).filter(Boolean)
          .forEach((tag) => tags.push({ tag, weight: TAG_WEIGHT[field] }));
      });
    }
    if (product?.farbe) tags.push({ tag: String(product.farbe).trim().toLocaleLowerCase("de"), weight: TAG_WEIGHT.farbe });
    if (Array.isArray(product?.eigenschaften)) {
      product.eigenschaften.forEach((item) => {
        [item?.kategorie, item?.wert].filter(Boolean).forEach((value) => {
          tags.push({ tag: String(value).trim().toLocaleLowerCase("de"), weight: TAG_WEIGHT.eigenschaften });
        });
      });
    }
    return tags;
  }

  function openProductDetail(product) {
    if (!product) return;
    if (typeof window.closeModal === "function") window.closeModal("cartModal");
    if (typeof window.openProduct === "function") window.openProduct(product.id);
  }

  function decorateCartItems() {
    const container = document.getElementById("cartItems");
    if (!container || !products.length) return;

    container.querySelectorAll(".cart-item").forEach((row) => {
      const removeButton = row.querySelector("[data-remove-id]");
      const productId = removeButton?.getAttribute("data-remove-id");
      const product = products.find((item) => String(item.id) === String(productId));
      if (!product) return;

      row.dataset.productId = String(product.id);
      row.classList.add("cart-item-clickable");
      const info = row.querySelector(".cart-item-info");
      const title = info?.querySelector("strong");
      if (title) title.title = "Klicken, um die Produktansicht zu öffnen";

      if (!row.querySelector(".cart-item-image-button")) {
        const imageButton = document.createElement("button");
        imageButton.type = "button";
        imageButton.className = "cart-item-image-button";
        imageButton.setAttribute("aria-label", `Großansicht von ${product.titel || "Produkt"} öffnen`);
        const image = document.createElement("img");
        image.src = typeof window.fixImagePath === "function" ? window.fixImagePath(product.bild || "") : (product.bild || "");
        image.alt = product.titel || "Produktbild";
        image.loading = "lazy";
        image.onerror = () => { imageButton.hidden = true; };
        imageButton.appendChild(image);
        imageButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openProductDetail(product);
        });
        row.insertBefore(imageButton, row.firstChild);
      }
    });
  }

  function createRecommendation(product) {
    const item = document.createElement("article");
    item.className = "cart-recommendation";

    const imageWrap = document.createElement("button");
    imageWrap.type = "button";
    imageWrap.className = "cart-recommendation-image";
    imageWrap.setAttribute("aria-label", `Produkt ${product.titel || "anzeigen"} öffnen`);
    const image = document.createElement("img");
    const imageSrc = typeof window.fixImagePath === "function" ? window.fixImagePath(product.bild || "") : (product.bild || "");
    image.src = imageSrc;
    image.alt = product.titel || "Produktbild";
    image.loading = "lazy";
    imageWrap.appendChild(image);
    imageWrap.addEventListener("click", () => openProductDetail(product));

    const body = document.createElement("div");
    body.className = "cart-recommendation-body";

    const title = document.createElement("strong");
    title.textContent = product.titel || "Produkt";
    title.addEventListener("click", () => openProductDetail(product));

    const meta = document.createElement("span");
    const price = Number(product.preis);
    meta.textContent = Number.isFinite(price) ? `${price.toFixed(2).replace(".", ",")} €` : "Preis auf Anfrage";

    body.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "recommendation-add";
    button.textContent = "Hinzufügen";
    button.addEventListener("click", () => {
      if (typeof window.addToCart === "function") window.addToCart(product.id);
    });

    item.append(imageWrap, body, button);
    return item;
  }

  function renderRecommendations() {
    const host = document.getElementById("cartRecommendations");
    if (!host || !products.length) return;

    let cart = [];
    try {
      const saved = JSON.parse(localStorage.getItem("sfs-cart") || "[]");
      cart = Array.isArray(saved) ? saved : [];
    } catch { cart = []; }

    const inCart = new Set(cart.map((item) => String(item.id)));
    const cartProducts = products.filter((product) => inCart.has(String(product.id)));
    host.replaceChildren();
    if (!cartProducts.length) {
      host.hidden = true;
      return;
    }

    const cartTagScores = new Map();
    cartProducts.forEach((product) => productTags(product).forEach(({ tag, weight }) => {
      cartTagScores.set(tag, (cartTagScores.get(tag) || 0) + weight);
    }));

    const suggested = products.map((product) => {
      if (inCart.has(String(product.id))) return { product, score: 0 };
      const score = productTags(product).reduce((sum, { tag, weight }) => sum + (cartTagScores.has(tag) ? weight * cartTagScores.get(tag) : 0), 0);
      return { product, score };
    }).filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || String(a.product.titel || "").localeCompare(String(b.product.titel || ""), "de"))
      .slice(0, 3);

    if (!suggested.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const heading = document.createElement("h3");
    heading.textContent = "Das könnte dir auch gefallen";
    const list = document.createElement("div");
    list.className = "cart-recommendation-list";
    suggested.forEach(({ product }) => list.appendChild(createRecommendation(product)));
    host.append(heading, list);
  }

  async function loadCatalog() {
    try {
      const response = await fetch(`./produkte.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      products = Array.isArray(data.produkte) ? data.produkte : [];
      decorateCartItems();
      renderRecommendations();
    } catch (error) {
      console.warn("Warenkorb-Empfehlungen konnten nicht geladen werden.", error);
    }
  }

  function init() {
    const cartItems = document.getElementById("cartItems");
    if (!cartItems) return;
    const host = document.createElement("section");
    host.id = "cartRecommendations";
    host.className = "cart-recommendations";
    host.hidden = true;
    cartItems.after(host);

    const style = document.createElement("style");
    style.textContent = `
      .cart-item-clickable { cursor: pointer; }
      .cart-item-image-button { flex: 0 0 72px; width: 72px; height: 72px; padding: 0; border: 0; border-radius: 10px; overflow: hidden; background: var(--card-bg); cursor: zoom-in; }
      .cart-item-image-button img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .cart-item-info strong { cursor: pointer; }
      .cart-recommendations { margin-top: 1.4rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
      .cart-recommendations h3 { margin-bottom: .75rem; font-size: 1.05rem; }
      .cart-recommendation-list { display: grid; gap: .65rem; }
      .cart-recommendation { display: flex; align-items: center; gap: .7rem; padding: .7rem; border: 1px solid var(--border-color); border-radius: 12px; }
      .cart-recommendation-image { width: 64px; height: 64px; padding: 0; border: 0; border-radius: 10px; overflow: hidden; background: var(--card-bg); cursor: pointer; flex-shrink: 0; }
      .cart-recommendation-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .cart-recommendation-body { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: .2rem; }
      .cart-recommendation-body strong { cursor: pointer; }
      .cart-recommendation-body span { color: var(--text-muted); }
      .recommendation-add { border: 0; border-radius: 9px; padding: .5rem .7rem; background: var(--purple); color: #fff; font-weight: 700; cursor: pointer; }
      @media (max-width: 480px) { .cart-recommendation { flex-wrap: wrap; } .cart-recommendation strong { flex-basis: 55%; } .cart-item-image-button { flex-basis: 58px; width: 58px; height: 58px; } }
    `;
    document.head.appendChild(style);

    cartItems.addEventListener("click", (event) => {
      if (event.target.closest("button, [data-remove-id]")) return;
      const row = event.target.closest(".cart-item[data-product-id]");
      if (!row) return;
      const product = products.find((item) => String(item.id) === row.dataset.productId);
      openProductDetail(product);
    });

    const observer = new MutationObserver(() => decorateCartItems());
    observer.observe(cartItems, { childList: true });

    if (typeof window.renderCart === "function") {
      const originalRenderCart = window.renderCart;
      window.renderCart = function (...args) {
        const result = originalRenderCart.apply(this, args);
        decorateCartItems();
        renderRecommendations();
        return result;
      };
    }
    loadCatalog();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
