const LM_STUDIO_BASE_URL = "https://100.82.62.74:1234"; // Tailscale-URL anpassen
const MODEL_NAME = "gemma-4-e4b";

let shopProducts = [];

// Liest Produkte aus dem DOM der Shop-Seite aus
function buildShopContext() {
  const productCards = document.querySelectorAll("[data-product-name], .product-card");
  shopProducts = [];

  productCards.forEach((card) => {
    const name =
      card.getAttribute("data-product-name") ||
      card.querySelector(".product-title, h2, h3")?.textContent.trim();
    const url =
      card.getAttribute("data-product-url") ||
      card.querySelector("a")?.getAttribute("href") ||
      "#";
    const price =
      card.getAttribute("data-product-price") ||
      card.querySelector(".product-price, .price")?.textContent.trim() ||
      "";

    if (name) {
      shopProducts.push({ name, url, price });
    }
  });

  if (shopProducts.length === 0) {
    return "Keine spezifischen Produkte auf der aktuellen Seite gefunden.";
  }

  return shopProducts
    .map((p) => `- ${p.name}${p.price ? ` (${p.price})` : ""}: ${p.url}`)
    .join("\n");
}

// Verlinkt erkannte Produktnamen automatisch in der Bot-Antwort
function linkifyProducts(text) {
  let formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const sorted = [...shopProducts].sort((a, b) => b.name.length - a.name.length);
  sorted.forEach((product) => {
    const escapedName = product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b(${escapedName})\\b`, "gi");
    formatted = formatted.replace(
      regex,
      `<a href="${product.url}" target="_blank" rel="noopener">$1</a>`
    );
  });

  return formatted.replace(/\n/g, "<br>");
}

// Prüft die Erreichbarkeit von LM Studio über Tailscale
async function checkConnection() {
  const dot = document.getElementById("ai-status-dot");
  try {
    const res = await fetch(`${LM_STUDIO_BASE_URL}/models`, { method: "GET" });
    if (res.ok && dot) {
      dot.classList.add("online");
      dot.title = "LM Studio verbunden";
    }
  } catch {
    if (dot) {
      dot.classList.remove("online");
      dot.title = "LM Studio nicht erreichbar";
    }
  }
}

function appendMessage(text, sender) {
  const container = document.getElementById("ai-chat-messages");
  const msgDiv = document.createElement("div");
  msgDiv.className = `ai-msg ${sender}`;

  if (sender === "bot") {
    msgDiv.innerHTML = linkifyProducts(text);
  } else {
    msgDiv.textContent = text;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  return msgDiv;
}

async function sendMessage() {
  const input = document.getElementById("ai-chat-input");
  const userText = input.value.trim();
  if (!userText) return;

  input.value = "";
  appendMessage(userText, "user");
  const loadingMsg = appendMessage("Denke nach...", "bot");

  const shopContext = buildShopContext();

  try {
    const response = await fetch(`${LM_STUDIO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: `Du bist ein hilfreicher KI-Produktberater. Nutze dieses Sortiment für Empfehlungen und nenne exakte Produktnamen:\n${shopContext}`
          },
          { role: "user", content: userText }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      "Entschuldigung, ich konnte keine Antwort generieren.";
    loadingMsg.innerHTML = linkifyProducts(reply);
  } catch {
    loadingMsg.textContent =
      "Verbindung zu LM Studio fehlgeschlagen. Bitte Tailscale-Status prüfen.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fab = document.getElementById("ai-fab");
  const chatWindow = document.getElementById("ai-chat-window");
  const closeBtn = document.getElementById("ai-chat-close");
  const sendBtn = document.getElementById("ai-chat-send");
  const input = document.getElementById("ai-chat-input");

  fab?.addEventListener("click", () => {
    chatWindow.classList.toggle("open");
    if (chatWindow.classList.contains("open")) {
      checkConnection();
      input?.focus();
    }
  });

  closeBtn?.addEventListener("click", () => chatWindow.classList.remove("open"));
  sendBtn?.addEventListener("click", sendMessage);
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  checkConnection();
});
