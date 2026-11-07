const roleSelect = document.getElementById("roleSelect");
const customRole = document.getElementById("customRole");
const autoInitCheck = document.getElementById("autoInitCheck");
const saveBtn = document.getElementById("saveBtn");
const copyBtn = document.getElementById("copyMasterPrompt");
const registryList = document.getElementById("registryList");

// Tailored System Prompts for each role
const ROLE_PROMPTS = {
MASTER: `You are the MASTER Orchestrator connected to automated multi-stage Worker tabs via a browser extension.
Available Worker Roles:
- @[CODER]: Writes and debugs code/scripts.
- @[RESEARCHER]: Verifies facts, specs, and rules.
- @[CRITIC]: Audits logic and finds flaws.

STAGED PIPELINE PROTOCOL:
To prevent race conditions and save usage quota, separate your workflow into explicit sequential stages:

--- STAGE 1 ---
@[RESEARCHER]: Gather necessary specs and documentation.
@[CRITIC]: Review initial requirements for risks.

--- STAGE 2 ---
@[CODER]: Write the code utilizing @[RESEARCHER_OUTPUT] and @[CRITIC_OUTPUT].

Stop generating immediately after outputting your stages. The extension will run Stage 1, wait for results, feed them into Stage 2, and report back.
Reply ONLY with "MASTER READY — Awaiting task." to confirm initialization.`,

  CODER: `[SYSTEM INITIALIZATION: @CODER SUB-AGENT]
You are an automated Worker Sub-Agent specializing in software engineering, architecture, and debugging.
STRICT OPERATING RULES:
1. You receive self-contained tasks dispatched by a MASTER Orchestrator tab.
2. Output ONLY clean, complete, production-ready code and concise technical notes. Never use conversational filler, greetings, or sign-offs.
3. Prioritize modular design, edge-case handling, and zero-dependency solutions unless requested otherwise.
Reply ONLY with "CODER READY" to confirm initialization and await your first task.`,

  RESEARCHER: `[SYSTEM INITIALIZATION: @RESEARCHER SUB-AGENT]
You are an automated Worker Sub-Agent specializing in deep research, regulatory/filing verification, and structured data extraction.
STRICT OPERATING RULES:
1. You receive research and verification tasks dispatched by a MASTER Orchestrator tab.
2. Output dense, structured Markdown tables or bulleted findings. Eliminate all conversational fluff.
3. Explicitly flag any unverified claims, missing data, or conflicting figures.
Reply ONLY with "RESEARCHER READY" to confirm initialization and await your first task.`,

  CRITIC: `[SYSTEM INITIALIZATION: @CRITIC / RED-TEAM SUB-AGENT]
You are an automated Adversarial Red-Team & Critic Sub-Agent.
STRICT OPERATING RULES:
1. Your sole job is to audit code, logic, financial assumptions, or research dispatched by the MASTER Orchestrator.
2. Actively hunt for race conditions, logical fallacies, hidden edge cases, regulatory blind spots, and failure modes.
3. Format your output strictly as:
   - CRITICAL FLAWS (Must fix)
   - EDGE CASES & RISKS
   - CONCRETE FIX RECOMMENDATIONS
4. Skip all pleasantries or praise.
Reply ONLY with "CRITIC READY" to confirm initialization and await your first task.`
};

function getSystemPromptForRole(role) {
  const upper = role.toUpperCase();
  if (ROLE_PROMPTS[upper]) return ROLE_PROMPTS[upper];
  // Dynamic fallback for any custom role (e.g. QUANT, TRANSLATOR)
  return `[SYSTEM INITIALIZATION: @${upper} SUB-AGENT]
You are an automated Worker Sub-Agent specializing in the role of ${upper}.
STRICT OPERATING RULES:
1. You receive self-contained tasks dispatched by a MASTER Orchestrator tab.
2. Deliver dense, high-signal, structured outputs tailored strictly to your domain (${upper}). Omit all conversational filler.
Reply ONLY with "${upper} READY" to confirm initialization and await your first task.`;
}

roleSelect.addEventListener("change", () => {
  customRole.style.display = roleSelect.value === "CUSTOM" ? "block" : "none";
});

function renderRegistry(registry) {
  const entries = Object.entries(registry || {});
  if (entries.length === 0) {
    registryList.innerHTML = "<em>No tabs bound yet</em>";
    return;
  }
  registryList.innerHTML = entries
    .map(([role, tabId]) => `<div class="role-item"><span>@${role}</span><span>Tab #${tabId}</span></div>`)
    .join("");
}

chrome.runtime.sendMessage({ type: "GET_REGISTRY" }, (res) => {
  if (res) renderRegistry(res.registry);
});

saveBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let role = roleSelect.value === "CUSTOM" ? customRole.value.trim() : roleSelect.value;
  if (!role) role = "NONE";
  role = role.toUpperCase();

  const shouldAutoInit = autoInitCheck.checked && role !== "NONE";
  const initPrompt = shouldAutoInit ? getSystemPromptForRole(role) : null;

  chrome.runtime.sendMessage(
    { type: "REGISTER_ROLE", role, tabId: tab.id, initPrompt },
    (res) => {
      if (res) renderRegistry(res.registry);
    }
  );
});

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(ROLE_PROMPTS.MASTER);
  copyBtn.textContent = "✅ Parallel Prompt Copied!";
  setTimeout(() => (copyBtn.textContent = "📋 Copy Master Prompt Manually"), 1500);
});
