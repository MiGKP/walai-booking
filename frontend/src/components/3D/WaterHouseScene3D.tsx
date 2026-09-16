"use client";

import { useEffect, useRef } from "react";
import type { Material, Mesh, Object3D } from "three";
import type * as THREE from "three";

interface AnimatedRing {
  mesh: Mesh;
  material: Material & { opacity: number };
  offset: number;
  baseY: number;
}

const disposeMaterial = (material: THREE.Material | THREE.Material[]): void => {
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
        camera.position.set(9.5, 6.4, 11.8);
        camera.lookAt(0, 0.8, 0);

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          precision: "highp",
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
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
            color: 0x3f7a45,
            roughness: 0.9,
          }),
          soil: new THREE.MeshStandardMaterial({
            color: 0x4a3222,
            roughness: 0.95,
          }),
          foliageDark: new THREE.MeshStandardMaterial({
            color: 0x1c4a2d,
            roughness: 0.7,
          }),
          foliageLight: new THREE.MeshStandardMaterial({
            color: 0x379457,
            roughness: 0.6,
          }),
          foliageAccent: new THREE.MeshStandardMaterial({
            color: 0x6fae3e,
            roughness: 0.6,
          }),
          bushLeaf: new THREE.MeshStandardMaterial({
            color: 0x2f6b3a,
            roughness: 0.75,
          }),
          flowerPink: new THREE.MeshStandardMaterial({
            color: 0xf2a6c1,
            roughness: 0.5,
          }),
          flowerYellow: new THREE.MeshStandardMaterial({
            color: 0xf5cf4d,
            roughness: 0.5,
          }),
          treeTrunk: new THREE.MeshStandardMaterial({
            color: 0x5c4033,
            roughness: 0.85,
          }),
          rock: new THREE.MeshStandardMaterial({
            color: 0x7c8a8b,
            roughness: 0.95,
          }),
          houseWall: new THREE.MeshStandardMaterial({
            color: 0x1f4038,
            roughness: 0.45,
          }),
          houseTrim: new THREE.MeshStandardMaterial({
            color: 0xead9b5,
            roughness: 0.5,
          }),
          woodDeck: new THREE.MeshStandardMaterial({
            color: 0x8f5f39,
            roughness: 0.55,
          }),
          railing: new THREE.MeshStandardMaterial({
            color: 0xe7d7ae,
            roughness: 0.5,
          }),
          metalRoof: new THREE.MeshPhysicalMaterial({
            color: 0x6b3319,
            roughness: 0.35,
            metalness: 0.35,
            clearcoat: 0.3,
            clearcoatRoughness: 0.4,
          }),
          roofRidge: new THREE.MeshStandardMaterial({
            color: 0x3a1c0d,
            roughness: 0.5,
            metalness: 0.2,
          }),
          pontoonPipes: new THREE.MeshStandardMaterial({
            color: 0x1e252b,
            roughness: 0.45,
            metalness: 0.85,
          }),
          windowGlass: new THREE.MeshPhysicalMaterial({
            color: 0xbfe2ea,
            emissive: 0xffdca8,
            emissiveIntensity: 0.35,
            roughness: 0.08,
            transmission: 0.65,
            transparent: true,
            opacity: 0.9,
          }),
          lanternGlass: new THREE.MeshStandardMaterial({
            color: 0xffe3a3,
            emissive: 0xffb545,
            emissiveIntensity: 1.6,
            roughness: 0.3,
          }),
          lanternFrame: new THREE.MeshStandardMaterial({
            color: 0x2b2018,
            roughness: 0.6,
            metalness: 0.4,
          }),
          potClay: new THREE.MeshStandardMaterial({
            color: 0xaa5a3a,
            roughness: 0.85,
          }),
          kayakBody: new THREE.MeshStandardMaterial({
            color: 0xe2a355,
            roughness: 0.28,
            metalness: 0.1,
          }),
          kayakTrim: new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.5,
          }),
          paddleShaft: new THREE.MeshStandardMaterial({
            color: 0x3d2314,
            roughness: 0.4,
          }),
          paddleBlade: new THREE.MeshStandardMaterial({
            color: 0xe2a355,
            roughness: 0.3,
          }),
          personSkin: new THREE.MeshStandardMaterial({
            color: 0xf5c29b,
            roughness: 0.6,
          }),
          personShirt: new THREE.MeshStandardMaterial({
            color: 0xd94f4f,
            roughness: 0.7,
          }),
          personHat: new THREE.MeshStandardMaterial({
            color: 0xf3e0b8,
            roughness: 0.8,
          }),
          lilyPad: new THREE.MeshStandardMaterial({
            color: 0x2f7d4f,
            roughness: 0.6,
          }),
          water: new THREE.MeshPhysicalMaterial({
            color: 0x1f8b86,
            transparent: true,
            opacity: 0.82,
            roughness: 0.1,
            metalness: 0.05,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            transmission: 0.15,
            side: THREE.DoubleSide,
          }),
        };

        // -----------------------------------------------------------------
        // 4. Water Base with a subtle two-tone gradient look
        // -----------------------------------------------------------------
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(5.4, 96),
          materials.water,
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.45;
        water.receiveShadow = true;
        worldGroup.add(water);

        // ambient wide ripple rings drifting across the pond
        const ambientRipples: AnimatedRing[] = [0, 1, 2, 3].map((index) => {
          const material = new THREE.MeshBasicMaterial({
            color: 0xdff7f2,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(
            new THREE.RingGeometry(0.4, 0.44, 48),
            material,
          );
          mesh.rotation.x = -Math.PI / 2;
          const angle = (index / 4) * Math.PI * 2;
          mesh.position.set(Math.cos(angle) * 2.4, -0.448, Math.sin(angle) * 2.4);
          worldGroup.add(mesh);
          return { mesh, material, offset: index / 4, baseY: -0.448 };
        });

        // a few lily pads for texture on the water surface
        [
          [2.1, -2.6],
          [2.6, -2.1],
          [-3.4, 2.4],
          [-2.6, 3.0],
        ].forEach(([x, z], index) => {
          const pad = new THREE.Mesh(
            new THREE.CircleGeometry(0.22 + (index % 2) * 0.06, 12),
            materials.lilyPad,
          );
          pad.rotation.x = -Math.PI / 2;
          pad.position.set(x, -0.435, z);
          worldGroup.add(pad);
        });

        // -----------------------------------------------------------------
        // 5. Land & Forest
        // -----------------------------------------------------------------
        const landGroup = new THREE.Group();
        landGroup.position.set(-4.8, -0.2, -3.2);
        worldGroup.add(landGroup);

        const soilBase = new THREE.Mesh(
          new THREE.CylinderGeometry(3.6, 4.3, 0.6, 28),
          materials.soil,
        );
        soilBase.position.y = -0.3;
        soilBase.receiveShadow = true;
        landGroup.add(soilBase);

        const grassTop = new THREE.Mesh(
          new THREE.CylinderGeometry(3.65, 3.6, 0.25, 28),
          materials.landTerrain,
        );
        grassTop.position.y = 0.05;
        grassTop.receiveShadow = true;
        grassTop.castShadow = true;
        landGroup.add(grassTop);

        // shoreline rocks
        [
          [3.4, -1.2, 0.18],
          [3.7, 0.4, 0.14],
          [3.1, 1.6, 0.2],
          [-1.2, 3.4, 0.16],
        ].forEach(([x, z, scale]) => {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(scale, 0),
            materials.rock,
          );
          rock.position.set(x, 0.05 + scale * 0.4, z);
          rock.rotation.set(Math.random(), Math.random(), Math.random());
          rock.castShadow = true;
          rock.receiveShadow = true;
          landGroup.add(rock);
        });

        // low bushes with tiny flower accents
        const createBush = (x: number, z: number, scale: number, flower?: Material) => {
          const bush = new THREE.Group();
          bush.position.set(x, 0.16, z);
          bush.scale.setScalar(scale);
          [
            [0, 0, 0],
            [0.14, 0.03, 0.08],
            [-0.12, 0.02, -0.1],
          ].forEach(([bx, by, bz]) => {
            const clump = new THREE.Mesh(
              new THREE.SphereGeometry(0.18, 10, 10),
              materials.bushLeaf,
            );
            clump.position.set(bx, by, bz);
            clump.castShadow = true;
            clump.receiveShadow = true;
            bush.add(clump);
          });
          if (flower) {
            for (let i = 0; i < 3; i += 1) {
              const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), flower);
              bloom.position.set(
                (Math.random() - 0.5) * 0.32,
                0.16 + Math.random() * 0.08,
                (Math.random() - 0.5) * 0.32,
              );
              bush.add(bloom);
            }
          }
          landGroup.add(bush);
        };

        createBush(1.9, -1.8, 1, materials.flowerPink);
        createBush(-2.3, 1.6, 0.85, materials.flowerYellow);
        createBush(1.4, 1.9, 0.7);
        createBush(-1.9, -1.4, 0.8, materials.flowerPink);

        const createTree = (x: number, z: number, scale: number, accent = false) => {
          const tree = new THREE.Group();
          tree.position.set(x, 0.15, z);
          tree.scale.setScalar(scale);
          tree.rotation.y = Math.random() * Math.PI * 2;

          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.13, 0.9, 8),
            materials.treeTrunk,
          );
          trunk.position.y = 0.45;
          trunk.castShadow = true;
          tree.add(trunk);

          const mat = accent
            ? materials.foliageAccent
            : scale > 0.9
              ? materials.foliageDark
              : materials.foliageLight;
          [
            { r: 0.65, h: 0.8, y: 0.9 },
            { r: 0.5, h: 0.7, y: 1.35 },
            { r: 0.32, h: 0.55, y: 1.75 },
          ].forEach((layer) => {
            const leaves = new THREE.Mesh(
              new THREE.ConeGeometry(layer.r, layer.h, 8),
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
        createTree(0.6, -1.2, 0.85, true);
        createTree(-1.5, 0.8, 0.95);
        createTree(1.2, 0.4, 0.75, true);
        createTree(0.1, 1.1, 1.05);
        createTree(-2.4, -0.6, 0.65);

        // -----------------------------------------------------------------
        // 6. Floating House
        // -----------------------------------------------------------------
        const houseGroup = new THREE.Group();
        houseGroup.position.set(-0.2, 0, 0.2);
        worldGroup.add(houseGroup);

        // pontoons
        [-1.4, 0, 1.4].forEach((x) => {
          const pontoon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 4.4, 16),
            materials.pontoonPipes,
          );
          pontoon.rotation.x = Math.PI / 2;
          pontoon.position.set(x, -0.32, 0);
          houseGroup.add(pontoon);
        });

        // main wooden deck
        const mainDeck = new THREE.Mesh(
          new THREE.BoxGeometry(4.3, 0.18, 4.6),
          materials.woodDeck,
        );
        mainDeck.position.y = -0.12;
        mainDeck.castShadow = true;
        mainDeck.receiveShadow = true;
        houseGroup.add(mainDeck);

        // deck plank lines (thin dark grooves) for texture
        for (let i = -3; i <= 3; i += 1) {
          const groove = new THREE.Mesh(
            new THREE.BoxGeometry(4.28, 0.005, 0.03),
            materials.kayakTrim,
          );
          groove.position.set(0, -0.028, i * 0.6);
          houseGroup.add(groove);
        }

        // deck railing along the open front edge
        const railingGroup = new THREE.Group();
        houseGroup.add(railingGroup);
        const railTopZ = 2.28;
        const postXs = [-2.0, -1.0, 0.0, 1.0, 2.0];
        postXs.forEach((x) => {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8),
            materials.railing,
          );
          post.position.set(x, 0.15, railTopZ);
          post.castShadow = true;
          railingGroup.add(post);
        });
        const railBar = new THREE.Mesh(
          new THREE.BoxGeometry(4.1, 0.04, 0.04),
          materials.railing,
        );
        railBar.position.set(0, 0.38, railTopZ);
        railingGroup.add(railBar);

        // house body
        const houseBody = new THREE.Mesh(
          new THREE.BoxGeometry(3.0, 2.2, 2.6),
          materials.houseWall,
        );
        houseBody.position.set(-0.3, 1.07, -0.4);
        houseBody.castShadow = true;
        houseBody.receiveShadow = true;
        houseGroup.add(houseBody);

        // trim band at the base of the walls
        const trimBand = new THREE.Mesh(
          new THREE.BoxGeometry(3.06, 0.14, 2.66),
          materials.houseTrim,
        );
        trimBand.position.set(-0.3, 0.02, -0.4);
        houseGroup.add(trimBand);

        /**
         * หลังคาทรงจั่ว — ยืดแกนที่ Group ที่ครอบ ไม่ใช่ที่ตัว mesh
         */
        const roofGroup = new THREE.Group();
        roofGroup.position.set(-0.3, 2.15, -0.4);
        roofGroup.scale.set(1.25, 1, 1.15);
        houseGroup.add(roofGroup);

        const roofGeo = new THREE.ConeGeometry(2.7, 1.35, 4);
        const roof = new THREE.Mesh(roofGeo, materials.metalRoof);
        roof.position.y = 0.68;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roofGroup.add(roof);

        // ridge cap + a small finial for extra detail
        const ridgeCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 1.85, 6),
          materials.roofRidge,
        );
        ridgeCap.position.y = 1.3;
        ridgeCap.rotation.z = Math.PI / 2;
        roofGroup.add(ridgeCap);

        const finial = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 10, 10),
          materials.roofRidge,
        );
        finial.position.y = 1.36;
        roofGroup.add(finial);

        // door with frame + small glass pane
        const doorFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 1.62, 0.04),
          materials.houseTrim,
        );
        doorFrame.position.set(0.5, 0.86, 0.93);
        houseGroup.add(doorFrame);

        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1.5, 0.06),
          materials.woodDeck,
        );
        door.position.set(0.5, 0.85, 0.94);
        houseGroup.add(door);

        const doorPane = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.34, 0.02),
          materials.windowGlass,
        );
        doorPane.position.set(0.5, 1.22, 0.98);
        houseGroup.add(doorPane);

        // windows with frames
        const createWindow = (
          x: number,
          y: number,
          z: number,
          w: number,
          h: number,
          rotY = 0,
        ) => {
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05),
            materials.houseTrim,
          );
          frame.position.set(x, y, z);
          frame.rotation.y = rotY;
          houseGroup.add(frame);

          const windowMesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.05),
            materials.windowGlass,
          );
          windowMesh.position.set(
            x + Math.sin(rotY) * 0.01,
            y,
            z + Math.cos(rotY) * 0.01,
          );
          windowMesh.rotation.y = rotY;
          houseGroup.add(windowMesh);

          const mullionV = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, h, 0.06),
            materials.houseTrim,
          );
          mullionV.position.copy(windowMesh.position);
          mullionV.rotation.y = rotY;
          houseGroup.add(mullionV);

          const mullionH = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.02, 0.06),
            materials.houseTrim,
          );
          mullionH.position.copy(windowMesh.position);
          mullionH.rotation.y = rotY;
          houseGroup.add(mullionH);
        };

        createWindow(-0.6, 1.15, 0.93, 0.7, 0.9);
        createWindow(-1.83, 1.2, -0.4, 0.8, 0.8, -Math.PI / 2);
        createWindow(1.23, 1.2, -0.4, 0.8, 0.8, Math.PI / 2);

        // hanging lantern beside the door, with a warm point light
        const lanternGroup = new THREE.Group();
        lanternGroup.position.set(1.05, 1.55, 0.95);
        const lanternFrame = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8, 1, true),
          materials.lanternFrame,
        );
        lanternGroup.add(lanternFrame);
        const lanternGlow = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 10, 10),
          materials.lanternGlass,
        );
        lanternGroup.add(lanternGlow);
        houseGroup.add(lanternGroup);
        const lanternLight = new THREE.PointLight(0xffb454, 1.4, 3.2, 2);
        lanternLight.position.copy(lanternGroup.position);
        houseGroup.add(lanternLight);

        // a couple of potted plants flanking the door
        const createPot = (x: number, z: number) => {
          const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.09, 0.18, 10),
            materials.potClay,
          );
          pot.position.set(x, -0.03, z);
          pot.castShadow = true;
          houseGroup.add(pot);
          const plant = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.32, 8),
            materials.foliageAccent,
          );
          plant.position.set(x, 0.2, z);
          plant.castShadow = true;
          houseGroup.add(plant);
        };
        createPot(0.02, 1.9);
        createPot(0.98, 1.9);

        // small wooden steps at the deck edge, toward the water
        const steps = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.06, 0.5),
          materials.woodDeck,
        );
        steps.position.set(0.2, -0.24, 2.45);
        steps.castShadow = true;
        houseGroup.add(steps);

        // -----------------------------------------------------------------
        // 7. Kayak Boat with Person
        // -----------------------------------------------------------------
        const kayakGroup = new THREE.Group();
        kayakGroup.position.set(3.2, -0.28, 1.6);
        kayakGroup.rotation.y = -0.42;
        worldGroup.add(kayakGroup);

        const length = 3.2;
        const width = 0.55;
        const height = 0.22;
        const segments = 28;

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

        // a thin dark trim stripe along the hull's waterline
        const kayakStripe = new THREE.Mesh(
          new THREE.TorusGeometry(0.02, 0.008, 6, 40),
          materials.kayakTrim,
        );
        kayakStripe.scale.set(length / 2, 1, width);
        kayakStripe.rotation.x = Math.PI / 2;
        kayakStripe.position.y = -0.02;
        kayakGroup.add(kayakStripe);

        // person paddling
        const personGroup = new THREE.Group();
        personGroup.position.set(0, 0.1, 0);
        kayakGroup.add(personGroup);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 16, 16),
          materials.personSkin,
        );
        head.position.y = 0.55;
        head.castShadow = true;
        personGroup.add(head);

        const hat = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.12, 10),
          materials.personHat,
        );
        hat.position.y = 0.66;
        personGroup.add(hat);

        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.15, 0.4, 12),
          materials.personShirt,
        );
        body.position.y = 0.25;
        body.castShadow = true;
        personGroup.add(body);

        // paddle, pivoted around the person's hands
        const paddlePivot = new THREE.Group();
        paddlePivot.position.set(0, 0.42, 0);
        paddlePivot.rotation.set(0.15, 0.4, 0);
        personGroup.add(paddlePivot);

        const paddle = new THREE.Group();
        paddlePivot.add(paddle);

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, 2.2, 12),
          materials.paddleShaft,
        );
        shaft.rotation.x = Math.PI / 2;
        paddle.add(shaft);

        [-1.05, 1.05].forEach((z) => {
          const bladeGeo = new THREE.SphereGeometry(0.14, 16, 16);
          bladeGeo.scale(0.3, 0.04, 1.0);
          const blade = new THREE.Mesh(bladeGeo, materials.paddleBlade);
          blade.position.set(0, 0, z);
          paddle.add(blade);
        });

        // wake rings trailing the kayak
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
          return { mesh, material, offset: index / 3, baseY: -0.44 };
        });

        // -----------------------------------------------------------------
        // 8. Lights
        // -----------------------------------------------------------------
        const hemisphereLight = new THREE.HemisphereLight(
          0xf3fbf8,
          0x1b382b,
          2.1,
        );
        scene.add(hemisphereLight);

        const sunLight = new THREE.DirectionalLight(0xffedc2, 4.1);
        sunLight.position.set(8, 12, 6);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.bias = -0.0001;
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x5fa7ac, 1.6);
        fillLight.position.set(-8, 4, -6);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
        rimLight.position.set(-4, 3, 9);
        scene.add(rimLight);

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

        const MAX_ROTATION = Math.PI / 8;
        const MIN_ROTATION = -Math.PI / 8;

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

          paddlePivot.rotation.z = Math.sin(seconds * 2.5) * 0.35;

          lanternGlow.material &&
            ((lanternGlow.material as THREE.MeshStandardMaterial).emissiveIntensity =
              1.4 + Math.sin(seconds * 3) * 0.2);

          rings.forEach((ring) => {
            const progress = (seconds * 0.25 + ring.offset) % 1;
            const scale = 0.6 + progress * 2.5;
            ring.mesh.scale.setScalar(scale);
            ring.material.opacity = (1 - progress) * 0.35;
          });

          ambientRipples.forEach((ring) => {
            const progress = (seconds * 0.06 + ring.offset) % 1;
            const scale = 0.5 + progress * 9;
            ring.mesh.scale.setScalar(scale);
            ring.material.opacity = (1 - progress) * 0.18;
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