import "./styles.css";

const project = {
  "slug": "retailpulse-bi-recommender",
  "title": "RetailPulse BI & Recommendation Platform",
  "summary": "RetailPulse is a retail/e-commerce data product chaining ETL, a DuckDB analytical warehouse, RFM segmentation, cohort retention, market basket analysis and a 3-tier recommendation cascade, extended with time-series forecasting, deep-learning customer modeling, NLP product embeddings and an A/B testing framework. A FastAPI backend serves the analytics, while Next.js and Streamlit front-ends provide interactive dashboards, all verified with pytest and Playwright and shipped via Docker.",
  "category": "ai-data",
  "year": 2026,
  "status": "completed",
  "technologies": [
    "Python",
    "FastAPI",
    "DuckDB",
    "scikit-learn",
    "PyTorch",
    "statsmodels",
    "Next.js",
    "TypeScript",
    "Streamlit",
    "Docker"
  ],
  "githubUrl": "https://github.com/Justin21523/retailpulse-bi-recommender",
  "readmeUrl": "https://github.com/Justin21523/retailpulse-bi-recommender#readme",
  "problem": "Retailers generate thousands of transactions but struggle to answer who their best customers are, whether customers return, what sells together and what to recommend next — they lack an end-to-end system that turns data into decisions.",
  "solution": "Built a data-to-decisions pipeline: clean transactions into an 8-table DuckDB warehouse, compute RFM, cohort and product features, segment with K-Means and mine Apriori association rules, then recommend through a FBT to segment-popular to global-popular cascade. Extended with SARIMA/LSTM forecasting, autoencoder and gradient-boosting customer modeling, SBERT/item2vec product embeddings and an A/B testing framework, all surfaced via FastAPI, Next.js and Streamlit.",
  "architecture": "This case study is generated from the portfolio catalog pipeline using README, Git metadata, package/build configuration, and media signals. The final architecture narrative still needs source-level review. Current detected technology signals include: Python, FastAPI, DuckDB, scikit-learn, PyTorch, statsmodels, Next.js, TypeScript, Streamlit, Docker.",
  "setupGuide": "This project does not expose a verified runnable web command yet. Review the README/source tree and add exact install, run, test, and build commands before interview use.\nNo verified build command was detected. Treat the current portfolio page as a case-study placeholder until build steps are reviewed.",
  "features": [
    "Detected technical signals: Python, FastAPI, DuckDB, scikit-learn, PyTorch, statsmodels, Next",
    "js, TypeScript, Streamlit, Docker,README evidence exists and can support a fuller reviewed case study,A public GitHub repository is linked for source traceability",
    "Built a data-to-decisions pipeline: clean transactions into an 8-table DuckDB warehouse, compute RFM, cohort and product features, segment with K-Means and mine Apriori association rules, then recommend through a FBT to segment-popular to global-popular cascade",
    "Extended with SARIMA/LSTM forecasting, autoencoder and gradient-boosting customer modeling, SBERT/item2vec product embeddings and an A/B testing framework, all surfaced via FastAPI, Next"
  ],
  "metrics": [
    {
      "label": "Demo Modules",
      "value": "4"
    },
    {
      "label": "Tech Stack",
      "value": "10"
    },
    {
      "label": "Mode",
      "value": "Fixture"
    },
    {
      "label": "Status",
      "value": "completed"
    }
  ],
  "records": [
    {
      "id": "flow-01",
      "name": "Detected technical signals: Python, FastAPI, DuckDB, scikit-learn, PyTorch, statsmodels, Next",
      "status": "Ready",
      "owner": "Frontend"
    },
    {
      "id": "flow-02",
      "name": "js, TypeScript, Streamlit, Docker,README evidence exists and can support a fuller reviewed case study,A public GitHub repository is linked for source traceability",
      "status": "Review",
      "owner": "Data"
    },
    {
      "id": "flow-03",
      "name": "Built a data-to-decisions pipeline: clean transactions into an 8-table DuckDB warehouse, compute RFM, cohort and product features, segment with K-Means and mine Apriori association rules, then recommend through a FBT to segment-popular to global-popular cascade",
      "status": "Queued",
      "owner": "Automation"
    },
    {
      "id": "flow-04",
      "name": "Extended with SARIMA/LSTM forecasting, autoencoder and gradient-boosting customer modeling, SBERT/item2vec product embeddings and an A/B testing framework, all surfaced via FastAPI, Next",
      "status": "Ready",
      "owner": "Product"
    }
  ]
};

