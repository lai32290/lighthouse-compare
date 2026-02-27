"use client";

import { useMemo, useState } from "react";

type LighthouseReport = {
  categories?: Record<string, { score?: number | null }>;
  audits?: Record<string, { numericValue?: number | null }>;
};

type ParsedReport = {
  name: string;
  report: LighthouseReport;
};

type SummaryEntry = {
  label: string;
  before: number | null;
  after: number | null;
  deltaText: string;
  deltaClass: "good" | "bad" | "neutral";
  beforeText: string;
  afterText: string;
};

type ComparisonData = {
  desktopPerformance: {
    before: number | null;
    after: number | null;
    deltaText: string;
    deltaClass: "good" | "bad" | "neutral";
  };
  mobilePerformance: {
    before: number | null;
    after: number | null;
    deltaText: string;
    deltaClass: "good" | "bad" | "neutral";
  };
  categoriesDesktop: SummaryEntry[];
  categoriesMobile: SummaryEntry[];
  metricsDesktop: SummaryEntry[];
  metricsMobile: SummaryEntry[];
  desktopRuns: { before: number[]; after: number[] };
  mobileRuns: { before: number[]; after: number[] };
  counts: {
    beforeDesktop: number;
    afterDesktop: number;
    beforeMobile: number;
    afterMobile: number;
  };
};

const CATEGORIES = [
  { key: "performance", label: "Performance", unit: "", isCategory: true },
  {
    key: "accessibility",
    label: "Accessibility",
    unit: "",
    isCategory: true,
  },
  {
    key: "best-practices",
    label: "Best Practices",
    unit: "",
    isCategory: true,
  },
];

const METRICS = [
  {
    key: "first-contentful-paint",
    label: "FCP",
    unit: "ms",
    isCategory: false,
  },
  {
    key: "largest-contentful-paint",
    label: "LCP",
    unit: "ms",
    isCategory: false,
  },
  { key: "speed-index", label: "Speed Index", unit: "ms", isCategory: false },
  {
    key: "total-blocking-time",
    label: "TBT",
    unit: "ms",
    isCategory: false,
  },
  { key: "interactive", label: "TTI", unit: "ms", isCategory: false },
  {
    key: "cumulative-layout-shift",
    label: "CLS",
    unit: "",
    isCategory: false,
  },
];

function getValue(report: LighthouseReport, key: string, isCategory: boolean) {
  if (isCategory) {
    const score = report.categories?.[key]?.score;
    return typeof score === "number" ? score * 100 : null;
  }
  const value = report.audits?.[key]?.numericValue;
  return typeof value === "number" ? value : null;
}

