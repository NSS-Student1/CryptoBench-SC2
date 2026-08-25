(function () {
  const API_BASE = window.CRYPTOBENCH_API_BASE || "http://127.0.0.1:8088";
  const providerIcons = {
    "OpenAI": "https://openai.com/favicon.ico",
    "Anthropic": "https://www.anthropic.com/favicon.ico",
    "Google": "https://www.google.com/favicon.ico",
    "Moonshot AI": "https://www.moonshot.cn/favicon.ico",
    "DeepSeek": "https://www.deepseek.com/favicon.ico",
    "Alibaba": "https://qwenlm.github.io/favicon.ico",
    "Meta": "https://www.meta.com/favicon.ico",
    "Mistral": "https://mistral.ai/favicon.ico"
  };

  function pageName() {
    const name = window.location.pathname.split("/").pop() || "index.html";
    return name === "" ? "index.html" : name;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function api(path, options) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  function ensureApiBadge() {
    return null;
    const navLinks = document.querySelector(".nav-links");
    if (!navLinks || document.querySelector("[data-api-status]")) return null;
    const item = document.createElement("li");
    item.innerHTML = '<span class="nav-link" data-api-status><span class="nav-icon">●</span>API</span>';
    navLinks.insertBefore(item, navLinks.lastElementChild);
    return item.querySelector("[data-api-status]");
  }

  function setApiStatus(online) {
    const badge = ensureApiBadge();
    if (!badge) return;
    badge.style.color = online ? "#9be7c1" : "#f5c16c";
    badge.title = online ? "Backend connected" : "Backend offline, showing embedded fallback data";
    const icon = badge.querySelector(".nav-icon");
    if (icon) {
      icon.style.color = online ? "#9be7c1" : "#f5c16c";
      icon.textContent = online ? "●" : "○";
    }
  }

  function toast(message) {
    let node = document.querySelector("[data-api-toast]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.apiToast = "true";
      node.style.cssText = [
        "position:fixed",
        "right:22px",
        "bottom:22px",
        "z-index:100",
        "max-width:360px",
        "padding:13px 15px",
        "border:1px solid rgba(154,166,188,.22)",
        "border-radius:10px",
        "background:rgba(8,12,21,.94)",
        "color:#edf2fb",
        "box-shadow:0 20px 70px rgba(0,0,0,.45)",
        "font-weight:800"
      ].join(";");
      document.body.appendChild(node);
    }
    node.textContent = message;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.remove(), 3200);
  }

  function iconHtml(model) {
    if (model.mode === "human") {
      return '<span class="result-icon human">H</span>';
    }
    const src = providerIcons[model.provider];
    if (src) {
      return `<span class="result-icon"><img src="${escapeHtml(src)}" alt="${escapeHtml(model.provider)}"></span>`;
    }
    return `<span class="result-icon">${escapeHtml(model.provider.slice(0, 1))}</span>`;
  }

  function tagHtml(model) {
    const tags = [];
    if (model.openness === "closed") tags.push('<span class="result-tag closed">closed params</span>');
    if (model.openness === "open-weights") tags.push('<span class="result-tag open">open weights</span>');
    if (model.openness === "reference") tags.push('<span class="result-tag">reference</span>');
    if (model.parameter_scale && model.parameter_scale !== "closed" && model.parameter_scale !== "n/a") {
      tags.push(`<span class="result-tag">${escapeHtml(model.parameter_scale)}</span>`);
    }
    if (model.mode === "tool-agent") tags.push('<span class="result-tag agent">tool agent</span>');
    if (model.mode === "model-only") tags.push('<span class="result-tag base">base LLM</span>');
    return tags.join("");
  }

  function modelMeta(row) {
    const score = row.score;
    const model = row.model;
    const tools = model.tools && model.tools.length ? model.tools.slice(0, 3).join(" + ") : "no external tools";
    return `${model.mode} · ${tools} · T1 ${score.t1} · T4 ${score.t4} · T5 ${score.t5}`;
  }

  function renderModels(rows) {
    const list = document.querySelector(".result-list");
    if (!list) return;
    const titleCount = document.querySelector(".results-title span");
    if (titleCount) titleCount.textContent = `${rows.length} evaluated systems`;

    list.innerHTML = rows.map((row) => `
      <a class="result-row" href="analysis.html" data-model-name="${escapeHtml(row.model.name.toLowerCase())}">
        <div class="result-main">
          ${iconHtml(row.model)}
          <div>
            <div class="result-name">${escapeHtml(row.model.name)}</div>
            <div class="result-meta">${escapeHtml(modelMeta(row))}</div>
            <div class="result-tags">${tagHtml(row.model)}</div>
          </div>
        </div>
        <div class="result-score">${Number(row.score.overall).toFixed(1)}</div>
      </a>
    `).join("");

    const search = document.querySelector(".results-search");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      search.style.cursor = "text";
      search.addEventListener("click", () => {
        const value = window.prompt("Filter by model, provider, mode, or tool");
        if (value === null) return;
        const needle = value.trim().toLowerCase();
        document.querySelectorAll(".result-row").forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(needle) ? "" : "none";
        });
      });
    }
  }

  function renderCompare(rows) {
    const selected = document.querySelector(".compare-selected");
    if (!selected) return;
    const agent = rows.find((row) => row.model.id === "gpt-5-5-agent") || rows[1] || rows[0];
    const base = rows.find((row) => row.model.id === "gpt-5-5-base") || rows.find((row) => row.model.mode === "model-only") || rows[2] || rows[0];
    const claude = rows.find((row) => row.model.id === "claude-opus-4-7-agent") || rows[2] || rows[0];
    const chosen = [agent, base, claude].filter(Boolean);

    selected.innerHTML = chosen.map((row) => `
      <div class="compare-model">
        <div class="compare-check">✓</div>
        <div><div class="compare-name">${escapeHtml(row.model.name)}</div><div class="compare-meta">${escapeHtml(row.model.mode)} · ${escapeHtml(row.model.provider)} · ${escapeHtml(row.model.parameter_scale)}</div></div>
        <div class="compare-score">${Number(row.score.overall).toFixed(1)}</div>
      </div>
    `).join("");

    if (agent && base) {
      const metrics = [
        ["Overall", "overall"],
        ["T1 理解", "t1"],
        ["T4 实现", "t4"],
        ["T5 修复", "t5"]
      ];
      const bars = document.querySelector(".compare-bars");
      if (bars) {
        bars.innerHTML = metrics.map(([label, key]) => {
          const delta = Number(agent.score[key]) - Number(base.score[key]);
          const width = Math.max(8, Math.min(100, Math.abs(delta) * 3));
          return `<div class="compare-bar-row"><strong>${label}</strong><div class="compare-track"><div class="compare-fill" style="--w:${width}%"></div></div><span>${delta >= 0 ? "+" : ""}${delta.toFixed(1)}</span></div>`;
        }).join("");
      }
    }

    const table = document.querySelector(".compare-table");
    if (table) {
      table.innerHTML = `
        <div class="compare-table-row heading"><div>System</div><div>Mode</div><div>Tools</div><div>Score</div></div>
        ${chosen.map((row) => `<div class="compare-table-row"><div>${escapeHtml(row.model.name)}</div><div>${escapeHtml(row.model.mode)}</div><div>${escapeHtml(row.model.tools.length ? row.model.tools.slice(0, 2).join(" + ") : "None")}</div><div>${Number(row.score.overall).toFixed(1)}</div></div>`).join("")}
      `;
    }
  }

  function renderReports(reports, leaderboard) {
    const queue = document.querySelector(".queue-list");
    if (!queue) return;
    const models = new Map((leaderboard || []).map((row) => [row.model.id, row.model]));
    queue.innerHTML = reports.map((report, index) => {
      const model = models.get(report.model_id);
      const statusClass = report.status === "validated" ? "done" : report.status === "queued" ? "" : "warn";
      return `<div class="queue-row">
        <span class="status-dot ${statusClass}"></span>
        <div><div class="queue-name">${escapeHtml(model ? model.name : report.model_id)} · ${escapeHtml(report.mode)}</div><div class="queue-meta">${escapeHtml(report.track.toUpperCase())} track · ${report.repeat_runs}x repeated runs · ${escapeHtml(report.status)}</div></div>
        <div class="queue-score">${Number(report.score?.overall ?? 0).toFixed(1)}</div>
      </div>`;
    }).join("");

    const first = reports[0];
    if (!first) return;
    const summary = document.querySelector(".report-summary");
    if (summary) {
      summary.innerHTML = ["overall", "t1", "t4", "t5"].map((key) => `
        <div class="report-stat"><strong>${Number(first.score[key]).toFixed(1)}</strong><span>${key.toUpperCase()}</span></div>
      `).join("");
    }
    const artifacts = document.querySelector(".artifact-grid");
    if (artifacts) {
      artifacts.innerHTML = first.artifacts.map((artifact) => `
        <div class="artifact-card"><strong>${escapeHtml(artifact)}</strong><span>Generated evaluation artifact for ${escapeHtml(first.id)}.</span></div>
      `).join("");
    }
  }

  function renderTrack(tasks) {
    const pipeline = document.querySelector("#sc-track .eval-pipeline");
    if (!pipeline) return;
    pipeline.innerHTML = tasks.map((task) => `
      <div class="eval-step-card">
        <div class="eval-step-num">${escapeHtml(task.id)}</div>
        <div><div class="eval-step-title">${escapeHtml(task.name)}</div><div class="eval-step-desc">${escapeHtml(task.description)}</div></div>
        <div class="eval-step-status">${escapeHtml(task.cn_name)}</div>
      </div>
    `).join("");
  }

  async function bindEvaluationCreate() {
    const button = document.querySelector("#evaluation .eval-action.primary");
    if (!button || button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const evaluation = await api("/api/evaluations", {
          method: "POST",
          body: JSON.stringify({
            model_id: "gpt-5-5-agent",
            track: "sc",
            mode: "tool-agent",
            repeat_runs: 4,
            budget_minutes: 30,
            tools: ["Python", "OCP", "Z3", "MILP", "SAT", "CP"]
          })
        });
        toast(`Evaluation queued: ${evaluation.id}`);
      } catch (error) {
        toast("Backend unavailable: evaluation was not created");
      }
    });
  }

  function updateHome(platform, leaderboard) {
    const heroCopy = document.querySelector(".hero-copy");
    if (heroCopy && platform) {
      heroCopy.textContent = "CryptoBench is a cryptanalysis benchmark platform for evaluating whether large-model agents can complete verifiable research workflows. CryptoBench-SC is the first public track, focused on symmetric-cipher analysis.";
    }
    const metrics = document.querySelectorAll(".hero-metrics .metric-value");
    if (metrics.length >= 1 && leaderboard && leaderboard.length) {
      metrics[0].textContent = Number(leaderboard[0].score.overall).toFixed(1);
    }
  }

  async function init() {
    ensureApiBadge();
    let online = false;
    let leaderboard = [];
    try {
      await api("/api/health");
      online = true;
      setApiStatus(true);
      leaderboard = await api("/api/leaderboard?track=sc&metric=overall");
    } catch (error) {
      setApiStatus(false);
      return;
    }

    const current = pageName();
    if (current === "index.html") {
      const platform = await api("/api/platform");
      updateHome(platform, leaderboard);
    }
    if (current === "models.html") renderModels(leaderboard);
    if (current === "compare.html") renderCompare(leaderboard);
    if (current === "reports.html") {
      const reports = await api("/api/reports?track=sc");
      renderReports(reports, leaderboard);
    }
    if (current === "sc-track.html") {
      const tasks = await api("/api/tasks?track=sc");
      renderTrack(tasks);
    }
    if (current === "evaluation.html") bindEvaluationCreate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
