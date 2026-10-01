/* CAD viewer — drag to rotate, scroll to zoom.
 *
 * Accepts .glb/.gltf, .stl, or .obj and picks the loader by file extension,
 * because which formats a CAD package offers varies by version. Fusion 360
 * always offers STL; newer builds also offer GLTF Binary.
 *
 * STL and OBJ carry no materials, so those get a neutral metallic surface —
 * which reads as a CAD render rather than a game asset, and is the right look
 * for showing geometry.
 *
 * Deliberately dependency-light: no OrbitControls (a common CDN failure
 * path), just direct pointer math.
 */
(function () {
  const mounts = document.querySelectorAll("[data-model]");
  if (!mounts.length) return;

  // Opening the page straight off disk means file:// , and browsers refuse to
  // let scripts read local files. The 3D viewers cannot work that way no
  // matter how good the connection is, so say so plainly rather than showing
  // a generic failure the user cannot act on.
  if (location.protocol === "file:") {
    mounts.forEach((m) => {
      m.innerHTML =
        '<div class="slot">3D models need a local server' +
        '<span class="slot-path">you opened this file directly from disk</span>' +
        '<span class="slot-hint">run serve.bat in the appforge folder, then open ' +
        'http://localhost:8000</span></div>';
    });
    return;
  }

  const load = (src) => new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  const CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const BASE = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/";

  const exts = new Set();
  mounts.forEach((m) => {
    const x = (m.dataset.model.split(".").pop() || "").toLowerCase();
    exts.add(x === "gltf" ? "glb" : x);
  });

  const needed = [];
  if (exts.has("glb")) needed.push("GLTFLoader.js");
  if (exts.has("stl")) needed.push("STLLoader.js");
  if (exts.has("obj")) needed.push("OBJLoader.js");

  load(CDN)
    .then(() => needed.reduce((p, f) => p.then(() => load(BASE + f)), Promise.resolve()))
    .then(() => { mounts.forEach(setup); }).catch(() => {
    mounts.forEach((m) => {
      m.innerHTML = '<div class="slot">3D viewer unavailable offline' +
                    '<span class="slot-hint">requires a network connection</span></div>';
    });
  });

  function setup(el) {
    const url = el.dataset.model;
    const THREE = window.THREE;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16191c);

    const cam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd98a1f, 0.35);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const pivot = new THREE.Group();
    scene.add(pivot);

    let dist = 3;

    // Neutral surface for formats that carry no materials.
    const cadMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8bcc2, metalness: 0.25, roughness: 0.55,
      flatShading: false,
    });

    const ext = (url.split(".").pop() || "").toLowerCase();
    const onError = () => {
      el.innerHTML = '<div class="slot">Model failed to load' +
                     '<span class="slot-path">' + url + '</span></div>';
    };

    // CAD packages are Z-up; three.js is Y-up. Without this every model lies
    // on its side. Overridable per model with data-up="y" for anything that
    // was already exported Y-up, or data-spin to add a yaw offset.
    const up = (el.dataset.up || "z").toLowerCase();
    const spin = parseFloat(el.dataset.spin || "0") * Math.PI / 180;

    const frame = (obj) => {
      if (up === "z") obj.rotation.x = -Math.PI / 2;
      if (spin) obj.rotation.z += spin;
      // Measure after rotating so the box reflects the final orientation,
      // then recentre by shifting the wrapper rather than the rotated mesh.
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      wrap.add(obj);
      obj.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      dist = maxDim * 2.2;
      cam.position.set(0, maxDim * 0.35, dist);
      cam.near = maxDim / 100;
      cam.far = maxDim * 50;
      cam.updateProjectionMatrix();
      pivot.add(wrap);
    };

    if (ext === "stl") {
      new THREE.STLLoader().load(url, (geom) => {
        geom.computeVertexNormals();
        frame(new THREE.Mesh(geom, cadMaterial));
      }, undefined, onError);
    } else if (ext === "obj") {
      new THREE.OBJLoader().load(url, (obj) => {
        obj.traverse((c) => { if (c.isMesh) c.material = cadMaterial; });
        frame(obj);
      }, undefined, onError);
    } else {
      new THREE.GLTFLoader().load(url, (gltf) => frame(gltf.scene), undefined, onError);
    }

    let rx = 0.25, ry = 0.6, down = false, px = 0, py = 0, idle = true;

    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", (e) => {
      down = true; idle = false; px = e.clientX; py = e.clientY;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!down) return;
      ry += (e.clientX - px) * 0.008;
      rx += (e.clientY - py) * 0.008;
      rx = Math.max(-1.4, Math.min(1.4, rx));
      px = e.clientX; py = e.clientY;
    });
    cv.addEventListener("pointerup", () => { down = false; });
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      dist = Math.max(0.4, Math.min(60, dist * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });

    new ResizeObserver(() => {
      if (!el.clientWidth) return;
      cam.aspect = el.clientWidth / el.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }).observe(el);

    (function tick() {
      requestAnimationFrame(tick);
      if (idle) ry += 0.0022;          // slow drift until the user takes over
      pivot.rotation.y = ry;
      pivot.rotation.x = rx;
      const h = cam.position.y;
      cam.position.set(0, h, dist);
      cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
    })();
  }
})();
