import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

const Test = () => {
  const mountRef = useRef<HTMLDivElement>(null); // 用于挂载 three.js 的渲染器

  useEffect(() => {
    // 将 mountRef.current 复制到局部变量
    const mount = mountRef.current;
    if (!mount) return;

    // 1. 创建场景、摄像机、渲染器
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement); // 将渲染器的 DOM 元素挂载到组件中

    // 2. 创建立方体
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // 3. 设置摄像机位置
    camera.position.z = 10;

    // 4. 使用 gsap 创建动画
    gsap.to(cube.position, {
      x: 2, // 将立方体移动到 x=2 的位置
      duration: 2, // 动画持续 2 秒
      repeat: -1, // 无限重复
      yoyo: true, // 往返运动
    });

    gsap.to(cube.rotation, {
      y: Math.PI * 2, // 绕 Y 轴旋转 360 度
      duration: 2,
      repeat: -1,
      ease: "power1.inOut", // 使用缓动函数
    });

    // 5. 渲染循环
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // 6. 组件卸载时清理资源
    return () => {
      mount.removeChild(renderer.domElement); // 移除渲染器的 DOM 元素
      renderer.dispose(); // 释放渲染器资源
    };
  }, []);

  return <div ref={mountRef} />; // 用于挂载 three.js 的渲染器
};

export default Test;
