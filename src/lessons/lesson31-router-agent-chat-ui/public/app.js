const STORAGE_KEY = "lesson31.routerAgent.sessions.v1";

const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const stopButton = document.querySelector("#stopButton");
const newChatButton = document.querySelector("#newChatButton");

const messages = document.querySelector("#messages");
const statusEl = document.querySelector("#status");
const errorBox = document.querySelector("#errorBox");
const activeSessionTitle = document.querySelector("#activeSessionTitle");
const sessionList = document.querySelector("#sessionList");

const sessionIdEl = document.querySelector("#sessionId");
const requestIdEl = document.querySelector("#requestId");
const durationEl = document.querySelector("#duration");
const selectedAgentEl = document.querySelector("#selectedAgent");
const routerConfidenceEl = document.querySelector("#routerConfidence");

const traceList = document.querySelector("#traceList");
const sourcesList = document.querySelector("#sourcesList");

let sessions = loadSessions();
let activeSessionId = null;

let currentAbortController = null;
let typingTimer = null;
let pendingText = "";
let displayedText = "";
let currentAssistantContent = null;
let currentAssistantMessage = null;
let isGenerating = false;

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createInitialAssistantMessage() {
  return {
    id: createId("msg"),
    role: "assistant",
    content:
      "你好，我是第 31 课的 Router Agent Chat UI。我会先判断问题类型，再交给技术解释、代码助手、学习规划或通用兜底 Agent 处理。",
    createdAt: new Date().toISOString(),
  };
}

function createSession(title = "新会话") {
  const now = new Date().toISOString();

  return {
    id: createId("session"),
    title,
    messages: [createInitialAssistantMessage()],
    traces: [],
    sources: [],
    requestId: "-",
    duration: "-",
    selectedAgent: "-",
    routerConfidence: "-",
    createdAt: now,
    updatedAt: now,
  };
}

function loadSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function getActiveSession() {
  return sessions.find((session) => session.id === activeSessionId) ?? null;
}

