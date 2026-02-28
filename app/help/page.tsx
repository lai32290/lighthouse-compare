import Link from "next/link";
import Image from "next/image";

export default function HelpPage() {
  return (
    <main className="page pb-10">
      <section className="hero-bg rounded-3xl border border-base-300 p-6 shadow-lg md:p-10">
        <div className="badge badge-primary badge-outline">Help</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          How to use Lighthouse Compare
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-base-content/75 md:text-base">
          This guide shows how to export Lighthouse reports as JSON and compare
          before vs after runs in this app.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/" className="btn btn-primary btn-sm">
            Back to compare
          </Link>
        </div>
      </section>

      <section className="card mt-6 border border-base-300 bg-base-100 shadow-md">
        <div className="card-body p-5 md:p-6">
          <h2 className="card-title">1) Generate a Lighthouse report</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm md:text-base">
            <li>Open your page in Chrome.</li>
            <li>Open DevTools (`F12` or `Cmd/Ctrl + Shift + I`).</li>
            <li>Go to the Lighthouse tab.</li>
            <li>
              Select the device type you want to test (`Desktop` or `Mobile`).
            </li>
            <li>Run the audit and wait for the report to finish.</li>
          </ol>
        </div>
      </section>

      <section className="card mt-6 border border-base-300 bg-base-100 shadow-md">
        <div className="card-body p-5 md:p-6">
          <h2 className="card-title">2) Save the report as JSON</h2>
          <div className="alert alert-info text-sm">
            In the report screen, open the 3-dot menu at the top-right and click
            <b className="ml-1">Save as JSON</b> (same action shown in your screenshot).
          </div>
          <figure className="mt-4 overflow-hidden rounded-xl border border-base-300 bg-base-200/40 p-2">
            <Image
              src="/help/lighthouse-save-as-json.png"
              alt="Lighthouse report menu highlighting Save as JSON"
              width={1190}
              height={430}
              className="h-auto w-full rounded-lg"
            />
          </figure>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-base-300 bg-base-200/40 p-4">
              <div className="text-sm font-semibold">Recommended naming</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                <li>`before-desktop-run-01.json`</li>
                <li>`before-mobile-run-01.json`</li>
                <li>`after-desktop-run-01.json`</li>
                <li>`after-mobile-run-01.json`</li>
              </ul>
            </div>
            <div className="rounded-xl border border-base-300 bg-base-200/40 p-4">
              <div className="text-sm font-semibold">Tips</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                <li>Run each scenario multiple times for stable averages.</li>
                <li>Use the same URL and test conditions when possible.</li>
                <li>Prefer Incognito to reduce extension noise.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-6 border border-base-300 bg-base-100 shadow-md">
        <div className="card-body p-5 md:p-6">
          <h2 className="card-title">3) Upload and compare</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm md:text-base">
            <li>
              Upload one complete pair to compare only one device:
              `Before Desktop + After Desktop` or `Before Mobile + After Mobile`.
            </li>
            <li>
              You can also upload both devices together to compare Desktop and Mobile
              in the same run.
            </li>
            <li>
              Drop JSON files directly or drop/select a folder to import JSON files
              automatically.
            </li>
            <li>Click <b>Compare results</b>.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
