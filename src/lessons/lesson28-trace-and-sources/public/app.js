const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const stopButton = document.querySelector("#stopButton");
const messages = document.querySelector("#messages");
const statusEl = document.querySelector("#status");

const requestIdEl = document.querySelector("#requestId");
const durationEl = document.querySelector("#duration");
const traceList = document.querySelector("#traceList");
const sourcesList = document.querySelector("#sourcesList");

let currentAbortController = null;
let typingTimer = null;
let pendingText = "";
let displayedText = "";
let currentAssistantContent = null;
let isGenerating = false;

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

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function resetInspector() {
  requestIdEl.textContent = "-";
  durationEl.textContent = "-";

  clearElement(traceList);
  clearElement(sourcesList);

  const traceEmpty = document.createElement("p");
  traceEmpty.className = "empty";
  traceEmpty.textContent = "等待请求开始...";
  traceList.appendChild(traceEmpty);

  const sourcesEmpty = document.createElement("p");
  sourcesEmpty.className = "empty";
  sourcesEmpty.textContent = "暂无来源";
  sourcesList.appendChild(sourcesEmpty);
}

function removeEmptyState(container) {
  const empty = container.querySelector(".empty");

  if (empty) {
    empty.remove();
  }
}

function upsertTraceStep(step) {
  removeEmptyState(traceList);

  let item = traceList.querySelector(`[data-step-id="${step.id}"]`);

  if (!item) {
    item = document.createElement("div");
    item.dataset.stepId = step.id;
    traceList.appendChild(item);
  }

  item.className = `trace-item ${step.status}`;

  clearElement(item);

  const head = document.createElement("div");
  head.className = "trace-head";

  const title = document.createElement("div");
  title.className = "trace-title";
  title.textContent = step.title;

  const status = document.createElement("span");
  status.className = "trace-status";
  status.textContent = step.status;

  head.appendChild(title);
  head.appendChild(status);

  const detail = document.createElement("p");
  detail.className = "trace-detail";
  detail.textContent = step.detail ?? "";

  const time = document.createElement("div");
  time.className = "trace-time";

  const durationText =
    typeof step.durationMs === "number" ? ` · ${step.durationMs}ms` : "";

  time.textContent = `${new Date(step.timestamp).toLocaleTimeString()}${durationText}`;

  item.appendChild(head);
  item.appendChild(detail);
  item.appendChild(time);
}

function appendSource(source) {
  removeEmptyState(sourcesList);

  const existed = sourcesList.querySelector(`[data-source-id="${source.id}"]`);

  if (existed) {
    return;
  }

  const item = document.createElement("div");
  item.className = "source-item";
  item.dataset.sourceId = source.id;

  const title = document.createElement("div");
  title.className = "source-title";
  title.textContent = source.title;

  const snippet = document.createElement("p");
  snippet.className = "source-snippet";
  snippet.textContent = source.snippet;

  const type = document.createElement("div");
  type.className = "source-type";
  type.textContent = `type: ${source.type}`;

  item.appendChild(title);
  item.appendChild(snippet);
  item.appendChild(type);

  sourcesList.appendChild(item);
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

function setGeneratingState(generating) {
  isGenerating = generating;

  sendButton.disabled = generating;
  stopButton.disabled = !generating;
  input.disabled = generating;
}

function resetTypingState(contentEl) {
  pendingText = "";
  displayedText = "";
  currentAssistantContent = contentEl;

  if (typingTimer) {
    clearInterval(typingTimer);
    typingTimer = null;
  }
}

function startTypewriter() {
  if (typingTimer) {
    clearInterval(typingTimer);
  }

  if (currentAssistantContent) {
    currentAssistantContent.classList.add("cursor");
  }

  typingTimer = setInterval(() => {
    if (!currentAssistantContent) {
      return;
    }

    if (pendingText.length === 0) {
      return;
    }

    const nextChar = pendingText.slice(0, 1);
    pendingText = pendingText.slice(1);

    displayedText += nextChar;
    currentAssistantContent.textContent = displayedText;

    scrollToBottom();
  }, 24);
}

function enqueueTypingText(text) {
  pendingText += text;
}

function stopTypewriter({ flush = false } = {}) {
  if (flush && currentAssistantContent && pendingText.length > 0) {
    displayedText += pendingText;
    pendingText = "";
    currentAssistantContent.textContent = displayedText;
  }

  if (typingTimer) {
    clearInterval(typingTimer);
    typingTimer = null;
  }

  if (currentAssistantContent) {
    currentAssistantContent.classList.remove("cursor");
  }

  scrollToBottom();
}

function stopGenerating() {
  if (!isGenerating) {
    return;
  }

  if (currentAbortController) {
    currentAbortController.abort();
  }

  setStatus("Stopped");
  setGeneratingState(false);
  stopTypewriter({
    flush: false,
  });
}

async function sendMessage(message) {
  resetInspector();
  createMessage("user", message);

  const assistantContent = createMessage("assistant", "");
  resetTypingState(assistantContent);
  startTypewriter();

  currentAbortController = new AbortController();

  setStatus("Thinking...");
  setGeneratingState(true);

  try {
    const response = await fetch("/api/agent-demo/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
      signal: currentAbortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`请求失败：${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

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
          requestIdEl.textContent = payload.requestId;
          setStatus("Streaming...");
        }

        if (payload.type === "trace") {
          upsertTraceStep(payload.step);
        }

        if (payload.type === "source") {
          appendSource(payload.source);
        }

        if (payload.type === "delta") {
          enqueueTypingText(payload.content);
        }

        if (payload.type === "done") {
          durationEl.textContent = `${payload.durationMs}ms`;
          setStatus(`Done · ${payload.durationMs}ms`);
        }

        if (payload.type === "error") {
          throw new Error(payload.message);
        }
      }
    }

    stopTypewriter({
      flush: true,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    stopTypewriter({
      flush: true,
    });

    if (currentAssistantContent) {
      currentAssistantContent.textContent =
        error instanceof Error ? error.message : "请求失败，请稍后重试。";
    }

    setStatus("Error");
  } finally {
    currentAbortController = null;
    setGeneratingState(false);
    input.focus();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isGenerating) {
    return;
  }

  const message = input.value.trim();

  if (!message) {
    return;
  }

  input.value = "";

  await sendMessage(message);
});

stopButton.addEventListener("click", () => {
  stopGenerating();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    form.requestSubmit();
  }
});