const state = {
  tab: "overview",
  query: "",
  selected: project.records[0]?.id ?? "",
};

function matches(record) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return [record.name, record.status, record.owner].join(" ").toLowerCase().includes(q);
}

function renderMetrics() {
  return project.metrics.map((metric) => `
    <div class="metric">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
    </div>
  `).join("");
}

function renderTabs() {
  return ["overview", "workflow", "data", "architecture"].map((tab) => `
    <button class="tab ${state.tab === tab ? "active" : ""}" data-tab="${tab}">${tab}</button>
  `).join("");
}

function renderOverview() {
  return `
    <section class="panel hero-panel">
      <div>
        <p class="eyebrow">${project.category} · ${project.year}</p>
        <h1>${project.title}</h1>
        <p class="lead">${project.summary}</p>
      </div>
      <div class="metrics">${renderMetrics()}</div>
    </section>
    <section class="panel split">
      <div>
        <h2>Problem</h2>
        <p>${project.problem}</p>
      </div>
      <div>
        <h2>Solution</h2>
        <p>${project.solution}</p>
      </div>
    </section>
  `;
}

function renderWorkflow() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Demo workflow</p>
          <h2>Interactive Review Flow</h2>
        </div>
        <button id="runDemo" class="primary">Run demo pass</button>
      </div>
      <div class="timeline">
        ${project.features.map((feature, index) => `
          <article class="step">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <p>${feature}</p>
          </article>
        `).join("")}
      </div>
      <output id="demoOutput" class="output">Ready to run the guided demo.</output>
    </section>
  `;
}

function renderData() {
  const rows = project.records.filter(matches);
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Fixture data</p>
          <h2>Sample Records</h2>
        </div>
        <input id="search" value="${state.query}" placeholder="Filter records" />
      </div>
      <div class="table">
        ${rows.map((record) => `
          <button class="row ${state.selected === record.id ? "selected" : ""}" data-record="${record.id}">
            <span>${record.id}</span>
            <strong>${record.name}</strong>
            <em>${record.owner}</em>
            <b>${record.status}</b>
          </button>
        `).join("") || `<p class="empty">No records match this filter.</p>`}
      </div>
    </section>
  `;
}

function renderArchitecture() {
  return `
    <section class="panel split">
      <div>
        <p class="eyebrow">Architecture</p>
        <h2>How the demo is organized</h2>
        <p>${project.architecture}</p>
        <pre>demo-app/
  src/main.js
  src/styles.css
  index.html
  package.json</pre>
      </div>
      <div>
        <p class="eyebrow">Run guide</p>
        <h2>Local commands</h2>
        <pre>${project.setupGuide}</pre>
        <div class="chips">${project.technologies.slice(0, 12).map((tech) => `<span>${tech}</span>`).join("")}</div>
      </div>
    </section>
  `;
}

function render() {
  const views = {
    overview: renderOverview,
    workflow: renderWorkflow,
    data: renderData,
    architecture: renderArchitecture,
  };
  document.querySelector("#app").innerHTML = `
    <header class="topbar">
      <a href="${project.githubUrl}" class="brand">${project.title}</a>
      <nav>${renderTabs()}</nav>
      <a class="repo" href="${project.readmeUrl}">README</a>
    </header>
    <main>${views[state.tab]()}</main>
  `;

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });
  document.querySelector("#search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
    document.querySelector("#search")?.focus();
  });
  document.querySelectorAll("[data-record]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selected = button.dataset.record;
      render();
    });
  });
  document.querySelector("#runDemo")?.addEventListener("click", () => {
    const output = document.querySelector("#demoOutput");
    if (output) output.textContent = `${project.title}: ${project.records.length} fixture records processed and ${project.features.length} workflow checks completed.`;
  });
}

render();
