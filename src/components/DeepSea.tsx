"use strict";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

const DeepSea = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bubblesRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const transitionCompleteRef = useRef<boolean>(false);

  // 初始化Three.js场景
  const initThree = () => {
    if (!containerRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // 全黑背景
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    // 创建渲染器 - 启用透明度支持
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // 创建深海背景
    // createDeepSeaBackground();

    // 创建气泡
    createBubbles();

    // 处理窗口大小变化
    window.addEventListener("resize", handleResize);

    // 从黑色背景过渡到深海背景
    transitionToDeepSea();

    // 开始动画
    startAnimation();
  };

  // 创建深海背景
  const createDeepSeaBackground = () => {
    if (!sceneRef.current) return;

    // 创建深海背景 - 使用渐变着色器材质
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      varying vec2 vUv;
      
      // 噪声函数
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      
      void main() {
        // 深海渐变色 - 从深黑到深蓝
        vec3 deepBlack = vec3(0.0, 0.0, 0.02);
        vec3 deepBlue = vec3(0.0, 0.05, 0.1);
        
        // 使用噪声创建流动效果
        float noise = snoise(vUv * 3.0 + time * 0.1) * 0.1;
        
        // 从底部到顶部的渐变
        float gradient = vUv.y + noise;
        
        // 混合颜色
        vec3 color = mix(deepBlack, deepBlue, gradient);
        
        // 添加一些随机的"暗流"效果
        float flowNoise = snoise(vUv * 5.0 + time * 0.2) * 0.05;
        color += flowNoise;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // 创建着色器材质
    const uniforms = {
      time: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
    });

    // 创建一个覆盖整个视图的平面
    const geometry = new THREE.PlaneGeometry(20, 20);
    const background = new THREE.Mesh(geometry, material);
    background.position.z = -10;
    sceneRef.current.add(background);

    // 存储背景引用以便在动画循环中更新
    sceneRef.current.userData.background = background;
    sceneRef.current.userData.backgroundUniforms = uniforms;
  };

  // 创建气泡
  const createBubbles = () => {
    if (!sceneRef.current) return;

    console.log("创建气泡");

    // 气泡数量
    const bubbleCount = 50;

    // 不再需要简单材质，直接使用着色器材质

    // 气泡顶点着色器
    const bubbleVertexShader = `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      // 噪声函数 (简化版)
      float noise(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
      }
      
      void main() {
        vUv = uv;
        vNormal = normal;
        
        // 添加基于时间和位置的扭曲
        float distortion = sin(position.y * 10.0 + time) * 0.1;
        distortion += cos(position.x * 8.0 + time * 0.5) * 0.1;
        
        // 应用扭曲到顶点
        vec3 newPosition = position + normal * distortion;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;

    // 气泡片段着色器
    const bubbleFragmentShader = `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        // 基础气泡颜色 - 明亮的蓝色
        vec3 bubbleColor = vec3(0.5, 0.8, 1.0);
        
        // 边缘效果
        float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        
        // 彩虹效果
        vec3 rainbow = 0.5 + 0.5 * cos(time * 0.5 + vUv.xyx * 3.0 + vec3(0, 2, 4));
        
        // 最终颜色
        vec3 finalColor = mix(bubbleColor, rainbow, 0.3) + fresnel * 0.5;
        
        // 透明度 - 增加不透明度
        float alpha = 0.9 - fresnel * 0.2;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // 气泡材质
    const bubbleUniforms = {
      time: { value: 0.0 },
    };

    // 使用着色器材质创建动态气泡
    const bubbleMaterial = new THREE.ShaderMaterial({
      uniforms: bubbleUniforms,
      vertexShader: bubbleVertexShader,
      fragmentShader: bubbleFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // 创建多个气泡
    for (let i = 0; i < bubbleCount; i++) {
      // 随机大小
      const size = Math.random() * 0.5 + 0.1;

      // 使用球体作为基础形状
      const geometry = new THREE.SphereGeometry(size, 32, 32);

      // 创建气泡网格 - 使用着色器材质
      // 为每个气泡克隆材质，确保每个气泡有自己的uniforms
      const material = bubbleMaterial.clone();
      const bubble = new THREE.Mesh(geometry, material);

      // 确保每个气泡的材质都有自己的uniforms
      if (material instanceof THREE.ShaderMaterial) {
        bubble.userData.uniforms = material.uniforms;
      }

      // 随机位置 - 从屏幕底部开始
      bubble.position.x = (Math.random() - 0.5) * 10;
      bubble.position.y = -5 - Math.random() * 10; // 屏幕底部以下
      bubble.position.z = Math.random() * 5 - 2.5;

      // 随机速度
      bubble.userData.speed = Math.random() * 0.03 + 0.01;
      bubble.userData.wobbleSpeed = Math.random() * 0.02 + 0.01;
      bubble.userData.wobbleAmount = Math.random() * 0.2 + 0.1;

      // 添加到场景
      sceneRef.current.add(bubble);
      bubblesRef.current.push(bubble);

      // MeshPhysicalMaterial没有uniforms属性，所以不需要存储
      // 只需记录创建时间用于动画
      bubble.userData.creationTime = performance.now() * 0.001;
    }
  };

  // 动画循环
  const animate = () => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    const time = performance.now() * 0.001;

    // 更新背景着色器的时间
    if (sceneRef.current.userData.backgroundUniforms) {
      sceneRef.current.userData.backgroundUniforms.time.value = time;
    }

    // 更新气泡位置和形状
    bubblesRef.current.forEach((bubble) => {
      // 上升
      bubble.position.y += bubble.userData.speed;

      // 左右摆动
      bubble.position.x +=
        Math.sin(time * bubble.userData.wobbleSpeed) *
        bubble.userData.wobbleAmount *
        0.01;

      // 如果气泡超出屏幕顶部，重置到底部
      if (bubble.position.y > 5) {
        bubble.position.y = -5 - Math.random() * 5;
        bubble.position.x = (Math.random() - 0.5) * 10;
      }

      // 更新着色器时间 - 使用存储在userData中的uniforms引用
      if (bubble.userData.uniforms && bubble.userData.uniforms.time) {
        bubble.userData.uniforms.time.value = time;
      }
    });

    // 渲染场景
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    // 继续动画循环
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // 开始动画
  const startAnimation = () => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // 处理窗口大小变化
  const handleResize = () => {
    if (!cameraRef.current || !rendererRef.current) return;

    // 更新相机
    cameraRef.current.aspect = window.innerWidth / window.innerHeight;
    cameraRef.current.updateProjectionMatrix();

    // 更新渲染器
    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
  };

  // 从黑色背景过渡到深海背景
  const transitionToDeepSea = () => {
    if (!sceneRef.current) return;

    // 使用GSAP创建平滑过渡
    gsap.to(sceneRef.current.background, {
      duration: 3,
      r: 0.0,
      g: 0.02,
      b: 0.05,
      ease: "power2.inOut",
      onComplete: () => {
        console.log("Transition to deep sea complete");
      },
    });
  };

  // 组件挂载时初始化
  useEffect(() => {
    const container = containerRef.current;
    const animationFrame = animationFrameRef.current;
    initThree();

    // 组件卸载时清理
    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      if (rendererRef.current && container) {
        container.removeChild(rendererRef.current.domElement);
      }
      isInitializedRef.current = false;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
    />
  );
};

export default DeepSea;
