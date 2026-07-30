'use client';

import { useEffect, useRef } from 'react';
import type { Material, Mesh, Object3D, Vector2 } from 'three';

interface AnimatedRing {
  mesh: Mesh;
  material: Material & { opacity: number };
  offset: number;
}

const disposeMaterial = (material: Material | Material[]): void => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
};

/** สุ่มแบบกำหนดค่าได้ เพื่อให้ตำแหน่งต้นอ้อ/ก้อนหินเหมือนกันทุกครั้งที่ mount */
const pseudoRandom = (seed: number): number => {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  return value - Math.floor(value);
};

export default function LoginScene3D(): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let cleanup = (): void => {};

    const initializeScene = async (): Promise<void> => {
      try {
        const THREE = await import('three');
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0xbcdad4, 0.042);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(8.4, 6.1, 10.8);
        camera.lookAt(0, 1.05, 0);

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.25 : 1.5)
        );
        renderer.domElement.className = 'login-scene-canvas';
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.tabIndex = -1;
        mount.appendChild(renderer.domElement);

        const worldGroup = new THREE.Group();
        worldGroup.rotation.y = -0.22;
        scene.add(worldGroup);

        const materials = {
          forest: new THREE.MeshStandardMaterial({
            color: 0x123c30,
            roughness: 0.68,
            metalness: 0.04,
          }),
          forestLight: new THREE.MeshStandardMaterial({
            color: 0x315f4f,
            roughness: 0.75,
          }),
          leaf: new THREE.MeshStandardMaterial({
            color: 0x24614a,
            roughness: 0.82,
          }),
          cream: new THREE.MeshStandardMaterial({
            color: 0xf4efe2,
            roughness: 0.82,
          }),
          bamboo: new THREE.MeshStandardMaterial({
            color: 0xd9a05b,
            roughness: 0.62,
          }),
          bambooDark: new THREE.MeshStandardMaterial({
            color: 0x8e5f2b,
            roughness: 0.8,
          }),
          charcoal: new THREE.MeshStandardMaterial({
            color: 0x202a27,
            roughness: 0.72,
          }),
          window: new THREE.MeshStandardMaterial({
            color: 0xffc66e,
            emissive: 0xe28b31,
            emissiveIntensity: 2.2,
            roughness: 0.3,
          }),
          water: new THREE.MeshPhysicalMaterial({
            color: 0x4e878c,
            transparent: true,
            opacity: 0.6,
            roughness: 0.18,
            metalness: 0.08,
            clearcoat: 0.74,
            clearcoatRoughness: 0.24,
            side: THREE.DoubleSide,
          }),
          deepWater: new THREE.MeshStandardMaterial({
            color: 0x1f4b4a,
            roughness: 1,
          }),
          reed: new THREE.MeshStandardMaterial({
            color: 0x67805d,
            roughness: 0.9,
          }),
          stone: new THREE.MeshStandardMaterial({
            color: 0x7d8f88,
            roughness: 0.96,
          }),
        };

        /**
         * รัศมี 34 คือระยะที่ FogExp2 density 0.042 กลืนขอบวงกลมไปแล้วราว 87%
         * ถ้าใช้รัศมีสั้นกว่านี้จะเห็นขอบเป็นเส้นโค้งคมชัดกลางผิวน้ำ
         */
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(34, 96),
          materials.water
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.48;
        water.receiveShadow = true;
        worldGroup.add(water);

        // พื้นใต้น้ำ ทำให้ผิวน้ำโปร่งแสงอ่านเป็นความลึกจริง
        const waterBed = new THREE.Mesh(
          new THREE.CircleGeometry(32, 64),
          materials.deepWater
        );
        waterBed.rotation.x = -Math.PI / 2;
        waterBed.position.y = -1.15;
        worldGroup.add(waterBed);

        // ───────────────────────── ฝั่งและต้นไม้ ─────────────────────────
        const shoreGroup = new THREE.Group();
        shoreGroup.position.set(-5.7, 0, -3.3);
        worldGroup.add(shoreGroup);

        const mound = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2, 3.9, 0.85, 18),
          materials.forestLight
        );
        mound.position.y = -0.62;
        mound.scale.z = 0.72;
        mound.receiveShadow = true;
        shoreGroup.add(mound);

        const shoreTop = -0.195;

        const trunkGeometry = new THREE.CylinderGeometry(0.07, 0.11, 0.8, 7);
        const canopyGeometry = new THREE.ConeGeometry(0.62, 1.05, 9);

        [
          [-0.9, -0.35, 1.15],
          [0.65, 0.5, 0.88],
          [1.7, -0.85, 0.7],
        ].forEach(([x, z, treeScale]) => {
          const tree = new THREE.Group();
          tree.position.set(x, shoreTop, z);
          tree.scale.setScalar(treeScale);

          const trunk = new THREE.Mesh(trunkGeometry, materials.bambooDark);
          trunk.position.y = 0.4;
          trunk.castShadow = true;
          tree.add(trunk);

          [0.98, 1.42, 1.78].forEach((height, tier) => {
            const canopy = new THREE.Mesh(canopyGeometry, tier === 1 ? materials.leaf : materials.forest);
            canopy.position.y = height;
            canopy.scale.setScalar(1 - tier * 0.24);
            canopy.castShadow = true;
            tree.add(canopy);
          });

          shoreGroup.add(tree);
        });

        // ───────────────────────── บ้านลอยน้ำ ─────────────────────────
        const bungalowGroup = new THREE.Group();
        bungalowGroup.position.set(-0.45, 0, -0.3);
        worldGroup.add(bungalowGroup);

        const platform = new THREE.Mesh(
          new THREE.BoxGeometry(5.2, 0.34, 4.2),
          materials.bambooDark
        );
        platform.castShadow = true;
        platform.receiveShadow = true;
        bungalowGroup.add(platform);

        const plankGeometry = new THREE.BoxGeometry(5.05, 0.06, 0.52);
        for (let index = 0; index < 7; index += 1) {
          const plank = new THREE.Mesh(plankGeometry, materials.bamboo);
          plank.position.set(0, 0.18, -1.74 + index * 0.58);
          plank.receiveShadow = true;
          bungalowGroup.add(plank);
        }

        const houseHeight = 2.2;
        const houseBase = 0.21;
        const houseCenterY = houseBase + houseHeight / 2;
        const houseCenterZ = -0.25;

        const house = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, houseHeight, 2.7),
          materials.cream
        );
        house.position.set(0, houseCenterY, houseCenterZ);
        house.castShadow = true;
        house.receiveShadow = true;
        bungalowGroup.add(house);

        /**
         * หลังคาต้องอยู่ใน Group แล้วบีบแกน z ที่ Group เท่านั้น
         * ถ้าใส่ scale.z บน mesh ที่หมุน 45° เอง matrix จะเป็น R·S ทำให้ผังหลังคา
         * บิดเป็นสี่เหลี่ยมขนมเปียกปูนแทนสี่เหลี่ยมผืนผ้า
         */
        const roofGroup = new THREE.Group();
        roofGroup.position.set(0, houseBase + houseHeight - 0.07, houseCenterZ);
        roofGroup.scale.z = 0.82;
        bungalowGroup.add(roofGroup);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(3.04, 1.5, 4),
          materials.forest
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 0.75;
        roof.castShadow = true;
        roofGroup.add(roof);

        const eave = new THREE.Mesh(
          new THREE.ConeGeometry(3.18, 0.18, 4),
          materials.bambooDark
        );
        eave.rotation.y = Math.PI / 4;
        eave.position.y = 0.04;
        eave.castShadow = true;
        roofGroup.add(eave);

        const finial = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.34, 8),
          materials.bamboo
        );
        finial.position.y = 1.62;
        roofGroup.add(finial);

        const houseFrontZ = houseCenterZ + 1.35;

        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.76, 1.58, 0.08),
          materials.forest
        );
        door.position.set(0, houseBase + 0.79, houseFrontZ + 0.02);
        bungalowGroup.add(door);

        const doorStep = new THREE.Mesh(
          new THREE.BoxGeometry(1.02, 0.08, 0.34),
          materials.bamboo
        );
        doorStep.position.set(0, houseBase + 0.04, houseFrontZ + 0.2);
        bungalowGroup.add(doorStep);

        const frameGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.06);
        const glassGeometry = new THREE.BoxGeometry(0.72, 0.72, 0.07);

        [-1.06, 1.06].forEach((x) => {
          const frame = new THREE.Mesh(frameGeometry, materials.bambooDark);
          frame.position.set(x, houseBase + 1.38, houseFrontZ);
          bungalowGroup.add(frame);

          const glass = new THREE.Mesh(glassGeometry, materials.window);
          glass.position.set(x, houseBase + 1.38, houseFrontZ + 0.03);
          bungalowGroup.add(glass);
        });

        const sideFrame = new THREE.Mesh(frameGeometry, materials.bambooDark);
        sideFrame.position.set(-1.71, houseBase + 1.38, houseCenterZ);
        sideFrame.rotation.y = Math.PI / 2;
        bungalowGroup.add(sideFrame);

        const sideGlass = new THREE.Mesh(glassGeometry, materials.window);
        sideGlass.position.set(-1.74, houseBase + 1.38, houseCenterZ);
        sideGlass.rotation.y = Math.PI / 2;
        bungalowGroup.add(sideGlass);

        const postGeometry = new THREE.CylinderGeometry(0.08, 0.1, 1.25, 8);
        [
          [-2.2, -0.66, -1.7],
          [2.2, -0.66, -1.7],
          [-2.2, -0.66, 1.7],
          [2.2, -0.66, 1.7],
        ].forEach(([x, y, z]) => {
          const post = new THREE.Mesh(postGeometry, materials.bambooDark);
          post.position.set(x, y, z);
          post.castShadow = true;
          bungalowGroup.add(post);
        });

        // ราวกันตกหน้าบ้าน — เสาสั้นสี่ต้นกับคานบนสองท่อน
        const railPostGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.62, 6);
        [-2.35, -1.2, 1.2, 2.35].forEach((x) => {
          const railPost = new THREE.Mesh(railPostGeometry, materials.bamboo);
          railPost.position.set(x, 0.48, 1.98);
          bungalowGroup.add(railPost);
        });

        const railGeometry = new THREE.BoxGeometry(1.2, 0.08, 0.08);
        [-1.78, 1.78].forEach((x) => {
          const rail = new THREE.Mesh(railGeometry, materials.bamboo);
          rail.position.set(x, 0.76, 1.98);
          bungalowGroup.add(rail);
        });

        const lanternCord = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5),
          materials.bambooDark
        );
        lanternCord.position.set(0, 2.44, 1.32);
        bungalowGroup.add(lanternCord);

        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 14, 10),
          materials.window
        );
        lantern.position.set(0, 2.2, 1.32);
        bungalowGroup.add(lantern);

        const lanternLight = new THREE.PointLight(0xffb85c, 7, 7, 2);
        lanternLight.position.copy(lantern.position);
        bungalowGroup.add(lanternLight);

        // ───────────────────────── เรือคายัค ─────────────────────────
        const kayakGroup = new THREE.Group();
        kayakGroup.position.set(4.0, -0.12, 1.5);
        kayakGroup.rotation.y = -0.52;
        worldGroup.add(kayakGroup);

        /**
         * ลำเรือใช้ LatheGeometry หมุนรอบแกน y แล้วล้มลงเป็นแกน x
         * โปรไฟล์รัศมีเป็น 0 ที่ปลายทั้งสองข้าง จึงได้หัว-ท้ายเรียวแบบเรือจริง
         * ต่างจากทรงกลมบี้ที่อ่านเป็นวงรีแบน
         */
        const hullPoints: Vector2[] = [];
        const hullSegments = 18;
        for (let index = 0; index <= hullSegments; index += 1) {
          const along = (index / hullSegments) * 2 - 1;
          const radius = Math.pow(Math.cos((along * Math.PI) / 2), 0.68);
          hullPoints.push(new THREE.Vector2(Math.max(radius * 0.55, 0.004), along));
        }

        const hull = new THREE.Mesh(
          new THREE.LatheGeometry(hullPoints, 26),
          materials.bamboo
        );
        // หมุน 90° พอดี สเกลจึงยังตรงกับแกนโลก: x=ความหนา y=ความยาว z=ความกว้าง
        hull.rotation.z = Math.PI / 2;
        hull.scale.set(0.42, 1.85, 0.72);
        hull.castShadow = true;
        kayakGroup.add(hull);

        const hullTop = 0.55 * 0.42;

        const deckSeam = new THREE.Mesh(
          new THREE.BoxGeometry(3.1, 0.04, 0.07),
          materials.bambooDark
        );
        deckSeam.position.y = hullTop;
        kayakGroup.add(deckSeam);

        const cockpitRim = new THREE.Mesh(
          new THREE.TorusGeometry(0.27, 0.045, 8, 22),
          materials.bambooDark
        );
        cockpitRim.rotation.x = Math.PI / 2;
        cockpitRim.position.y = hullTop;
        kayakGroup.add(cockpitRim);

        const cockpitHole = new THREE.Mesh(
          new THREE.CircleGeometry(0.27, 22),
          materials.charcoal
        );
        cockpitHole.rotation.x = -Math.PI / 2;
        cockpitHole.position.y = hullTop - 0.01;
        kayakGroup.add(cockpitHole);

        /**
         * ใบพายต้องอยู่ปลายก้านพอดี จึงผูกทุกชิ้นไว้ใน group เดียว
         * แล้วอ้างอิงครึ่งความยาวก้านเป็นตัวแปรร่วม
         */
        const paddleGroup = new THREE.Group();
        paddleGroup.position.set(-0.1, hullTop + 0.12, 0.05);
        paddleGroup.rotation.set(0, 0.44, 0.08);
        kayakGroup.add(paddleGroup);

        const paddleHalfLength = 1.3;

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.036, paddleHalfLength * 2, 10),
          materials.bambooDark
        );
        shaft.rotation.z = Math.PI / 2;
        shaft.castShadow = true;
        paddleGroup.add(shaft);

        const bladeGeometry = new THREE.SphereGeometry(1, 14, 10);
        [-1, 1].forEach((side) => {
          const blade = new THREE.Mesh(bladeGeometry, materials.bamboo);
          blade.position.x = side * (paddleHalfLength + 0.2);
          blade.scale.set(0.26, 0.13, 0.03);
          blade.rotation.z = side * 0.32;
          blade.castShadow = true;
          paddleGroup.add(blade);
        });

        // ───────────────────────── สภาพแวดล้อม ─────────────────────────
        const environmentGroup = new THREE.Group();
        worldGroup.add(environmentGroup);

        const reedGeometries = [0.95, 1.25, 1.55].map(
          (height) => new THREE.CylinderGeometry(0.016, 0.05, height, 6)
        );
        const cattailGeometry = new THREE.CapsuleGeometry(0.045, 0.13, 4, 8);

        for (let index = 0; index < 22; index += 1) {
          const variant = index % reedGeometries.length;
          const height = 0.95 + variant * 0.3;
          const reed = new THREE.Mesh(reedGeometries[variant], materials.reed);

          const spread = pseudoRandom(index + 1);
          const depth = pseudoRandom(index + 41);
          const x = -6.9 + spread * 2.9;
          const z = -1.5 - depth * 1.9;

          reed.position.set(x, -0.42 + height / 2, z);
          reed.rotation.z = (pseudoRandom(index + 77) - 0.5) * 0.24;
          reed.rotation.x = (pseudoRandom(index + 103) - 0.5) * 0.16;
          environmentGroup.add(reed);

          if (index % 3 === 0) {
            const cattail = new THREE.Mesh(cattailGeometry, materials.bambooDark);
            cattail.position.set(x, -0.42 + height + 0.06, z);
            environmentGroup.add(cattail);
          }
        }

        // ก้อนหินใช้ Icosahedron detail 1 แล้วบิดสเกล จึงดูกลมมนแบบหินแม่น้ำ
        const stoneGeometry = new THREE.IcosahedronGeometry(1, 1);
        [
          [-4.35, -0.5, 1.1, 0.46],
          [-5.15, -0.44, 1.75, 0.32],
          [5.9, -0.54, -3.4, 0.44],
          [5.05, -0.47, -2.85, 0.26],
          [2.9, -0.46, 3.15, 0.3],
        ].forEach(([x, y, z, size], index) => {
          const stone = new THREE.Mesh(stoneGeometry, materials.stone);
          stone.position.set(x, y, z);
          stone.scale.set(size, size * 0.62, size * 0.86);
          stone.rotation.set(
            pseudoRandom(index + 11) * Math.PI,
            pseudoRandom(index + 29) * Math.PI,
            pseudoRandom(index + 53) * 0.4
          );
          stone.castShadow = true;
          environmentGroup.add(stone);
        });

        const lilyGeometry = new THREE.CircleGeometry(0.26, 14, 0.34, Math.PI * 2 - 0.68);
        [
          [-2.9, 2.6],
          [-3.6, 1.9],
          [1.6, 3.4],
          [5.1, 0.4],
          [4.6, -1.5],
        ].forEach(([x, z], index) => {
          const lily = new THREE.Mesh(lilyGeometry, materials.forestLight);
          lily.rotation.x = -Math.PI / 2;
          lily.rotation.z = pseudoRandom(index + 7) * Math.PI * 2;
          lily.position.set(x, -0.46, z);
          lily.scale.setScalar(0.75 + pseudoRandom(index + 19) * 0.5);
          environmentGroup.add(lily);
        });

        const rings: AnimatedRing[] = [0, 1, 2].map((index) => {
          const material = new THREE.MeshBasicMaterial({
            color: 0xd8ede8,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.78, 0.016, 8, 48),
            material
          );
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(kayakGroup.position.x, -0.44, kayakGroup.position.z);
          worldGroup.add(mesh);
          return { mesh, material, offset: index / 3 };
        });

        const hemisphereLight = new THREE.HemisphereLight(
          0xdaf1ea,
          0x123c30,
          2.4
        );
        scene.add(hemisphereLight);

        const sunLight = new THREE.DirectionalLight(0xfff1cf, 4.2);
        sunLight.position.set(6, 10, 7);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 30;
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x68b6ba, 2.1);
        fillLight.position.set(-7, 3, -5);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffe6b0, 1.5);
        rimLight.position.set(-3, 4, 9);
        scene.add(rimLight);

        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let reducedMotion = motionQuery.matches;
        let pointerX = 0;
        let pointerY = 0;
        let targetPointerX = 0;
        let targetPointerY = 0;
        let animationFrame = 0;
        let tabVisible = !document.hidden;

        const renderScene = (): void => {
          renderer.render(scene, camera);
        };

        const resize = (): void => {
          const width = Math.max(mount.clientWidth, 1);
          const height = Math.max(mount.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const sceneScale =
            width / height < 1.1
              ? 0.68
              : width < 620
                ? 0.77
                : width < 900
                  ? 0.9
                  : 1;
          worldGroup.scale.setScalar(sceneScale);
          renderScene();
        };

        const handlePointerMove = (event: PointerEvent): void => {
          if (reducedMotion) return;
          const bounds = mount.getBoundingClientRect();
          targetPointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
          targetPointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        };

        const animate = (time: number): void => {
          if (disposed || reducedMotion || !tabVisible) {
            animationFrame = 0;
            renderScene();
            return;
          }

          const seconds = time * 0.001;
          pointerX += (targetPointerX - pointerX) * 0.035;
          pointerY += (targetPointerY - pointerY) * 0.035;

          worldGroup.rotation.y = -0.22 + seconds * 0.026 + pointerX * 0.11;
          worldGroup.rotation.x = pointerY * 0.045;
          bungalowGroup.position.y = Math.sin(seconds * 0.85) * 0.055;
          bungalowGroup.rotation.z = Math.sin(seconds * 0.62) * 0.008;
          kayakGroup.position.y = -0.12 + Math.sin(seconds * 1.24 + 0.8) * 0.105;
          kayakGroup.rotation.z = Math.sin(seconds * 1.05) * 0.034;
          lantern.scale.setScalar(1 + Math.sin(seconds * 2.1) * 0.045);
          lanternLight.intensity = 6.4 + Math.sin(seconds * 2.1) * 0.9;

          rings.forEach((ring) => {
            const progress = (seconds * 0.22 + ring.offset) % 1;
            const scale = 0.6 + progress * 2.8;
            ring.mesh.scale.setScalar(scale);
            ring.material.opacity = (1 - progress) * 0.3;
          });

          renderScene();
          animationFrame = window.requestAnimationFrame(animate);
        };

        const startAnimation = (): void => {
          if (!animationFrame && !reducedMotion && tabVisible && !disposed) {
            animationFrame = window.requestAnimationFrame(animate);
          } else {
            renderScene();
          }
        };

        const handleVisibility = (): void => {
          tabVisible = !document.hidden;
          if (!tabVisible && animationFrame) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          }
          startAnimation();
        };

        const handleMotionChange = (event: MediaQueryListEvent): void => {
          reducedMotion = event.matches;
          if (reducedMotion && animationFrame) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          }
          startAnimation();
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        mount.addEventListener('pointermove', handlePointerMove, { passive: true });
        document.addEventListener('visibilitychange', handleVisibility);
        motionQuery.addEventListener('change', handleMotionChange);
        resize();
        mount.dataset.sceneState = 'ready';
        startAnimation();

        cleanup = (): void => {
          resizeObserver.disconnect();
          mount.removeEventListener('pointermove', handlePointerMove);
          document.removeEventListener('visibilitychange', handleVisibility);
          motionQuery.removeEventListener('change', handleMotionChange);
          if (animationFrame) window.cancelAnimationFrame(animationFrame);

          scene.traverse((object: Object3D) => {
            const mesh = object as Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry?.dispose();
            if (mesh.material) disposeMaterial(mesh.material);
          });

          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      } catch (error: unknown) {
        console.error('Login 3D scene initialization failed:', error);
        mount.dataset.sceneState = 'fallback';
      }
    };

    void initializeScene();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="login-scene-shell"
      aria-label="ภาพจำลองสามมิติของที่พักลอยน้ำและเรือคายัค"
      role="img"
    >
      <div className="login-scene-glow" aria-hidden="true" />
    </div>
  );
}