function ensureActiveSession() {
  if (sessions.length === 0) {
    const session = createSession();
    sessions.unshift(session);
    activeSessionId = session.id;
    saveSessions();
    return session;
  }

  if (!activeSessionId) {
    activeSessionId = sessions[0].id;
  }

  return getActiveSession();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function renderSessions() {
  clearElement(sessionList);

  for (const session of sessions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      session.id === activeSessionId ? "session-item active" : "session-item";

    const title = document.createElement("div");
    title.className = "session-title";
    title.textContent = session.title;

    const meta = document.createElement("div");
    meta.className = "session-meta";
    meta.textContent = `${session.messages.length} messages`;

    button.appendChild(title);
    button.appendChild(meta);

    button.addEventListener("click", () => {
      if (isGenerating) {
        return;
      }

      activeSessionId = session.id;
      renderApp();
    });

    sessionList.appendChild(button);
  }
}

function createMessageElement(role, content) {
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

function renderMessages(session) {
  clearElement(messages);

  for (const message of session.messages) {
    createMessageElement(message.role, message.content);
  }
}

function resetInspectorEmpty() {
  sessionIdEl.textContent = activeSessionId ?? "-";
  requestIdEl.textContent = "-";
  selectedAgentEl.textContent = "-";
  routerConfidenceEl.textContent = "-";
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

function renderInspector(session) {
  sessionIdEl.textContent = session.id;
  requestIdEl.textContent = session.requestId ?? "-";
  selectedAgentEl.textContent = session.selectedAgent ?? "-";
  routerConfidenceEl.textContent = session.routerConfidence ?? "-";
  durationEl.textContent = session.duration ?? "-";

  clearElement(traceList);
  clearElement(sourcesList);

  if (session.traces.length === 0) {
    const traceEmpty = document.createElement("p");
    traceEmpty.className = "empty";
    traceEmpty.textContent = "等待请求开始...";
    traceList.appendChild(traceEmpty);
  } else {
    for (const step of session.traces) {
      renderTraceStep(step);
    }
  }

  if (session.sources.length === 0) {
    const sourcesEmpty = document.createElement("p");
    sourcesEmpty.className = "empty";
    sourcesEmpty.textContent = "暂无来源";
    sourcesList.appendChild(sourcesEmpty);
  } else {
    for (const source of session.sources) {
      renderSource(source);
    }
  }
}

function removeEmptyState(container) {
  const empty = container.querySelector(".empty");

  if (empty) {
    empty.remove();
  }
}

function renderTraceStep(step) {
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

function renderSource(source) {
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

function upsertTraceStep(step) {
  const session = getActiveSession();

  if (!session) {
    return;
  }

  const index = session.traces.findIndex((item) => item.id === step.id);

  if (index >= 0) {
    session.traces[index] = step;
  } else {
    session.traces.push(step);
  }

  session.updatedAt = new Date().toISOString();

  renderTraceStep(step);
}

function appendSource(source) {
  const session = getActiveSession();

  if (!session) {
    return;
  }

  const existed = session.sources.some((item) => item.id === source.id);

  if (!existed) {
    session.sources.push(source);
    session.updatedAt = new Date().toISOString();
    renderSource(source);
  }
}

function appendMessageToSession(role, content) {
  const session = getActiveSession();

  if (!session) {
    throw new Error("当前没有可用会话");
  }

  const message = {
    id: createId("msg"),
    role,
    content,
    createdAt: new Date().toISOString(),
  };

  session.messages.push(message);
  session.updatedAt = new Date().toISOString();

  return message;
}

function updateSessionTitleFromMessage(message) {
  const session = getActiveSession();

  if (!session || session.title !== "新会话") {
    return;
  }

  session.title = message.length > 24 ? `${message.slice(0, 24)}...` : message;
  activeSessionTitle.textContent = session.title;
}

function renderApp() {
  const session = ensureActiveSession();

  activeSessionTitle.textContent = session.title;
  setStatus("Ready");
  clearError();

  renderSessions();
  renderMessages(session);
  renderInspector(session);
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

function resetTypingState(contentEl, messageRecord) {
  pendingText = "";
  displayedText = "";
  currentAssistantContent = contentEl;
  currentAssistantMessage = messageRecord;

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

    if (currentAssistantMessage) {
      currentAssistantMessage.content = displayedText;
    }

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

    if (currentAssistantMessage) {
      currentAssistantMessage.content = displayedText;
    }
  }

  if (typingTimer) {
    clearInterval(typingTimer);
    typingTimer = null;
  }

  if (currentAssistantContent) {
    currentAssistantContent.classList.remove("cursor");
  }

  saveSessions();
  renderSessions();
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

function formatAgentName(agentName) {
  const names = {
    tech_explainer: "技术解释 Agent",
    code_helper: "代码助手 Agent",
    study_planner: "学习规划 Agent",
    general_fallback: "通用兜底 Agent",
  };

  return names[agentName] ?? agentName;
}

async function sendMessage(message) {
  const session = getActiveSession();

  if (!session) {
    showError("当前没有可用会话");
    return;
  }

  clearError();

  session.traces = [];
  session.sources = [];
  session.requestId = "-";
  session.duration = "-";
  session.selectedAgent = "-";
  session.routerConfidence = "-";
  session.updatedAt = new Date().toISOString();

  resetInspectorEmpty();

  appendMessageToSession("user", message);
  createMessageElement("user", message);

  updateSessionTitleFromMessage(message);

  const assistantRecord = appendMessageToSession("assistant", "");
  const assistantContent = createMessageElement("assistant", "");

  resetTypingState(assistantContent, assistantRecord);
  startTypewriter();

  currentAbortController = new AbortController();

  setStatus("Thinking...");
  setGeneratingState(true);
  saveSessions();
  renderSessions();

  try {
    const response = await fetch("/api/agent-demo/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        sessionId: session.id,
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
          session.requestId = payload.requestId;
          sessionIdEl.textContent = payload.sessionId;
          requestIdEl.textContent = payload.requestId;
          setStatus("Streaming...");
        }

        if (payload.type === "trace") {
          upsertTraceStep(payload.step);
        }

        if (payload.type === "router") {
          const agentLabel = formatAgentName(payload.decision.targetAgent);

          session.selectedAgent = agentLabel;
          session.routerConfidence = String(payload.decision.confidence);

          selectedAgentEl.textContent = agentLabel;
          routerConfidenceEl.textContent = String(payload.decision.confidence);

          saveSessions();
        }

        if (payload.type === "source") {
          appendSource(payload.source);
        }

        if (payload.type === "delta") {
          enqueueTypingText(payload.content);
        }

        if (payload.type === "done") {
          session.duration = `${payload.durationMs}ms`;
          durationEl.textContent = session.duration;
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

    const messageText =
      error instanceof Error ? error.message : "请求失败，请稍后重试。";

    if (currentAssistantContent) {
      currentAssistantContent.textContent = messageText;
    }

    if (currentAssistantMessage) {
      currentAssistantMessage.content = messageText;
    }

    showError(messageText);
    setStatus("Error");
  } finally {
    currentAbortController = null;
    setGeneratingState(false);
    saveSessions();
    renderSessions();
    input.focus();
  }
}

newChatButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  const session = createSession();
  sessions.unshift(session);
  activeSessionId = session.id;
  saveSessions();
  renderApp();
});

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

renderApp();
