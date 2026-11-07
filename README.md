# Gemini Tab Orchestrator: A Multi-Agent Bridge (`gemini-tab-orchestrator`)

Connect multiple Gemini chat tabs into an automated, multi-stage parallel Master/Worker agent team right inside your browser. Orchestrate complex side projects locally or trigger pipelines remotely straight from the Gemini mobile app.


https://github.com/user-attachments/assets/fe32f86b-61f8-40a8-8e4c-eb5e5029b9dd

---

## Key Features

* **Zero Infrastructure / No APIs:** Runs entirely inside regular browser tabs using DOM automation and a lightweight Manifest V3 Chrome extension.
* **Mobile App Integration:** Send prompts to your `MASTER` chat from your phone while away from your desk. The extension picks it up, runs the pipeline, and syncs the final synthesized result back to your mobile history.
* **Staged DAG Pipelines:** Prevent race conditions by grouping tasks into explicit sequential stages (`--- STAGE 1 ---` followed by `--- STAGE 2 ---`), passing prior worker outputs seamlessly (e.g., `@[RESEARCHER_OUTPUT]`).
* **Built-in Role Personas:** One-click binding and initialization for `MASTER`, `CODER`, `RESEARCHER`, `CRITIC`, or custom roles with silent handshake locks.
* **Usage Limit Safeguards:** Designed to protect your quota by executing tasks in structured stages rather than firing everything blindly at once.

---

## 📂 Project Structure

```text
gemini-multi-agent-bridge/
├── manifest.json      # Extension configuration (Manifest V3)
├── background.js      # Staged pipeline orchestrator & barrier queue
├── content.js         # DOM stream observer, injector & pipeline parser
├── popup.html         # Control panel UI
└── popup.js           # Role bindings & tailored system prompt library
```

---

## 🚀 Installation Guide

1. Clone or download this repository as a ZIP file and extract it.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner and select the extension folder.

---

## 💡 How to Use

1. Open **4 separate Gemini tabs** in Chrome.
2. Click the extension icon on each tab to assign and bind their roles:
   * **Tab 1:** `👑 MASTER` (Orchestrator)
   * **Tab 2:** `💻 CODER` (Worker)
   * **Tab 3:** `🔍 RESEARCHER` (Worker)
   * **Tab 4:** `🛡️ CRITIC` (Worker)
   * **Tab 5:** `User defined worker` (Worker)
3. Use the one-click button in the popup to copy the Master system prompt, or structure your master prompt using staged blocks:

```text
--- STAGE 1 ---
@[RESEARCHER]: Gather API requirements...
@[CRITIC]: Audit edge-case risks...

--- STAGE 2 ---
@[CODER]: Write implementation based on @[RESEARCHER_OUTPUT] and @[CRITIC_OUTPUT].
```

4. Watch your browser tabs collaborate automatically—or trigger the pipeline on the go using the Gemini mobile app!
