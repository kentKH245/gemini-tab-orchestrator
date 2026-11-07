let myRole = "NONE";
let isWaitingForStream = false;
let isInitializingRole = false;
let lastProcessedMessageCount = 0;

const badge = document.createElement("div");
badge.style.cssText = `
  position: fixed; top: 12px; right: 160px; z-index: 99999;
  padding: 5px 12px; border-radius: 20px; font-family: monospace;
  font-size: 12px; font-weight: bold; color: #fff;
  background: #334155; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  pointer-events: none; transition: all 0.2s ease;
`;
badge.textContent = "Agent: UNASSIGNED";
document.body.appendChild(badge);

function updateBadge(role, status = "Idle") {
  myRole = role;
  if (role === "NONE") {
    badge.style.background = "#334155";
    badge.textContent = "Agent: UNASSIGNED";
  } else if (role === "MASTER") {
    badge.style.background = "#7c3aed";
    badge.textContent = `👑 MASTER (${status})`;
  } else {
    badge.style.background = "#059669";
    badge.textContent = `🤖 ${role} (${status})`;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ROLE_UPDATED") {
    lastProcessedMessageCount = getModelResponses().length;
    isInitializingRole = false;

    if (msg.initPrompt && msg.role !== "NONE") {
      isInitializingRole = true;
      updateBadge(msg.role, "Initializing Persona...");
      injectAndSendPrompt(msg.initPrompt);
    } else {
      updateBadge(msg.role, "Ready");
    }
  }

  if (msg.type === "BATCH_STATUS_UPDATE" && myRole === "MASTER") {
    updateBadge("MASTER", msg.status);
  }

  if (msg.type === "EXECUTE_PROMPT") {
    isInitializingRole = false;
    updateBadge(myRole, "Injecting Task...");
    injectAndSendPrompt(msg.prompt);
  }
});

function getModelResponses() {
  return document.querySelectorAll("model-response, .model-response-text, message-content");
}

function injectAndSendPrompt(text) {
  const editor = document.querySelector('.ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"]');
  if (!editor) return;

  editor.focus();
  editor.innerHTML = "";
  const lines = text.split("\n");
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line || "\u200B";
    editor.appendChild(p);
  });

  editor.dispatchEvent(new Event("input", { bubbles: true }));

  setTimeout(() => {
    const sendBtn = document.querySelector(
      'button.send-button, button[aria-label*="Send"], button[aria-label*="傳送"], button[aria-label*="发送"]'
    );
    lastProcessedMessageCount = getModelResponses().length;
    isWaitingForStream = true;
    updateBadge(myRole, isInitializingRole ? "Binding Persona..." : "Thinking...");

    if (sendBtn) {
      sendBtn.click();
    } else {
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
      );
    }
  }, 350);
}

let streamTimer = null;
const observer = new MutationObserver(() => {
  if (myRole === "NONE") return;

  const responses = getModelResponses();
  if (responses.length > lastProcessedMessageCount && !isWaitingForStream) {
    isWaitingForStream = true;
    updateBadge(myRole, "Streaming...");
  }

  if (!isWaitingForStream) return;

  clearTimeout(streamTimer);
  streamTimer = setTimeout(() => {
    const stopBtn = document.querySelector('button[aria-label*="Stop"], button[aria-label*="停止"]');
    if (stopBtn && stopBtn.offsetParent !== null) return;

    const currentResponses = getModelResponses();
    if (currentResponses.length > lastProcessedMessageCount) {
      const latestNode = currentResponses[currentResponses.length - 1];
      const text = latestNode.innerText.trim();

      if (text.length > 0) {
        isWaitingForStream = false;
        lastProcessedMessageCount = currentResponses.length;

        if (isInitializingRole) {
          isInitializingRole = false;
          updateBadge(myRole, "Ready ✓");
          return;
        }

        updateBadge(myRole, "Idle");
        handleCompletedResponse(text);
      }
    }
  }, 1800);
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });

function handleCompletedResponse(text) {
  if (myRole === "MASTER") {
    // Parse STAGED pipeline blocks like:
    // --- STAGE 1 ---
    // @[RESEARCHER]: task here...
    // --- STAGE 2 ---
    // @[CODER]: task using @[RESEARCHER_OUTPUT]...
    
    const stageBlocks = text.split(/--- STAGE \d+ ---/i);
    const stages = [];

    stageBlocks.forEach((block, idx) => {
      if (idx === 0) return; // ignore text before first stage header
      const regex = /@\[([A-Za-z0-9_-]+)\]:\s*([\s\S]*?)(?=@\[[A-Za-z0-9_-]+\]:|$)/g;
      const tasks = [];
      let match;

      while ((match = regex.exec(block)) !== null) {
        const targetRole = match[1].trim().toUpperCase();
        const task = match[2].trim();
        if (targetRole && task) {
          tasks.push({ targetRole, task });
        }
      }

      if (tasks.length > 0) {
        stages.push({ stageNum: idx, tasks });
      }
    });

    if (stages.length > 0) {
      updateBadge(myRole, `Dispatching ${stages.length}-Stage Pipeline...`);
      chrome.runtime.sendMessage({
        type: "DISPATCH_PIPELINE",
        stages
      });
    }
  } else {
    updateBadge(myRole, "Done -> Stage Barrier");
    chrome.runtime.sendMessage({
      type: "WORKER_RESULT",
      workerRole: myRole,
      result: text
    });
  }
}