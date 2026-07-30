"use client";

import { useEffect, useRef } from "react";
import type { Material, Mesh, Object3D } from "three";

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

export default function RegisterScene3D(): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let cleanup = (): void => {};

    const initializeScene = async (): Promise<void> => {
      try {
        const THREE = await import("three");
        if (disposed) return;

        // -----------------------------------------------------------------
        // 1. Scene / Camera / Renderer Setup
        // -----------------------------------------------------------------
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0xbcdad4, 0.032);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(9.5, 6.2, 11.5);
        camera.lookAt(0, 0.8, 0);

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          precision: "highp",
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        renderer.domElement.className = "login-scene-canvas";
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.tabIndex = -1;
        mount.appendChild(renderer.domElement);

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);

        // -----------------------------------------------------------------
        // 2. Materials
        // -----------------------------------------------------------------
        const materials = {
          landTerrain: new THREE.MeshStandardMaterial({
            color: 0x315f4f,
            roughness: 0.9,
          }),
          soil: new THREE.MeshStandardMaterial({
            color: 0x5b4028,
            roughness: 0.95,
          }),
          foliageDark: new THREE.MeshStandardMaterial({
            color: 0x123c30,
            roughness: 0.7,
          }),
          foliageLight: new THREE.MeshStandardMaterial({
            color: 0x24614a,
            roughness: 0.65,
          }),
          treeTrunk: new THREE.MeshStandardMaterial({
            color: 0x8e5f2b,
            roughness: 0.85,
          }),
          houseWall: new THREE.MeshStandardMaterial({
            color: 0xf4efe2,
            roughness: 0.4,
          }),
          woodDeck: new THREE.MeshStandardMaterial({
            color: 0x8e5f2b,
            roughness: 0.6,
          }),
          metalRoof: new THREE.MeshStandardMaterial({
            color: 0x123c30,
            roughness: 0.42,
            metalness: 0.28,
          }),
          pontoonPipes: new THREE.MeshStandardMaterial({
            color: 0x202a27,
            roughness: 0.5,
            metalness: 0.8,
          }),
          windowGlass: new THREE.MeshPhysicalMaterial({
            color: 0xffe5b4,
            emissive: 0xffa042,
            emissiveIntensity: 1.8,
            roughness: 0.1,
            transmission: 0.5,
            transparent: true,
            opacity: 0.85,
          }),
          kayakBody: new THREE.MeshStandardMaterial({
            color: 0xd9a05b,
            roughness: 0.45,
            metalness: 0.05,
          }),
          kayakSeat: new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.8,
          }),
          paddleShaft: new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            roughness: 0.4,
            metalness: 0.3,
          }),
          water: new THREE.MeshPhysicalMaterial({
            color: 0x4e878c,
            transparent: true,
            opacity: 0.6,
            roughness: 0.15,
            metalness: 0.1,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            side: THREE.DoubleSide,
          }),
          deepWater: new THREE.MeshStandardMaterial({
            color: 0x1f4b4a,
            roughness: 1,
          }),
          stone: new THREE.MeshStandardMaterial({
            color: 0x7d8f88,
            roughness: 0.9,
          }),
        };

        // -----------------------------------------------------------------
        // 3. Water Base (ผิวน้ำ)
        // -----------------------------------------------------------------
        /**
         * รัศมี 44 คือระยะที่ FogExp2 density 0.032 กลืนขอบวงกลมไปเกือบหมด
         * รัศมีสั้นกว่านี้จะเห็นขอบผิวน้ำเป็นเส้นโค้งคมกลางภาพ
         */
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(44, 96),
          materials.water,
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.45;
        water.receiveShadow = true;
        worldGroup.add(water);

        // พื้นใต้น้ำสีเข้ม ทำให้ผิวน้ำโปร่งแสงอ่านเป็นความลึกแทนที่จะเป็นแผ่นสีเรียบ
        const waterBed = new THREE.Mesh(
          new THREE.CircleGeometry(42, 64),
          materials.deepWater,
        );
        waterBed.rotation.x = -Math.PI / 2;
        waterBed.position.y = -1.15;
        worldGroup.add(waterBed);

        // -----------------------------------------------------------------
        // 4. Land & Forest
        // -----------------------------------------------------------------
        const landGroup = new THREE.Group();
        landGroup.position.set(-4.8, -0.2, -3.2);
        worldGroup.add(landGroup);

        const soilBase = new THREE.Mesh(
          new THREE.CylinderGeometry(3.6, 4.2, 0.6, 24),
          materials.soil,
        );
        soilBase.position.y = -0.3;
        soilBase.receiveShadow = true;
        landGroup.add(soilBase);

        const grassTop = new THREE.Mesh(
          new THREE.CylinderGeometry(3.65, 3.6, 0.25, 24),
          materials.landTerrain,
        );
        grassTop.position.y = 0.05;
        grassTop.receiveShadow = true;
        grassTop.castShadow = true;
        landGroup.add(grassTop);

        const createTree = (x: number, z: number, scale: number) => {
          const tree = new THREE.Group();
          tree.position.set(x, 0.15, z);
          tree.scale.setScalar(scale);

          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8),
            materials.treeTrunk,
          );
          trunk.position.y = 0.45;
          trunk.castShadow = true;
          tree.add(trunk);

          const mat =
            scale > 0.9 ? materials.foliageDark : materials.foliageLight;
          [
            { r: 0.65, h: 0.8, y: 0.9 },
            { r: 0.5, h: 0.7, y: 1.35 },
            { r: 0.32, h: 0.55, y: 1.75 },
          ].forEach((layer) => {
            const leaves = new THREE.Mesh(
              new THREE.ConeGeometry(layer.r, layer.h, 7),
              mat,
            );
            leaves.position.y = layer.y;
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            tree.add(leaves);
          });

          landGroup.add(tree);
        };

        createTree(-0.8, -0.5, 1.1);
        createTree(0.6, -1.2, 0.85);
        createTree(-1.5, 0.8, 0.95);
        createTree(1.2, 0.4, 0.75);
        createTree(0.1, 1.1, 1.05);

        // -----------------------------------------------------------------
        // 5. Floating House (บ้านลอยน้ำ)
        // -----------------------------------------------------------------
        const houseGroup = new THREE.Group();
        houseGroup.position.set(-0.2, 0, 0.2);
        worldGroup.add(houseGroup);

        // ทุ่นลอยน้ำใต้ตัวบ้าน
        [-1.4, 0, 1.4].forEach((x) => {
          const pontoon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 4.2, 16),
            materials.pontoonPipes,
          );
          pontoon.rotation.x = Math.PI / 2;
          pontoon.position.set(x, -0.32, 0);
          houseGroup.add(pontoon);
        });

        // พื้นไม้
        const mainDeck = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 0.18, 4.4),
          materials.woodDeck,
        );
        mainDeck.position.y = -0.12;
        mainDeck.castShadow = true;
        mainDeck.receiveShadow = true;
        houseGroup.add(mainDeck);

        // ตัวบ้าน
        const houseBody = new THREE.Mesh(
          new THREE.BoxGeometry(3.0, 2.2, 2.6),
          materials.houseWall,
        );
        houseBody.position.set(-0.3, 1.07, -0.4);
        houseBody.castShadow = true;
        houseBody.receiveShadow = true;
        houseGroup.add(houseBody);

        // หลังคา
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(3.5, 0.12, 3.2),
          materials.metalRoof,
        );
        roof.position.set(-0.3, 2.22, -0.4);
        roof.rotation.z = -0.08;
        roof.castShadow = true;
        houseGroup.add(roof);

        // -------------------------------------------------------------
        // 🚪 งานประตูบ้าน & 🪟 หน้าต่าง
        // -------------------------------------------------------------
        const frameMat = materials.woodDeck;
        const glassMat = materials.windowGlass;
        const handleMat = materials.paddleShaft;

        // 1. ฟังก์ชันสร้างประตูสมจริง (มีกรอบ, คิ้วบานซอย, มือจับ)
        const createDoor = (x: number, y: number, z: number, w: number, h: number) => {
          const doorGroup = new THREE.Group();
          doorGroup.position.set(x, y, z);

          const doorLeaf = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.06),
            frameMat
          );
          doorGroup.add(doorLeaf);

          [-0.35, 0.25].forEach((panelY) => {
            const panel = new THREE.Mesh(
              new THREE.BoxGeometry(w - 0.16, 0.55, 0.08),
              frameMat
            );
            panel.position.set(0, panelY, 0);
            doorGroup.add(panel);
          });

          const handleBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12),
            handleMat
          );
          handleBase.rotation.x = Math.PI / 2;
          handleBase.position.set(-w / 2 + 0.12, -0.05, 0.05);
          doorGroup.add(handleBase);

          const handleLever = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.025, 0.03),
            handleMat
          );
          handleLever.position.set(-w / 2 + 0.16, -0.05, 0.08);
          doorGroup.add(handleLever);

          const frameTop = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.08, 0.06, 0.08),
            frameMat
          );
          frameTop.position.y = h / 2 + 0.03;
          doorGroup.add(frameTop);

          const frameLeft = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, h + 0.06, 0.08),
            frameMat
          );
          frameLeft.position.x = -w / 2 - 0.03;
          doorGroup.add(frameLeft);

          const frameRight = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, h + 0.06, 0.08),
            frameMat
          );
          frameRight.position.x = w / 2 + 0.03;
          doorGroup.add(frameRight);

          houseGroup.add(doorGroup);
        };

        createDoor(0.8, 0.95, 0.91, 0.75, 1.65);

        // 2. ฟังก์ชันสร้างหน้าต่าง
        const createWindow = (
          x: number,
          y: number,
          z: number,
          w: number,
          h: number,
          rotY = 0,
        ) => {
          const windowGroup = new THREE.Group();
          windowGroup.position.set(x, y, z);
          windowGroup.rotation.y = rotY;

          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.05),
            glassMat,
          );
          windowGroup.add(glass);

          const frameTopBottom = new THREE.BoxGeometry(w + 0.08, 0.06, 0.07);
          const frameSides = new THREE.BoxGeometry(0.06, h, 0.07);

          const topFrame = new THREE.Mesh(frameTopBottom, frameMat);
          topFrame.position.y = h / 2 + 0.03;
          windowGroup.add(topFrame);

          const bottomFrame = new THREE.Mesh(frameTopBottom, frameMat);
          bottomFrame.position.y = -h / 2 - 0.03;
          windowGroup.add(bottomFrame);

          const leftFrame = new THREE.Mesh(frameSides, frameMat);
          leftFrame.position.x = -w / 2 - 0.03;
          windowGroup.add(leftFrame);

          const rightFrame = new THREE.Mesh(frameSides, frameMat);
          rightFrame.position.x = w / 2 + 0.03;
          windowGroup.add(rightFrame);

          houseGroup.add(windowGroup);
        };

        createWindow(-0.5, 1.15, 0.91, 1.3, 1.1);
        createWindow(-1.81, 1.2, -0.4, 0.9, 0.9, -Math.PI / 2);
        createWindow(1.21, 1.2, -0.4, 0.9, 0.9, Math.PI / 2);

        // แสงไฟอบอุ่นส่องสว่างออกมาจากภายในบ้าน
        const houseLight = new THREE.PointLight(0xffaa44, 8, 6, 1.8);
        houseLight.position.set(-0.3, 1.2, -0.2);
        houseGroup.add(houseLight);

        // -----------------------------------------------------------------
        // 6. Kayak Boat
        // -----------------------------------------------------------------
        const kayakGroup = new THREE.Group();
        kayakGroup.position.set(3.6, -0.28, 1.6);
        kayakGroup.rotation.y = -0.42;
        worldGroup.add(kayakGroup);

        const length = 3.6;
        const width = 0.55;
        const height = 0.22;
        const segments = 32;

        const kayakGeo = new THREE.BufferGeometry();
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= segments; i++) {
          const v = i / segments;
          const theta = v * Math.PI;

          for (let j = 0; j <= segments; j++) {
            const u = j / segments;
            const phi = u * Math.PI * 2;

            let x = Math.sin(theta) * Math.cos(phi) * (length / 2);
            let y = Math.cos(theta) * height;
            let z = Math.sin(theta) * Math.sin(phi) * width;

            if (y > 0) {
              y *= 0.2;
            } else {
              y *= 0.6;
            }

            const taper = Math.sin(theta);
            x *= Math.pow(taper, 0.2);

            positions.push(x, y, z);
            uvs.push(u, v);
          }
        }

        for (let i = 0; i < segments; i++) {
          for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + segments + 1;
            indices.push(a, b, a + 1);
            indices.push(b, b + 1, a + 1);
          }
        }

        kayakGeo.setIndex(indices);
        kayakGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        kayakGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        kayakGeo.computeVertexNormals();

        const kayakHull = new THREE.Mesh(kayakGeo, materials.kayakBody);
        kayakHull.castShadow = true;
        kayakHull.receiveShadow = true;
        kayakHull.renderOrder = 2;
        kayakGroup.add(kayakHull);

        const seatPositionsX = [-0.65, 0.55];

        seatPositionsX.forEach((posX) => {
          const holeGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.03, 24);
          const holeMesh = new THREE.Mesh(holeGeo, materials.kayakSeat);

          holeMesh.position.set(posX, 0.03, 0);
          holeMesh.scale.set(1.3, 1, 0.85);
          holeMesh.renderOrder = 3;
          kayakGroup.add(holeMesh);
        });

        const createPaddle = (posX: number, rotY: number) => {
          const paddle = new THREE.Group();
          paddle.position.set(posX, 0.06, 0);
          paddle.rotation.set(0, rotY, 0.03);

          const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, 2.4, 12),
            materials.paddleShaft,
          );
          shaft.rotation.x = Math.PI / 2;
          shaft.renderOrder = 3;
          paddle.add(shaft);

          [-1.18, 1.18].forEach((z) => {
            const bladeGeo = new THREE.SphereGeometry(0.16, 16, 16);
            bladeGeo.scale(0.4, 0.05, 1.1);
            const blade = new THREE.Mesh(bladeGeo, materials.kayakBody);
            blade.position.set(0, 0, z);
            blade.rotation.z = z < 0 ? 0.2 : -0.2;
            blade.renderOrder = 3;
            paddle.add(blade);
          });

          return paddle;
        };

        kayakGroup.add(createPaddle(-0.65, 0.1));
        kayakGroup.add(createPaddle(0.55, -0.08));

        // -----------------------------------------------------------------
        // 7. Environment Details
        // -----------------------------------------------------------------
        [
          [-4.2, -0.28, -0.5, 0.45],
          [-4.9, -0.22, -0.8, 0.32],
          [4.8, -0.32, -2.2, 0.5],
        ].forEach(([x, y, z, scale]) => {
          const stone = new THREE.Mesh(
            new THREE.DodecahedronGeometry(scale, 1),
            materials.stone,
          );
          stone.position.set(x, y, z);
          stone.rotation.set(x, z, 0);
          stone.castShadow = true;
          worldGroup.add(stone);
        });

        const rings: AnimatedRing[] = [0, 1, 2].map((index) => {
          const material = new THREE.MeshBasicMaterial({
            color: 0x9be3de,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.7, 0.015, 12, 64),
            material,
          );
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(3.6, -0.44, 1.6);
          mesh.renderOrder = 1;
          worldGroup.add(mesh);
          return { mesh, material, offset: index / 3 };
        });

        // -----------------------------------------------------------------
        // 8. Lights
        // -----------------------------------------------------------------
        const hemisphereLight = new THREE.HemisphereLight(
          0xeef7f6,
          0x1b382b,
          2.2,
        );
        scene.add(hemisphereLight);

        const sunLight = new THREE.DirectionalLight(0xfff5db, 4.0);
        sunLight.position.set(8, 12, 6);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.bias = -0.0001;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 35;
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x5299a0, 1.8);
        fillLight.position.set(-8, 4, -6);
        scene.add(fillLight);

        // -----------------------------------------------------------------
        // 9. Controls / Physics / Animation Logic
        // -----------------------------------------------------------------
        const motionQuery = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        );
        let reducedMotion = motionQuery.matches;
        let pointerX = 0;
        let pointerY = 0;
        let targetPointerX = 0;
        let targetPointerY = 0;
        let animationFrame = 0;
        let tabVisible = !document.hidden;

        let isDragging = false;
        let previousMouseX = 0;
        let targetRotationY = 0;
        let currentRotationY = 0;
        let velocityY = 0;

        const MAX_ROTATION = Math.PI / 2;
        const MIN_ROTATION = -Math.PI / 2;

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

        const handlePointerDown = (event: PointerEvent): void => {
          isDragging = true;
          previousMouseX = event.clientX;
          velocityY = 0;
        };

        const handlePointerUp = (): void => {
          isDragging = false;
        };

        const handlePointerMove = (event: PointerEvent): void => {
          if (reducedMotion) return;
          const bounds = mount.getBoundingClientRect();

          if (isDragging) {
            const deltaX = event.clientX - previousMouseX;
            previousMouseX = event.clientX;
            velocityY = deltaX * 0.005;
          } else {
            targetPointerX =
              ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
            targetPointerY =
              ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
          }
        };

        const animate = (time: number): void => {
          if (disposed || reducedMotion || !tabVisible) {
            animationFrame = 0;
            renderScene();
            return;
          }

          const seconds = time * 0.001;

          pointerX += (targetPointerX - pointerX) * 0.04;
          pointerY += (targetPointerY - pointerY) * 0.04;

          if (isDragging) {
            targetRotationY += velocityY;
          } else {
            velocityY *= 0.92;
            targetRotationY += velocityY;
          }

          targetRotationY = Math.max(
            MIN_ROTATION,
            Math.min(MAX_ROTATION, targetRotationY),
          );
          currentRotationY += (targetRotationY - currentRotationY) * 0.08;

          worldGroup.rotation.y = currentRotationY + pointerX * 0.04;
          worldGroup.rotation.x = pointerY * 0.025;

          houseGroup.position.y = Math.sin(seconds * 0.9) * 0.035;
          houseGroup.rotation.z = Math.sin(seconds * 0.7) * 0.008;

          kayakGroup.position.y = -0.28 + Math.sin(seconds * 1.2 + 0.5) * 0.015;
          kayakGroup.rotation.z = Math.sin(seconds * 1.1) * 0.015;

          rings.forEach((ring) => {
            const progress = (seconds * 0.25 + ring.offset) % 1;
            const scale = 0.6 + progress * 2.5;
            ring.mesh.scale.setScalar(scale);
            ring.material.opacity = (1 - progress) * 0.35;
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

        mount.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointerup", handlePointerUp);
        mount.addEventListener("pointermove", handlePointerMove, {
          passive: true,
        });
        document.addEventListener("visibilitychange", handleVisibility);
        motionQuery.addEventListener("change", handleMotionChange);

        resize();
        mount.dataset.sceneState = "ready";
        startAnimation();

        cleanup = (): void => {
          resizeObserver.disconnect();
          mount.removeEventListener("pointerdown", handlePointerDown);
          window.removeEventListener("pointerup", handlePointerUp);
          mount.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("visibilitychange", handleVisibility);
          motionQuery.removeEventListener("change", handleMotionChange);
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
        console.error("Register 3D scene initialization failed:", error);
        mount.dataset.sceneState = "fallback";
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
      className="login-scene-shell cursor-grab active:cursor-grabbing select-none"
      aria-label="ภาพจำลองสามมิติของบ้านลอยน้ำ เรือคายัค และเกาะต้นไม้"
      role="img"
    >
      <div className="login-scene-glow" aria-hidden="true" />
    </div>
  );
}