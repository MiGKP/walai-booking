'use client';

import { useEffect, useRef } from 'react';
import type { Material, Mesh, Object3D } from 'three';

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
        scene.fog = new THREE.FogExp2(0xb8d7d2, 0.038);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(8.2, 5.8, 10.5);
        camera.lookAt(0, 1, 0);

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
            opacity: 0.62,
            roughness: 0.2,
            metalness: 0.08,
            clearcoat: 0.72,
            clearcoatRoughness: 0.26,
            side: THREE.DoubleSide,
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

        const water = new THREE.Mesh(
          new THREE.CircleGeometry(9.5, 64),
          materials.water
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.48;
        water.receiveShadow = true;
        worldGroup.add(water);

        const bank = new THREE.Mesh(
          new THREE.CylinderGeometry(3.15, 3.8, 0.46, 9),
          materials.forestLight
        );
        bank.position.set(-5.5, -0.55, -3.5);
        bank.scale.z = 0.7;
        bank.receiveShadow = true;
        worldGroup.add(bank);

        const bungalowGroup = new THREE.Group();
        bungalowGroup.position.set(-0.5, 0, -0.35);
        worldGroup.add(bungalowGroup);

        const platform = new THREE.Mesh(
          new THREE.BoxGeometry(5.2, 0.34, 4.2),
          materials.bambooDark
        );
        platform.position.y = 0;
        platform.castShadow = true;
        platform.receiveShadow = true;
        bungalowGroup.add(platform);

        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(4.8, 0.12, 1.15),
          materials.bamboo
        );
        deck.position.set(0, 0.24, 2.15);
        deck.castShadow = true;
        bungalowGroup.add(deck);

        const house = new THREE.Mesh(
          new THREE.BoxGeometry(3.45, 2.35, 2.75),
          materials.cream
        );
        house.position.set(0, 1.35, -0.28);
        house.castShadow = true;
        house.receiveShadow = true;
        bungalowGroup.add(house);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(2.75, 1.45, 4),
          materials.forest
        );
        roof.position.set(0, 3.12, -0.28);
        roof.rotation.y = Math.PI / 4;
        roof.scale.z = 0.83;
        roof.castShadow = true;
        bungalowGroup.add(roof);

        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 1.62, 0.08),
          materials.forest
        );
        door.position.set(0, 1.07, 1.13);
        bungalowGroup.add(door);

        [-1.08, 1.08].forEach((x) => {
          const windowMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.72, 0.07),
            materials.window
          );
          windowMesh.position.set(x, 1.62, 1.14);
          bungalowGroup.add(windowMesh);
        });

        const postGeometry = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8);
        [
          [-2.15, -0.64, -1.65],
          [2.15, -0.64, -1.65],
          [-2.15, -0.64, 1.65],
          [2.15, -0.64, 1.65],
        ].forEach(([x, y, z]) => {
          const post = new THREE.Mesh(postGeometry, materials.bambooDark);
          post.position.set(x, y, z);
          post.castShadow = true;
          bungalowGroup.add(post);
        });

        const railGeometry = new THREE.BoxGeometry(1.42, 0.09, 0.09);
        [-1.55, 1.55].forEach((x) => {
          const rail = new THREE.Mesh(railGeometry, materials.bamboo);
          rail.position.set(x, 0.8, 2.52);
          rail.rotation.y = Math.PI / 2;
          bungalowGroup.add(rail);
        });

        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 12, 8),
          materials.window
        );
        lantern.position.set(0, 2.6, 1.2);
        bungalowGroup.add(lantern);

        const lanternLight = new THREE.PointLight(0xffb85c, 7, 7, 2);
        lanternLight.position.copy(lantern.position);
        bungalowGroup.add(lanternLight);

        const kayakGroup = new THREE.Group();
        kayakGroup.position.set(4.2, -0.1, 1.35);
        kayakGroup.rotation.y = -0.56;
        worldGroup.add(kayakGroup);

        const hull = new THREE.Mesh(
          new THREE.SphereGeometry(1, 28, 14),
          materials.bamboo
        );
        hull.scale.set(2.35, 0.31, 0.62);
        hull.castShadow = true;
        kayakGroup.add(hull);

        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(1.04, 0.12, 0.58),
          materials.charcoal
        );
        seat.position.y = 0.27;
        kayakGroup.add(seat);

        const paddle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 3.45, 8),
          materials.bambooDark
        );
        paddle.position.set(0, 0.58, 0);
        paddle.rotation.z = Math.PI / 2;
        paddle.rotation.y = 0.22;
        kayakGroup.add(paddle);

        [-1.78, 1.78].forEach((x) => {
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.08, 0.27),
            materials.bamboo
          );
          blade.position.set(x, 0.58, x < 0 ? 0.4 : -0.4);
          blade.rotation.y = x < 0 ? -0.34 : 0.34;
          kayakGroup.add(blade);
        });

        const environmentGroup = new THREE.Group();
        worldGroup.add(environmentGroup);

        const reedGeometry = new THREE.CylinderGeometry(0.025, 0.045, 1.2, 6);
        for (let index = 0; index < 11; index += 1) {
          const reed = new THREE.Mesh(reedGeometry, materials.reed);
          reed.position.set(
            -5.15 + (index % 4) * 0.34,
            0.08 + (index % 3) * 0.1,
            -1.6 - Math.floor(index / 4) * 0.38
          );
          reed.rotation.z = (index % 2 === 0 ? -1 : 1) * 0.08;
          environmentGroup.add(reed);
        }

        [
          [-4.7, -0.24, -0.6, 0.52],
          [-5.6, -0.18, -0.8, 0.38],
          [5.5, -0.32, -2.6, 0.46],
        ].forEach(([x, y, z, scale]) => {
          const stone = new THREE.Mesh(
            new THREE.DodecahedronGeometry(scale, 0),
            materials.stone
          );
          stone.position.set(x, y, z);
          stone.rotation.set(x * 0.1, z * 0.2, 0);
          stone.castShadow = true;
          environmentGroup.add(stone);
        });

        const rings: AnimatedRing[] = [0, 1, 2].map((index) => {
          const material = new THREE.MeshBasicMaterial({
            color: 0xb8ded8,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.78, 0.018, 8, 48),
            material
          );
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(3.8, -0.41, 1.2);
          worldGroup.add(mesh);
          return { mesh, material, offset: index / 3 };
        });

        const hemisphereLight = new THREE.HemisphereLight(
          0xdaf1ea,
          0x123c30,
          2.5
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
          kayakGroup.position.y = -0.1 + Math.sin(seconds * 1.24 + 0.8) * 0.105;
          kayakGroup.rotation.z = Math.sin(seconds * 1.05) * 0.034;

          rings.forEach((ring) => {
            const progress = (seconds * 0.22 + ring.offset) % 1;
            const scale = 0.6 + progress * 2.8;
            ring.mesh.scale.setScalar(scale);
            ring.material.opacity = (1 - progress) * 0.32;
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
