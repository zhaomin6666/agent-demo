const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const messages = document.querySelector("#messages");
const statusEl = document.querySelector("#status");

function setStatus(text) {
  statusEl.textContent = text;
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function createMessage(role, content) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const roleEl = document.createElement("div");
  roleEl.className = "role";
  roleEl.textContent = role === "user" ? "You" : "AI Agent";

  const contentEl = document.createElement("div");
  contentEl.className = "content";
  contentEl.textContent = content;

  wrapper.appendChild(roleEl);
  wrapper.appendChild(contentEl);
  messages.appendChild(wrapper);

  scrollToBottom();

  return contentEl;
}

function parseSseEvents(buffer) {
  const events = [];
  const parts = buffer.split("\n\n");

  const remaining = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");

    let eventName = "message";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      }

      if (line.startsWith("data:")) {
        data += line.slice("data:".length).trim();
      }
    }

    if (data) {
      events.push({
        eventName,
        data,
      });
    }
  }

  return {
    events,
    remaining,
  };
}

async function sendMessage(message) {
  createMessage("user", message);
  const assistantContent = createMessage("assistant", "");

  setStatus("Thinking...");
  sendButton.disabled = true;
  input.disabled = true;

  try {
    const response = await fetch("/api/agent-demo/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`请求失败：${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let fullAnswer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const parsed = parseSseEvents(buffer);
      buffer = parsed.remaining;

      for (const event of parsed.events) {
        const payload = JSON.parse(event.data);

        if (payload.type === "start") {
          setStatus("Streaming...");
        }

        if (payload.type === "delta") {
          fullAnswer += payload.content;
          assistantContent.textContent = fullAnswer;
          scrollToBottom();
        }

        if (payload.type === "done") {
          setStatus(`Done · ${payload.durationMs}ms`);
        }

        if (payload.type === "error") {
          throw new Error(payload.message);
        }
      }
    }
  } catch (error) {
    assistantContent.textContent =
      error instanceof Error ? error.message : "请求失败，请稍后重试。";
    setStatus("Error");
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();

  if (!message) {
    return;
  }

  input.value = "";

  await sendMessage(message);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    form.requestSubmit();
  }
});