const LM_STUDIO_BASE_URL = "https://desktop-uvddnig.tail1dcff0.ts.net/v1";
const MODEL_NAME = "google/gemma-4-e4b";

let shopProducts = [];
let chatHistory = [];

// 1. Lädt Produkte direkt aus produkte.json (für exakte Namen & #produkt-id Links)
async function getShopContext() {
  try {
    const res = await fetch("./produkte.json?t=" + Date.now());
    const data = await res.json();
    const list = Array.isArray(data.produkte) ? data.produkte : [];

    shopProducts = list.map((p) => ({
      id: p.id || "",
      name: p.titel || "",
      farbe: p.farbe || "",
      motto: p.motto || "",
      material: p.material || "",
      url: p.id ? `#produkt-${p.id}` : "#"
    }));

    if (shopProducts.length === 0) {
      return "Aktuell sind keine Produkte im Sortiment hinterlegt.";
    }

    return shopProducts
      .map(
        (p) =>
          `- ${p.name} (Farbe: ${p.farbe}, Kategorie: ${p.motto}, Material: ${p.material})`
      )
      .join("\n");
  } catch (err) {
    console.error("Fehler beim Laden von produkte.json:", err);
    return "Sortiment konnte gerade nicht geladen werden.";
  }
}

// 2. Lädt dein vorrätiges Filament-Sortiment direkt aus filamente.json
async function getFilamentContext() {
  try {
    const res = await fetch("./filamente.json?t=" + Date.now());
    const data = await res.json();
    const list = Array.isArray(data.filamente) ? data.filamente : [];

    const verfuegbare = list.filter(
      (f) => f.verfuegbar && f.verfuegbar.toLowerCase() !== "leer"
    );

    if (verfuegbare.length === 0) return "";

    const text = verfuegbare
      .map(
        (f) =>
          `- ${f.name} (${f.material || "PLA"}${f.notiz ? ", " + f.notiz : ""}) – Status: ${f.verfuegbar}`
      )
      .join("\n");

    return `\n\nVorrätiges Filament-Sortiment für Wunschanfertigungen:\n${text}`;
  } catch {
    return "";
  }
}

// 3. Verlinkt erkannte Produktnamen automatisch in der Bot-Antwort
function linkifyProducts(text) {
  let formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const sorted = [...shopProducts].sort((a, b) => b.name.length - a.name.length);
  sorted.forEach((product) => {
    if (!product.name) return;
    const escapedName = product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b(${escapedName})\\b`, "gi");
    formatted = formatted.replace(
      regex,
      `<a href="${product.url}" class="ai-product-link" data-product-id="${product.id}">$1</a>`
    );
  });

  return formatted.replace(/\n/g, "<br>");
}

// 4. Prüft die Verbindung zu LM Studio über Tailscale
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

// 5. Sendet Nachricht inklusive Chat-Verlauf an Gemma-4
async function sendMessage() {
  const input = document.getElementById("ai-chat-input");
  const userText = input.value.trim();
  if (!userText) return;

  input.value = "";
  appendMessage(userText, "user");
  const loadingMsg = appendMessage("Denke nach...", "bot");

  const [shopContext, filamentContext] = await Promise.all([
    getShopContext(),
    getFilamentContext()
  ]);

  chatHistory.push({ role: "user", content: userText });
  if (chatHistory.length > 10) {
    chatHistory = chatHistory.slice(-10);
  }

  try {
    const response = await fetch(`${LM_STUDIO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: `Du bist der freundliche KI-Produktberater für den Shop "Schicht für Schicht 3D Drucke" in Stuttgart. Nutze ausschließlich dieses aktuelle Sortiment und unsere vorrätigen Filamente für Empfehlungen. Nenne die exakten Produktnamen aus der Liste, damit sie automatisch verlinkt werden:\n\nAktuelle 3D-Druck-Produkte:\n${shopContext}${filamentContext}`
          },
          ...chatHistory
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler ${response.status}`);
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      "Entschuldigung, ich konnte keine Antwort generieren.";

    chatHistory.push({ role: "assistant", content: reply });
    loadingMsg.innerHTML = linkifyProducts(reply);
  } catch (err) {
    console.error("Chat-Fehler:", err);
    chatHistory.pop();
    loadingMsg.textContent =
      "Verbindung zu LM Studio fehlgeschlagen. Bitte prüfe, ob LM Studio und Tailscale laufen.";
  }
}

// 6. Event-Listener & Klick auf verlinkte Produkte im Chat
document.addEventListener("DOMContentLoaded", () => {
  const fab = document.getElementById("ai-fab");
  const chatWindow = document.getElementById("ai-chat-window");
  const closeBtn = document.getElementById("ai-chat-close");
  const sendBtn = document.getElementById("ai-chat-send");
  const input = document.getElementById("ai-chat-input");
  const messagesBox = document.getElementById("ai-chat-messages");

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

  // Öffnet direkt die Produkt-Detailansicht, wenn ein Link im Chat angeklickt wird
  messagesBox?.addEventListener("click", (e) => {
    const link = e.target.closest(".ai-product-link");
    if (link) {
      const prodId = link.getAttribute("data-product-id");
      if (prodId && typeof allProducts !== "undefined" && typeof showDetail === "function") {
        const found = allProducts.find((p) => p.id === prodId);
        if (found) {
          e.preventDefault();
          showDetail(found);
        }
      }
    }
  });

  checkConnection();
});