function avg(values: Array<number | null>) {
  const valid = values.filter((v): v is number => typeof v === "number");
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function fmtValue(value: number | null, unit = "") {
  if (value === null) return "N/A";
  if (unit === "ms") {
    if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
    return `${value.toFixed(0)}ms`;
  }
  if (!unit) return value.toFixed(3);
  return `${value.toFixed(2)}${unit}`;
}

function getDelta(
  before: number | null,
  after: number | null,
  higherIsBetter: boolean,
) {
  if (before === null || after === null) {
    return { text: "N/A", cls: "neutral" as const };
  }
  const delta = after - before;
  const cls: "good" | "bad" =
    (delta >= 0) === higherIsBetter ? "good" : "bad";
  const sign = delta >= 0 ? "+" : "";
  return { text: `${sign}${delta.toFixed(2)}`, cls };
}

function perRunScores(reports: ParsedReport[], categoryKey: string) {
  return reports
    .map((item) => getValue(item.report, categoryKey, true))
    .filter((v): v is number => v !== null)
    .map((v) => Number(v.toFixed(2)));
}

function buildRows(
  before: ParsedReport[],
  after: ParsedReport[],
  entries: Array<{
    key: string;
    label: string;
    unit: string;
    isCategory: boolean;
  }>,
): SummaryEntry[] {
  return entries.map((entry) => {
    const beforeAvg = avg(
      before.map((item) => getValue(item.report, entry.key, entry.isCategory)),
    );
    const afterAvg = avg(
      after.map((item) => getValue(item.report, entry.key, entry.isCategory)),
    );
    const delta = getDelta(beforeAvg, afterAvg, entry.isCategory);

    return {
      label: entry.label,
      before: beforeAvg,
      after: afterAvg,
      deltaText: delta.text,
      deltaClass: delta.cls,
      beforeText: entry.isCategory
        ? beforeAvg === null
          ? "N/A"
          : beforeAvg.toFixed(1)
        : fmtValue(beforeAvg, entry.unit),
      afterText: entry.isCategory
        ? afterAvg === null
          ? "N/A"
          : afterAvg.toFixed(1)
        : fmtValue(afterAvg, entry.unit),
    };
  });
}

function BarChart({
  title,
  beforeData,
  afterData,
}: {
  title: string;
  beforeData: number[];
  afterData: number[];
}) {
  const maxLength = Math.max(beforeData.length, afterData.length);
  const maxValue = 100;

  return (
    <div className="chart-box">
      <div className="chart-title">{title}</div>
      <div className="chart-legend">
        <span>
          <i className="dot before" /> Before
        </span>
        <span>
          <i className="dot after" /> After
        </span>
      </div>
      <div
        className="bars-wrap"
        style={{ gridTemplateColumns: `repeat(${maxLength}, minmax(20px, 1fr))` }}
      >
        {Array.from({ length: maxLength }).map((_, index) => {
          const before = beforeData[index];
          const after = afterData[index];
          return (
            <div className="bar-group" key={`run-${index + 1}`}>
              <div className="bars">
                <div
                  className="bar before"
                  style={{
                    height:
                      typeof before === "number"
                        ? `${(before / maxValue) * 100}%`
                        : "0%",
                    opacity: typeof before === "number" ? 1 : 0.2,
                  }}
                  title={
                    typeof before === "number"
                      ? `Before: ${before.toFixed(1)}`
                      : "Before: N/A"
                  }
                />
                <div
                  className="bar after"
                  style={{
                    height:
                      typeof after === "number"
                        ? `${(after / maxValue) * 100}%`
                        : "0%",
                    opacity: typeof after === "number" ? 1 : 0.2,
                  }}
                  title={
                    typeof after === "number"
                      ? `After: ${after.toFixed(1)}`
                      : "After: N/A"
                  }
                />
              </div>
              <div className="bar-label">{index + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryTable({
  title,
  rows,
}: {
  title: string;
  rows: SummaryEntry[];
}) {
  return (
    <div>
      <div className="note">{title}</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Before</th>
            <th>After</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.beforeText}</td>
              <td>{row.afterText}</td>
              <td className={row.deltaClass}>{row.deltaText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function parseFiles(files: File[]) {
  const ordered = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  const loaded = await Promise.all(
    ordered.map(async (file) => {
      const raw = await file.text();
      const report = JSON.parse(raw) as LighthouseReport;
      return { name: file.name, report };
    }),
  );

  return loaded;
}

function buildComparison(
  beforeDesktop: ParsedReport[],
  afterDesktop: ParsedReport[],
  beforeMobile: ParsedReport[],
  afterMobile: ParsedReport[],
): ComparisonData {
  const categoriesDesktop = buildRows(beforeDesktop, afterDesktop, CATEGORIES);
  const categoriesMobile = buildRows(beforeMobile, afterMobile, CATEGORIES);
  const metricsDesktop = buildRows(beforeDesktop, afterDesktop, METRICS);
  const metricsMobile = buildRows(beforeMobile, afterMobile, METRICS);

  const dBefore = avg(
    beforeDesktop.map((item) => getValue(item.report, "performance", true)),
  );
  const dAfter = avg(
    afterDesktop.map((item) => getValue(item.report, "performance", true)),
  );
  const mBefore = avg(
    beforeMobile.map((item) => getValue(item.report, "performance", true)),
  );
  const mAfter = avg(
    afterMobile.map((item) => getValue(item.report, "performance", true)),
  );

  const dDelta = getDelta(dBefore, dAfter, true);
  const mDelta = getDelta(mBefore, mAfter, true);

  return {
    desktopPerformance: {
      before: dBefore,
      after: dAfter,
      deltaText: dDelta.text,
      deltaClass: dDelta.cls,
    },
    mobilePerformance: {
      before: mBefore,
      after: mAfter,
      deltaText: mDelta.text,
      deltaClass: mDelta.cls,
    },
    categoriesDesktop,
    categoriesMobile,
    metricsDesktop,
    metricsMobile,
    desktopRuns: {
      before: perRunScores(beforeDesktop, "performance"),
      after: perRunScores(afterDesktop, "performance"),
    },
    mobileRuns: {
      before: perRunScores(beforeMobile, "performance"),
      after: perRunScores(afterMobile, "performance"),
    },
    counts: {
      beforeDesktop: beforeDesktop.length,
      afterDesktop: afterDesktop.length,
      beforeMobile: beforeMobile.length,
      afterMobile: afterMobile.length,
    },
  };
}

function fmtCard(value: number | null) {
  return value === null ? "N/A" : value.toFixed(1);
}

export default function Home() {
  const [beforeDesktopFiles, setBeforeDesktopFiles] = useState<File[]>([]);
  const [afterDesktopFiles, setAfterDesktopFiles] = useState<File[]>([]);
  const [beforeMobileFiles, setBeforeMobileFiles] = useState<File[]>([]);
  const [afterMobileFiles, setAfterMobileFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonData | null>(null);

  const canCompare = useMemo(() => {
    return (
      beforeDesktopFiles.length > 0 &&
      afterDesktopFiles.length > 0 &&
      beforeMobileFiles.length > 0 &&
      afterMobileFiles.length > 0
    );
  }, [beforeDesktopFiles, afterDesktopFiles, beforeMobileFiles, afterMobileFiles]);

  async function handleCompare() {
    setLoading(true);
    setError(null);

    try {
      const [beforeDesktop, afterDesktop, beforeMobile, afterMobile] =
        await Promise.all([
          parseFiles(beforeDesktopFiles),
          parseFiles(afterDesktopFiles),
          parseFiles(beforeMobileFiles),
          parseFiles(afterMobileFiles),
        ]);

      setResult(
        buildComparison(beforeDesktop, afterDesktop, beforeMobile, afterMobile),
      );
    } catch {
      setResult(null);
      setError(
        "Nao foi possivel ler os JSON. Verifique se todos os arquivos sao relatórios validos do Lighthouse.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <h1>Lighthouse Before vs After</h1>
        <p>
          Faça upload dos JSONs de desktop e mobile para before e after.
          Geramos os cards, gráfico por execução e tabelas de comparação.
        </p>
      </section>

      <section className="panel">
        <h2>Upload de arquivos</h2>
        <div className="upload-grid">
          <label className="uploader">
            <span>Before Desktop</span>
            <input
              type="file"
              multiple
              accept="application/json,.json"
              onChange={(event) =>
                setBeforeDesktopFiles(Array.from(event.target.files ?? []))
              }
            />
            <small>{beforeDesktopFiles.length} arquivo(s)</small>
          </label>

          <label className="uploader">
            <span>After Desktop</span>
            <input
              type="file"
              multiple
              accept="application/json,.json"
              onChange={(event) =>
                setAfterDesktopFiles(Array.from(event.target.files ?? []))
              }
            />
            <small>{afterDesktopFiles.length} arquivo(s)</small>
          </label>

          <label className="uploader">
            <span>Before Mobile</span>
            <input
              type="file"
              multiple
              accept="application/json,.json"
              onChange={(event) =>
                setBeforeMobileFiles(Array.from(event.target.files ?? []))
              }
            />
            <small>{beforeMobileFiles.length} arquivo(s)</small>
          </label>

          <label className="uploader">
            <span>After Mobile</span>
            <input
              type="file"
              multiple
              accept="application/json,.json"
              onChange={(event) =>
                setAfterMobileFiles(Array.from(event.target.files ?? []))
              }
            />
            <small>{afterMobileFiles.length} arquivo(s)</small>
          </label>
        </div>

        <button
          className="primary-btn"
          type="button"
          onClick={handleCompare}
          disabled={!canCompare || loading}
        >
          {loading ? "Comparando..." : "Comparar resultados"}
        </button>

        {error ? <p className="error">{error}</p> : null}
      </section>

      {result ? (
        <section className="results">
          <div className="meta">
            Desktop {result.counts.beforeDesktop} {"->"} {result.counts.afterDesktop} execucoes | Mobile{" "}
            {result.counts.beforeMobile} {"->"} {result.counts.afterMobile} execucoes
          </div>

          <div className="cards">
            <article className="card">
              <span>Performance media (Desktop)</span>
              <strong>
                {fmtCard(result.desktopPerformance.before)} {"->"} {" "}
                {fmtCard(result.desktopPerformance.after)}
              </strong>
              <b className={result.desktopPerformance.deltaClass}>
                {result.desktopPerformance.deltaText}
              </b>
            </article>

            <article className="card">
              <span>Performance media (Mobile)</span>
              <strong>
                {fmtCard(result.mobilePerformance.before)} {"->"} {" "}
                {fmtCard(result.mobilePerformance.after)}
              </strong>
              <b className={result.mobilePerformance.deltaClass}>
                {result.mobilePerformance.deltaText}
              </b>
            </article>
          </div>

          <div className="panel">
            <h2>Performance por execucao</h2>
            <p className="note">
              Cada barra representa uma execucao (escala de 0 a 100).
            </p>
            <div className="charts-grid">
              <BarChart
                title="Desktop"
                beforeData={result.desktopRuns.before}
                afterData={result.desktopRuns.after}
              />
              <BarChart
                title="Mobile"
                beforeData={result.mobileRuns.before}
                afterData={result.mobileRuns.after}
              />
            </div>
          </div>

          <div className="panel">
            <h2>Categorias Lighthouse (media)</h2>
            <div className="table-grid">
              <SummaryTable title="Desktop" rows={result.categoriesDesktop} />
              <SummaryTable title="Mobile" rows={result.categoriesMobile} />
            </div>
          </div>

          <div className="panel">
            <h2>Metricas tecnicas (media)</h2>
            <div className="table-grid">
              <SummaryTable
                title="Desktop (menor e melhor)"
                rows={result.metricsDesktop}
              />
              <SummaryTable
                title="Mobile (menor e melhor)"
                rows={result.metricsMobile}
              />
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
