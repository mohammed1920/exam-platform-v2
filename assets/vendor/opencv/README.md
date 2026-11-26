# OpenCV.js runtime for Mizan

- Upstream: [TechStark/opencv-js](https://github.com/TechStark/opencv-js)
- Release: [OpenCV.js 4.13.0 build #3](https://github.com/TechStark/opencv-js/releases/tag/opencv-js-4.13.0-build3)
- SHA-256: `f73f3a20958f3a05529cb513805a7311adce0bf05323887c5a9feb3c63c3953e`
- Build: single-file WebAssembly; no separate WASM request.
- License: Apache-2.0; see [LICENSE](./LICENSE).

The generated `opencv.js` file is intentionally excluded from Git. The build workflow downloads the pinned release and verifies its SHA-256 before validation and deployment. Mizan loads it from its own origin on first use; the existing Service Worker caches this local asset for subsequent offline use.
