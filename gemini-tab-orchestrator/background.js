// Stores mapping: { ROLE_NAME: tabId }
let agentRegistry = {};

// Staged Batch State Tracker
let activePipeline = {
  isRunning: false,
  currentStageIndex: 0,
  stages: [], // Array of stage objects: { stageNum, tasks: [{ targetRole, task }] }
  stageResults: {}, // { ROLE_NAME: "output text" }
  timeoutId: null
};

chrome.storage.local.get(["agentRegistry"], (res) => {
  if (res.agentRegistry) agentRegistry = res.agentRegistry;
});

function saveRegistry() {
  chrome.storage.local.set({ agentRegistry });
}

function notifyMasterStatus(statusText) {
  const masterTabId = agentRegistry["MASTER"];
  if (masterTabId) {
    chrome.tabs.sendMessage(masterTabId, {
      type: "BATCH_STATUS_UPDATE",
      status: statusText
    }).catch(() => {});
  }
}

// Advance to the next stage or finalize the pipeline
function processNextStage() {
  if (!activePipeline.isRunning) return;

  if (activePipeline.currentStageIndex >= activePipeline.stages.length) {
    // Pipeline complete! Flush final aggregated report to MASTER
    clearTimeout(activePipeline.timeoutId);
    activePipeline.isRunning = false;

    const masterTabId = agentRegistry["MASTER"];
    if (!masterTabId) return;

    let finalReport = `[SYSTEM: Multi-Stage Pipeline Complete]\n\n`;
    for (const [role, output] of Object.entries(activePipeline.stageResults)) {
      finalReport += `==============================\n`;
      finalReport += `### FINAL REPORT FROM @[${role}]\n`;
      finalReport += `==============================\n`;
      finalReport += `${output}\n\n`;
    }
    finalReport += `[SYSTEM: All pipeline stages finished. Synthesize the final deliverable for the user.]`;

    notifyMasterStatus("Pipeline Complete ✓");
    chrome.tabs.sendMessage(masterTabId, {
      type: "EXECUTE_PROMPT",
      prompt: finalReport,
      fromRole: "PIPELINE_ORCHESTRATOR"
    });
    return;
  }

  const currentStage = activePipeline.stages[activePipeline.currentStageIndex];
  notifyMasterStatus(`Running Stage ${activePipeline.currentStageIndex + 1}/${activePipeline.stages.length}`);

  // Fire all tasks in this stage simultaneously
  activePipeline.expectedRoles = new Set();
  activePipeline.stageBatchResults = {};

  currentStage.tasks.forEach(({ targetRole, task }) => {
    const role = targetRole.toUpperCase();
    const targetTabId = agentRegistry[role];

    // Inject prior stage outputs as context if needed
    let contextualizedTask = task;
    for (const [prevRole, prevOutput] of Object.entries(activePipeline.stageResults)) {
      contextualizedTask = contextualizedTask.replace(`@[${prevRole}_OUTPUT]`, prevOutput);
    }

    activePipeline.expectedRoles.add(role);

    if (!targetTabId) {
      activePipeline.stageBatchResults[role] = `[ERROR: No tab registered for role @${role}]`;
      checkStageCompletion();
    } else {
      chrome.tabs.sendMessage(targetTabId, {
        type: "EXECUTE_PROMPT",
        prompt: contextualizedTask,
        fromRole: "MASTER"
      });
    }
  });

  // 90s safety timeout per stage
  clearTimeout(activePipeline.timeoutId);
  activePipeline.timeoutId = setTimeout(() => {
    forceCompleteStageDueToTimeout();
  }, 90000);
}

function checkStageCompletion() {
  if (!activePipeline.isRunning) return;

  const remaining = [...activePipeline.expectedRoles].filter(
    (role) => !(role in activePipeline.stageBatchResults)
  );

  if (remaining.length > 0) return;

  // Stage finished -> save results into pipeline history and advance
  for (const [role, output] of Object.entries(activePipeline.stageBatchResults)) {
    activePipeline.stageResults[role] = output;
  }

  activePipeline.currentStageIndex++;
  processNextStage();
}

function forceCompleteStageDueToTimeout() {
  if (!activePipeline.isRunning) return;
  for (const role of activePipeline.expectedRoles) {
    if (!(role in activePipeline.stageBatchResults)) {
      activePipeline.stageBatchResults[role] = `[ERROR: Worker @${role} timed out.]`;
    }
  }
  checkStageCompletion();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "REGISTER_ROLE") {
    const { role, tabId, initPrompt } = msg;
    for (const [k, v] of Object.entries(agentRegistry)) {
      if (v === tabId) delete agentRegistry[k];
    }
    if (role !== "NONE") {
      agentRegistry[role.toUpperCase()] = tabId;
    }
    saveRegistry();

    chrome.tabs.sendMessage(tabId, {
      type: "ROLE_UPDATED",
      role: role.toUpperCase(),
      initPrompt: initPrompt || null
    }).catch(() => {});

    sendResponse({ status: "OK", registry: agentRegistry });
    return true;
  }

  if (msg.type === "GET_REGISTRY") {
    sendResponse({ registry: agentRegistry });
    return true;
  }

  // Receive multi-stage pipeline from MASTER
  if (msg.type === "DISPATCH_PIPELINE") {
    const stages = msg.stages || [];
    if (stages.length === 0) return;

    clearTimeout(activePipeline.timeoutId);
    activePipeline = {
      isRunning: true,
      currentStageIndex: 0,
      stages: stages,
      stageResults: {},
      timeoutId: null
    };

    processNextStage();
    return true;
  }

  if (msg.type === "WORKER_RESULT") {
    const role = msg.workerRole.toUpperCase();

    if (activePipeline.isRunning && activePipeline.expectedRoles.has(role)) {
      activePipeline.stageBatchResults[role] = msg.result;
      checkStageCompletion();
    } else {
      // Fallback for unscheduled output
      const masterTabId = agentRegistry["MASTER"];
      if (masterTabId) {
        chrome.tabs.sendMessage(masterTabId, {
          type: "EXECUTE_PROMPT",
          prompt: `[SYSTEM: Unscheduled Output from @${role}]\n\n${msg.result}`,
          fromRole: role
        });
      }
    }
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [role, id] of Object.entries(agentRegistry)) {
    if (id === tabId) {
      delete agentRegistry[role];
      saveRegistry();
    }
  }
});