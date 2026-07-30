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

export default function WaterHouseScene3D(): React.ReactElement {
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

        renderer.domElement.className =
          "w-full h-full outline-none focus:outline-none focus:ring-0 select-none";
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
            color: 0x3d6e3d,
            roughness: 0.9,
          }),
          soil: new THREE.MeshStandardMaterial({
            color: 0x4a3222,
            roughness: 0.95,
          }),
          foliageDark: new THREE.MeshStandardMaterial({
            color: 0x1b432a,
            roughness: 0.7,
          }),
          foliageLight: new THREE.MeshStandardMaterial({
            color: 0x2e6f40,
            roughness: 0.65,
          }),
          treeTrunk: new THREE.MeshStandardMaterial({
            color: 0x5c4033,
            roughness: 0.85,
          }),
          houseWall: new THREE.MeshStandardMaterial({
            color: 0x1c3a32, // สีโทนเขียวเข้มรีสอร์ต
            roughness: 0.5,
          }),
          woodDeck: new THREE.MeshStandardMaterial({
            color: 0x8a5a36,
            roughness: 0.6,
          }),
          metalRoof: new THREE.MeshStandardMaterial({
            color: 0x5c2f17, // หลังคาสีน้ำตาลไม้ฉลอง
            roughness: 0.4,
            metalness: 0.2,
          }),
          pontoonPipes: new THREE.MeshStandardMaterial({
            color: 0x1e252b,
            roughness: 0.5,
            metalness: 0.8,
          }),
          windowGlass: new THREE.MeshPhysicalMaterial({
            color: 0xadd8e6,
            emissive: 0x7eb6cb,
            emissiveIntensity: 0.8,
            roughness: 0.1,
            transmission: 0.6,
            transparent: true,
            opacity: 0.85,
          }),
          kayakBody: new THREE.MeshStandardMaterial({
            color: 0xd9a05b, // สีเรือคายัค
            roughness: 0.3,
            metalness: 0.1,
          }),
          kayakSeat: new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.8,
          }),
          paddleShaft: new THREE.MeshStandardMaterial({
            color: 0x3d2314,
            roughness: 0.4,
          }),
          personSkin: new THREE.MeshStandardMaterial({
            color: 0xf5c29b,
            roughness: 0.6,
          }),
          personShirt: new THREE.MeshStandardMaterial({
            color: 0x1e4a38,
            roughness: 0.7,
          }),
          water: new THREE.MeshPhysicalMaterial({
            color: 0x2b7a78,
            transparent: true,
            opacity: 0.75,
            roughness: 0.15,
            metalness: 0.1,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            side: THREE.DoubleSide,
          }),
          stone: new THREE.MeshStandardMaterial({
            color: 0x6e7f80,
            roughness: 0.9,
          }),
        };

        // -----------------------------------------------------------------
        // 3. Water Base (ผิวน้ำ)
        // -----------------------------------------------------------------
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(4.8, 64),
          materials.water,
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.45;
        water.receiveShadow = true;
        worldGroup.add(water);

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

        // ทุ่นลอยน้ำ
        [-1.4, 0, 1.4].forEach((x) => {
          const pontoon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 4.2, 16),
            materials.pontoonPipes,
          );
          pontoon.rotation.x = Math.PI / 2;
          pontoon.position.set(x, -0.32, 0);
          houseGroup.add(pontoon);
        });

        // พื้นแพไม้
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

        /**
         * หลังคาทรงจั่ว — ต้องยืดแกนที่ Group ที่ครอบ ไม่ใช่ที่ตัว mesh
         * Three.js ประกอบเมทริกซ์เป็น T·R·S คือ scale ทำงานก่อน rotate
         * ถ้าใส่ scale ไม่เท่ากันทุกแกนบน mesh ที่หมุน 45° ผังหลังคาจะกลายเป็น
         * สี่เหลี่ยมขนมเปียกปูนบิดเบี้ยวแทนสี่เหลี่ยมผืนผ้า
         */
        const roofGroup = new THREE.Group();
        roofGroup.position.set(-0.3, 2.15, -0.4);
        roofGroup.scale.set(1.2, 1, 1.1);
        houseGroup.add(roofGroup);

        const roofGeo = new THREE.ConeGeometry(2.6, 1.4, 4);
        const roof = new THREE.Mesh(roofGeo, materials.metalRoof);
        roof.position.y = 0.7;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roofGroup.add(roof);

        // ประตูและหน้าต่าง
        const createDoor = (
          x: number,
          y: number,
          z: number,
          w: number,
          h: number,
        ) => {
          const door = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.06),
            materials.woodDeck,
          );
          door.position.set(x, y, z);
          houseGroup.add(door);
        };

        const createWindow = (
          x: number,
          y: number,
          z: number,
          w: number,
          h: number,
          rotY = 0,
        ) => {
          const windowMesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.05),
            materials.windowGlass,
          );
          windowMesh.position.set(x, y, z);
          windowMesh.rotation.y = rotY;
          houseGroup.add(windowMesh);
        };

        createDoor(0.5, 0.85, 0.91, 0.7, 1.5);
        createWindow(-0.6, 1.15, 0.91, 0.7, 0.9);
        createWindow(-1.81, 1.2, -0.4, 0.8, 0.8, -Math.PI / 2);
        createWindow(1.21, 1.2, -0.4, 0.8, 0.8, Math.PI / 2);

        // -----------------------------------------------------------------
        // 6. Kayak Boat with Person (เรือคายัคและคนพาย)
        // -----------------------------------------------------------------
        const kayakGroup = new THREE.Group();
        kayakGroup.position.set(3.2, -0.28, 1.6);
        kayakGroup.rotation.y = -0.42;
        worldGroup.add(kayakGroup);

        // ตัวเรือคายัค
        const length = 3.2;
        const width = 0.55;
        const height = 0.22;
        const segments = 24;

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

            if (y > 0) y *= 0.2;
            else y *= 0.6;

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
        kayakGroup.add(kayakHull);

        // โมเดลคนพายเรือ (Person Model)
        const personGroup = new THREE.Group();
        personGroup.position.set(0, 0.1, 0);

        // หัว
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 16, 16),
          materials.personSkin,
        );
        head.position.y = 0.55;
        head.castShadow = true;
        personGroup.add(head);

        // ลำตัว
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.15, 0.4, 12),
          materials.personShirt,
        );
        body.position.y = 0.25;
        body.castShadow = true;
        personGroup.add(body);

        kayakGroup.add(personGroup);

        // พายเรือ (Paddle)
        const paddle = new THREE.Group();
        paddle.position.set(0, 0.35, 0);
        paddle.rotation.set(0.2, 0.4, 0.3);

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, 2.2, 12),
          materials.paddleShaft,
        );
        shaft.rotation.x = Math.PI / 2;
        paddle.add(shaft);

        [-1.05, 1.05].forEach((z) => {
          const bladeGeo = new THREE.SphereGeometry(0.14, 16, 16);
          bladeGeo.scale(0.3, 0.04, 1.0);
          const blade = new THREE.Mesh(bladeGeo, materials.kayakBody);
          blade.position.set(0, 0, z);
          paddle.add(blade);
        });

        kayakGroup.add(paddle);

        // -----------------------------------------------------------------
        // 7. Environment Details
        // -----------------------------------------------------------------
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
          mesh.position.set(3.2, -0.44, 1.6);
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
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x5299a0, 1.8);
        fillLight.position.set(-8, 4, -6);
        scene.add(fillLight);

        // -----------------------------------------------------------------
        // 9. Animation & Controls Logic
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

const MAX_ROTATION = Math.PI / 8;  // 22.5 องศา
const MIN_ROTATION = -Math.PI / 8; // -22.5 องศา

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

          // จังหวะการลอยของบ้านและเรือ
          houseGroup.position.y = Math.sin(seconds * 0.9) * 0.035;
          houseGroup.rotation.z = Math.sin(seconds * 0.7) * 0.008;

          kayakGroup.position.y = -0.28 + Math.sin(seconds * 1.2 + 0.5) * 0.015;
          kayakGroup.rotation.z = Math.sin(seconds * 1.1) * 0.015;

          // แอนิเมชันไม้พายหมุนตามจังหวะ
          paddle.rotation.z = Math.sin(seconds * 2.5) * 0.2;

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
        console.error("3D scene initialization failed:", error);
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
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
      aria-label="ภาพจำลองสามมิติของบ้านลอยน้ำ เรือคายัค และเกาะต้นไม้"
      role="img"
    >
      {/* <div className="absolute inset-0 bg-gradient-to-tr from-lagoon-400/10 via-bamboo-300/10 to-transparent blur-3xl pointer-events-none" /> */}
    </div>
  );
}
