# Lighthouse Compare

Lighthouse Compare is a Next.js app to compare **before vs after** Lighthouse JSON reports.

You can upload report files for Desktop and Mobile, then view:

- average performance deltas
- per-run performance chart
- category comparison (Performance, Accessibility, Best Practices)
- technical metric comparison (FCP, LCP, Speed Index, TBT, TTI, CLS)

The UI is built with Tailwind CSS + daisyUI.

## Requirements

- Node.js 20+
- npm 10+

## Getting started

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev`: start local development server
- `npm run build`: create production build
- `npm run start`: run production server
- `npm run lint`: run ESLint

## How to use

1. Upload Lighthouse JSON files in any supported mode:
   - Desktop only (`Before Desktop` + `After Desktop`)
   - Mobile only (`Before Mobile` + `After Mobile`)
   - Both Desktop and Mobile
2. Click **Compare results**.
3. Review summary cards, chart tabs, and comparison tables.

## Tech stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS v4
- daisyUI

## Notes

- This app parses Lighthouse JSON files directly in the browser.
- Only valid Lighthouse JSON report files are supported.
