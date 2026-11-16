DigiLab Pro — Fixed Project
===========================

Files
-----
digilab_pro.html  Main application page
engine.js          UI, simulation orchestration, and Three.js renderer
models.js          Digital logic model definitions and simulation logic
kit.js             Reusable Three.js component factory
builds.js          3D scene builders for each model

Run locally
-----------
1. Extract all five project files into the same folder.
2. Open a terminal in that folder.
3. Run:  python -m http.server 8000
4. Open: http://localhost:8000/digilab_pro.html

Use a modern browser with WebGL enabled. The Three.js modules are loaded from jsDelivr,
so an internet connection is required on first load.

Fixes and validation
--------------------
- Added guarded browser storage access so blocked localStorage does not stop startup.
- Added a WebGL initialization fallback message and safer resize handling.
- Validated JavaScript syntax for all four modules.
- Validated all 26 model definitions, all combinational truth-table output shapes,
  and one initial simulation step for every simulation-backed model.
- Added a Clear RAM control, matching the RAM model's stated reset behavior.
- Improved switch accessibility state and corrected the 3D viewport hint so it no
  longer suggests that the visual-only 3D switches can directly change inputs.

Note: Full interactive browser QA still depends on testing in the target browser/device.
