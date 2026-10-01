# Kojo B. Osei-Ntansah — portfolio site

Static site. No build step, no dependencies: HTML, one stylesheet, one script,
and the CAD models it displays.

    index.html          home
    projects/           one page per project
    assets/style.css    dark theme
    assets/viewer.js    three.js STL/OBJ/GLB viewer, drag to rotate
    assets/models/      CAD exports (STL)
    assets/img/         photographs
    files/              résumé, detailed résumé, and CV as PDF and Word

## Viewing locally

The 3D viewers cannot load models from `file://` — browsers block scripts
from reading local files. Serve the folder over HTTP instead:

    python -m http.server 8000

then open http://localhost:8000

## Source

Generated from a content bank by a separate document engine, which is kept
private. Project text, publications, and skills come from that single source,
so the site and the résumé cannot drift apart.
