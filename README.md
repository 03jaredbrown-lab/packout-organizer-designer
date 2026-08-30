# PACKOUT Organizer Designer

A visual web app for designing custom tool-organizer **inserts** that fit inside
Milwaukee **PACKOUT** storage containers, and exporting them as 3D-printable
**STL** files.

## What it does (target)

1. Pick the PACKOUT container you're building an insert for. Its internal
   dimensions define the design canvas.
2. Build up a palette of the tools you want to organize — pulled from a starter
   library or entered by hand (measure the tool, type in length / width / height,
   optionally trace a 2D outline).
3. Arrange the tools on a top-down canvas inside the container footprint:
   drag, rotate, snap, with live collision and out-of-bounds checks.
4. Tune each pocket: clearance/tolerance, depth, finger-scoop, label tab.
5. See a live 3D preview of the resulting insert.
6. Verify the fit — the app flags overlaps, parts hanging over the edge, walls
   that are too thin, inserts that are too tall for the lid.
7. Export **STL** for printing, plus a project `.json` you can re-open and edit.

## Status

Early scaffold. See [`docs/PLAN.md`](docs/PLAN.md) for the roadmap and
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) for the data schema.

Two decisions are open and blocking the tool library work — see
**Open decisions** in `docs/PLAN.md`:

- how tool dimensions get sourced (leaning: manual entry + a small curated
  starter set from public spec sheets — **not** live scraping)
- which PACKOUT container(s) to support first

## Development

Requires Node.js 20+ (not yet installed on this machine — `winget install
OpenJS.NodeJS.LTS` or grab it from nodejs.org). The frontend toolchain is
proposed in [`docs/TECH-STACK.md`](docs/TECH-STACK.md) and not yet committed.

## Cross-machine

This repo is meant to be worked on from both a Mac and a PC. Clone it, run the
dev server, and keep `main` as the source of truth.
