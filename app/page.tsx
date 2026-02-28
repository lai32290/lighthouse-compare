"use client";

import type { InputHTMLAttributes } from "react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

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

type EntryLike = {
  isFile: boolean;
  isDirectory: boolean;
};

type FileEntryLike = EntryLike & {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};

type DirectoryReaderLike = {
  readEntries: (
    successCallback: (entries: EntryLike[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};

type DirectoryEntryLike = EntryLike & {
  createReader: () => DirectoryReaderLike;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => EntryLike | null;
};

function isJsonFile(file: File) {
  return file.type === "application/json" || file.name.endsWith(".json");
}

function readFileFromEntry(entry: FileEntryLike) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readEntriesBatch(reader: DirectoryReaderLike) {
  return new Promise<EntryLike[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

async function readAllDirectoryEntries(directory: DirectoryEntryLike) {
  const reader = directory.createReader();
  const all: EntryLike[] = [];

  while (true) {
    const batch = await readEntriesBatch(reader);
    if (!batch.length) break;
    all.push(...batch);
  }

  return all;
}

async function collectJsonFilesFromEntry(entry: EntryLike): Promise<File[]> {
  if (entry.isFile) {
    const file = await readFileFromEntry(entry as FileEntryLike);
    return isJsonFile(file) ? [file] : [];
  }

  if (entry.isDirectory) {
    const entries = await readAllDirectoryEntries(entry as DirectoryEntryLike);
    const nestedFiles = await Promise.all(entries.map(collectJsonFilesFromEntry));
    return nestedFiles.flat();
  }

  return [];
}

async function collectDroppedJsonFiles(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []);
  const withEntry = items.filter(
    (item): item is DataTransferItemWithEntry =>
      typeof item.webkitGetAsEntry === "function",
  );

  if (withEntry.length) {
    const fileGroups = await Promise.all(
      withEntry.map((item) => {
        const entry = item.webkitGetAsEntry?.();
        return entry ? collectJsonFilesFromEntry(entry) : Promise.resolve([]);
      }),
    );
    return fileGroups.flat();
  }

  return Array.from(dataTransfer.files ?? []).filter(isJsonFile);
}

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
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div className="card-title text-base">{title}</div>
        <div className="flex flex-wrap gap-4 text-xs text-base-content/70">
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
            const beforeTip =
              typeof before === "number"
                ? `Before: ${before.toFixed(1)}`
                : "Before: N/A";
            const afterTip =
              typeof after === "number"
                ? `After: ${after.toFixed(1)}`
                : "After: N/A";
            return (
              <div className="bar-group" key={`run-${index + 1}`}>
                <div className="bars">
                  <div
                    className="bar before tooltip tooltip-top"
                    data-tip={beforeTip}
                    style={{
                      height:
                        typeof before === "number"
                          ? `${(before / maxValue) * 100}%`
                          : "0%",
                      opacity: typeof before === "number" ? 1 : 0.2,
                    }}
                    title={beforeTip}
                  />
                  <div
                    className="bar after tooltip tooltip-top"
                    data-tip={afterTip}
                    style={{
                      height:
                        typeof after === "number"
                          ? `${(after / maxValue) * 100}%`
                          : "0%",
                      opacity: typeof after === "number" ? 1 : 0.2,
                    }}
                    title={afterTip}
                  />
                </div>
                <div className="bar-label">{index + 1}</div>
              </div>
            );
          })}
        </div>
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
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body p-4">
        <div className="mb-2 text-sm font-semibold text-base-content/70">{title}</div>
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
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
              <td>
                <span className={`badge badge-soft ${row.deltaClass}`}>{row.deltaText}</span>
              </td>
            </tr>
          ))}
        </tbody>
          </table>
        </div>
      </div>
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

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeFiles(current: File[], incoming: File[]) {
  const next = [...current];
  const seen = new Set(current.map(fileKey));

  for (const file of incoming) {
    if (isJsonFile(file)) {
      const key = fileKey(file);
      if (!seen.has(key)) {
        seen.add(key);
        next.push(file);
      }
    }
  }

  return next.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

function FileDropzone({
  title,
  files,
  onChange,
  onClear,
}: {
  title: string;
  files: File[];
  onChange: (files: File[]) => void;
  onClear: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const folderInputAttributes = {
    webkitdirectory: "",
    directory: "",
  } as unknown as InputHTMLAttributes<HTMLInputElement>;

  function addFiles(incoming: File[]) {
    onChange(mergeFiles(files, incoming));
  }

  return (
    <div
      className={`card border-2 border-dashed bg-base-100 transition ${isDragging ? "border-primary" : "border-base-300"}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={async (event) => {
        event.preventDefault();
        setIsDragging(false);
        const droppedFiles = await collectDroppedJsonFiles(event.dataTransfer);
        addFiles(droppedFiles);
      }}
    >
      <div className="card-body gap-3 p-4">
        <div className="uploader-head">
          <span className="text-sm font-semibold">{title}</span>
          <button type="button" className="btn btn-xs btn-ghost" onClick={onClear}>
            Clear
          </button>
        </div>
        <small className="text-xs text-base-content/70">
          Drag and drop JSON files or a folder here. You can also pick files or a
          folder manually.
        </small>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            type="file"
            multiple
            accept="application/json,.json"
            className="file-input file-input-bordered file-input-sm w-full"
            onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
          />
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => folderInputRef.current?.click()}
          >
            Select folder
          </button>
          <input
            {...folderInputAttributes}
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
          />
        </div>

        <div className="file-list">
          {files.length ? (
            files.map((file, index) => (
              <div className="file-item" key={fileKey(file)}>
                <span title={file.name}>{file.name}</span>
                <button
                  type="button"
                  className="btn btn-xs btn-outline btn-error"
                  onClick={() => {
                    onChange(files.filter((_, itemIndex) => itemIndex !== index));
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="file-empty">No files selected.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [beforeDesktopFiles, setBeforeDesktopFiles] = useState<File[]>([]);
  const [afterDesktopFiles, setAfterDesktopFiles] = useState<File[]>([]);
  const [beforeMobileFiles, setBeforeMobileFiles] = useState<File[]>([]);
  const [afterMobileFiles, setAfterMobileFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonData | null>(null);
  const [activePerformanceTab, setActivePerformanceTab] = useState<
    "desktop" | "mobile"
  >("desktop");
  const hasDesktopPair =
    beforeDesktopFiles.length > 0 && afterDesktopFiles.length > 0;
  const hasMobilePair =
    beforeMobileFiles.length > 0 && afterMobileFiles.length > 0;
  const hasAnyFiles =
    beforeDesktopFiles.length > 0 ||
    afterDesktopFiles.length > 0 ||
    beforeMobileFiles.length > 0 ||
    afterMobileFiles.length > 0;

  const canCompare = useMemo(() => {
    return hasDesktopPair || hasMobilePair;
  }, [hasDesktopPair, hasMobilePair]);

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

      const nextResult = buildComparison(
        beforeDesktop,
        afterDesktop,
        beforeMobile,
        afterMobile,
      );
      setResult(nextResult);

      const hasDesktopResult =
        nextResult.counts.beforeDesktop > 0 && nextResult.counts.afterDesktop > 0;
      const hasMobileResult =
        nextResult.counts.beforeMobile > 0 && nextResult.counts.afterMobile > 0;

      if (hasDesktopResult && !hasMobileResult) {
        setActivePerformanceTab("desktop");
      }

      if (!hasDesktopResult && hasMobileResult) {
        setActivePerformanceTab("mobile");
      }
    } catch {
      setResult(null);
      setError(
        "Could not parse the JSON files. Please confirm all files are valid Lighthouse reports.",
      );
    } finally {
      setLoading(false);
    }
  }

  function clearAllFiles() {
    const confirmed = window.confirm(
      "Are you sure you want to clear all uploaded files?",
    );
    if (!confirmed) return;

    setBeforeDesktopFiles([]);
    setAfterDesktopFiles([]);
    setBeforeMobileFiles([]);
    setAfterMobileFiles([]);
    setResult(null);
    setError(null);
  }

  function swapBeforeAfterFiles() {
    setBeforeDesktopFiles(afterDesktopFiles);
    setAfterDesktopFiles(beforeDesktopFiles);
    setBeforeMobileFiles(afterMobileFiles);
    setAfterMobileFiles(beforeMobileFiles);
    setResult(null);
    setError(null);
  }

  return (
    <main className="page pb-10">
      <section className="hero-bg rounded-3xl border border-base-300 p-6 shadow-lg md:p-10 animate-enter">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
          Lighthouse Before vs After
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-base-content/75 md:text-base">
          Upload desktop and mobile JSON reports for before and after. We generate
          summary cards, per-run charts, and comparison tables.
        </p>
        <div className="mt-5">
          <Link href="/help" className="btn btn-outline btn-sm">
            How to get JSON reports
          </Link>
        </div>
      </section>

      <section className="card mt-6 border border-base-300 bg-base-100/90 shadow-md backdrop-blur animate-enter-delayed">
        <div className="card-body p-5 md:p-6">
        <h2 className="card-title">Upload files</h2>
        <div className="upload-actions">
          <button
            className="btn btn-sm btn-outline"
            type="button"
            onClick={swapBeforeAfterFiles}
            disabled={!canCompare && !hasAnyFiles}
          >
            Swap Before/After
          </button>
          <button
            className="btn btn-sm btn-outline btn-error"
            type="button"
            onClick={clearAllFiles}
            disabled={!hasAnyFiles}
          >
            Clear all files
          </button>
        </div>
        <div className="upload-grid">
          <FileDropzone
            title="Before Desktop"
            files={beforeDesktopFiles}
            onChange={setBeforeDesktopFiles}
            onClear={() => {
              setBeforeDesktopFiles([]);
              setResult(null);
            }}
          />

          <FileDropzone
            title="After Desktop"
            files={afterDesktopFiles}
            onChange={setAfterDesktopFiles}
            onClear={() => {
              setAfterDesktopFiles([]);
              setResult(null);
            }}
          />

          <FileDropzone
            title="Before Mobile"
            files={beforeMobileFiles}
            onChange={setBeforeMobileFiles}
            onClear={() => {
              setBeforeMobileFiles([]);
              setResult(null);
            }}
          />

          <FileDropzone
            title="After Mobile"
            files={afterMobileFiles}
            onChange={setAfterMobileFiles}
            onClear={() => {
              setAfterMobileFiles([]);
              setResult(null);
            }}
          />
        </div>

        <button
          className="btn btn-primary mt-2 w-full md:w-auto"
          type="button"
          onClick={handleCompare}
          disabled={!canCompare || loading}
        >
          {loading ? "Comparing..." : "Compare results"}
        </button>

        {error ? <div className="alert alert-error mt-3 py-2 text-sm">{error}</div> : null}
        </div>
      </section>

      {result ? (
        <section className="results mt-6 space-y-6 animate-enter-delayed-2">
          {(() => {
            const hasDesktopResult =
              result.counts.beforeDesktop > 0 && result.counts.afterDesktop > 0;
            const hasMobileResult =
              result.counts.beforeMobile > 0 && result.counts.afterMobile > 0;

            return (
              <>
          <div className="meta text-sm">
            {hasDesktopResult
              ? `Desktop runs: ${result.counts.beforeDesktop} -> ${result.counts.afterDesktop}`
              : ""}
            {hasDesktopResult && hasMobileResult ? " | " : ""}
            {hasMobileResult
              ? `Mobile runs: ${result.counts.beforeMobile} -> ${result.counts.afterMobile}`
              : ""}
          </div>

          <div className="cards">
            {hasDesktopResult ? (
            <article className="stat rounded-2xl border border-base-300 bg-base-100 shadow-sm">
              <div className="stat-title">Average performance (Desktop)</div>
              <div className="stat-value text-3xl">
                {fmtCard(result.desktopPerformance.before)} {"->"} {" "}
                {fmtCard(result.desktopPerformance.after)}
              </div>
              <div className="stat-desc">
                <span className={`badge badge-soft ${result.desktopPerformance.deltaClass}`}>
                  {result.desktopPerformance.deltaText}
                </span>
              </div>
            </article>
            ) : null}

            {hasMobileResult ? (
            <article className="stat rounded-2xl border border-base-300 bg-base-100 shadow-sm">
              <div className="stat-title">Average performance (Mobile)</div>
              <div className="stat-value text-3xl">
                {fmtCard(result.mobilePerformance.before)} {"->"} {" "}
                {fmtCard(result.mobilePerformance.after)}
              </div>
              <div className="stat-desc">
                <span className={`badge badge-soft ${result.mobilePerformance.deltaClass}`}>
                  {result.mobilePerformance.deltaText}
                </span>
              </div>
            </article>
            ) : null}
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-md">
            <div className="card-body p-5 md:p-6">
              <h2 className="card-title">Performance per run</h2>
              <p className="note text-sm text-base-content/70">
                Each bar represents one Lighthouse run (0 to 100 scale).
              </p>
              {hasDesktopResult && hasMobileResult ? (
              <div className="tabs tabs-box mt-2 w-fit bg-base-200 p-1">
                <button
                  type="button"
                  className={`tab ${activePerformanceTab === "desktop" ? "tab-active" : ""}`}
                  onClick={() => setActivePerformanceTab("desktop")}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={`tab ${activePerformanceTab === "mobile" ? "tab-active" : ""}`}
                  onClick={() => setActivePerformanceTab("mobile")}
                >
                  Mobile
                </button>
              </div>
              ) : null}
              <div className="mt-4">
                {(hasDesktopResult && activePerformanceTab === "desktop") ||
                (hasDesktopResult && !hasMobileResult) ? (
                  <BarChart
                    title="Desktop"
                    beforeData={result.desktopRuns.before}
                    afterData={result.desktopRuns.after}
                  />
                ) : hasMobileResult ? (
                  <BarChart
                    title="Mobile"
                    beforeData={result.mobileRuns.before}
                    afterData={result.mobileRuns.after}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-md">
            <div className="card-body p-5 md:p-6">
            <h2 className="card-title">Lighthouse categories (average)</h2>
            <div className="table-grid">
              {hasDesktopResult ? (
                <SummaryTable title="Desktop" rows={result.categoriesDesktop} />
              ) : null}
              {hasMobileResult ? (
                <SummaryTable title="Mobile" rows={result.categoriesMobile} />
              ) : null}
            </div>
            </div>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-md">
            <div className="card-body p-5 md:p-6">
            <h2 className="card-title">Technical metrics (average)</h2>
            <div className="table-grid">
              {hasDesktopResult ? (
                <SummaryTable
                  title="Desktop (lower is better)"
                  rows={result.metricsDesktop}
                />
              ) : null}
              {hasMobileResult ? (
                <SummaryTable
                  title="Mobile (lower is better)"
                  rows={result.metricsMobile}
                />
              ) : null}
            </div>
            </div>
          </div>
              </>
            );
          })()}
        </section>
      ) : null}
    </main>
  );
}
