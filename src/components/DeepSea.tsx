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
  const slowBubblesRef = useRef<THREE.Mesh[]>([]); // 新增：存储缓慢上升的球形气泡
  const animationFrameRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const transitionCompleteRef = useRef<boolean>(false);
  const slowBubblesCreatedRef = useRef<boolean>(false); // 新增：标记是否已创建缓慢气泡

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

  /* 
  // 创建深海背景 - 用户已注释掉，因为"深海背景太丑了"
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
  */

  // 创建气泡
  const createBubbles = () => {
    if (!sceneRef.current) return;

    console.log("创建气泡");

    // 气泡数量 - 初始阶段大量气泡溢满屏幕
    const bubbleCount = 300; // 大幅增加气泡数量，使初始效果更加密集

    // 记录开始时间
    startTimeRef.current = performance.now() * 0.001;

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
        // 基础气泡颜色 - 淡蓝色，更接近真实气泡
        vec3 bubbleColor = vec3(0.3, 0.6, 0.9);
        
        // 边缘效果 - 增强边缘效果使气泡更真实
        float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        
        // 减少彩虹效果，使气泡更自然
        vec3 rainbow = 0.5 + 0.5 * cos(time * 0.3 + vUv.xyx * 2.0 + vec3(0, 2, 4));
        
        // 最终颜色 - 减少彩虹混合比例
        vec3 finalColor = mix(bubbleColor, rainbow, 0.1) + fresnel * 0.3;
        
        // 透明度 - 大幅增加透明度，使气泡更像真实气泡
        float alpha = 0.4 - fresnel * 0.2;
        
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

      // 随机速度 - 初始阶段更快
      bubble.userData.initialSpeed = Math.random() * 0.3 + 0.04; // 初始速度更快
      bubble.userData.finalSpeed = Math.random() * 0.16 + 0.04; // 最终速度更慢
      bubble.userData.speed = bubble.userData.initialSpeed; // 当前速度

      bubble.userData.initialWobbleSpeed = Math.random() * 0.02 + 0.01; // 初始摆动速度更快
      bubble.userData.finalWobbleSpeed = Math.random() * 0.02 + 0.01; // 最终摆动速度更慢
      bubble.userData.wobbleSpeed = bubble.userData.initialWobbleSpeed; // 当前摆动速度

      bubble.userData.initialWobbleAmount = Math.random() * 0.2 + 0.1; // 初始摆动幅度更大
      bubble.userData.finalWobbleAmount = Math.random() * 0.2 + 0.1; // 最终摆动幅度更小
      bubble.userData.wobbleAmount = bubble.userData.initialWobbleAmount; // 当前摆动幅度

      // 标记为活跃状态
      bubble.userData.active = true;

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
    // 不再需要计算elapsedTime，因为我们在transitionToDeepSea的onComplete中调用了transitionToSlowBubbles
    // const elapsedTime = time - startTimeRef.current;

    // 检查是否过了3秒，如果是，开始过渡到慢速状态
    // 注释掉这部分，因为我们已经在transitionToDeepSea的onComplete中调用了transitionToSlowBubbles
    // if (elapsedTime >= 3 && !transitionCompleteRef.current) {
    //   transitionToSlowBubbles();
    // }

    // 更新背景着色器的时间
    if (sceneRef.current.userData.backgroundUniforms) {
      sceneRef.current.userData.backgroundUniforms.time.value = time;
    }

    // 更新快速上升的气泡位置和形状
    bubblesRef.current.forEach((bubble) => {
      if (!bubble.userData.active) return; // 跳过非活跃气泡

      // 上升
      bubble.position.y += bubble.userData.speed;

      // 左右摆动
      bubble.position.x +=
        Math.sin(time * bubble.userData.wobbleSpeed) *
        bubble.userData.wobbleAmount *
        0.01;

      // 删掉超出屏幕的泡泡
      if (bubble.position.y > 50) {
        bubble.userData.active = false;
        bubble.visible = false;
      }

      // 更新着色器时间 - 使用存储在userData中的uniforms引用
      if (bubble.userData.uniforms && bubble.userData.uniforms.time) {
        bubble.userData.uniforms.time.value = time;
      }
    });
    
    // 更新缓慢上升的球形气泡
    slowBubblesRef.current.forEach((bubble) => {
      if (!bubble.userData.active || bubble.userData.bursting) return; // 跳过非活跃或正在爆开的气泡
      
      bubble.userData.age += 0.016; // 大约每帧增加16毫秒
      
      // 缓慢上升
      bubble.position.y += bubble.userData.speed;
      
      // 非常轻微的左右摆动 - 更自然的效果
      bubble.position.x +=
        Math.sin(time * bubble.userData.wobbleSpeed) *
        bubble.userData.wobbleAmount *
        0.02; // 比快速气泡更轻微的摆动
      
      // 随机爆开的概率 - 随着年龄增加而增加
      const burstChance = (bubble.userData.age / bubble.userData.lifespan) * 0.01;
      
      // 决定是否爆开气泡
      const shouldBurst = 
        (bubble.position.y > 5) || // 到达顶部
        (Math.random() < burstChance); // 随机爆开
      
      if (shouldBurst && !bubble.userData.bursting) {
        // 标记为正在爆开
        bubble.userData.bursting = true;
        
        // 爆开动画 - 先短暂放大然后迅速缩小并淡出
        const originalScale = bubble.scale.x;
        
        // 轻微放大
        gsap.to(bubble.scale, {
          x: originalScale * 1.1,
          y: originalScale * 1.1,
          z: originalScale * 1.1,
          duration: 0.2,
          ease: "power1.out"
        });
        
        // 同时处理材质的透明度
        if (bubble.material instanceof THREE.Material) {
          gsap.to(bubble.material, {
            opacity: 0,
            duration: 0.2,
            ease: "power1.out",
            onComplete: () => {
              // 创建气泡爆开的碎片效果
              createBubbleFragments(bubble);
              // 重置气泡
              resetSlowBubble(bubble);
            }
          });
        } else {
          // 如果材质不是单个材质，直接重置气泡
          setTimeout(() => {
            resetSlowBubble(bubble);
          }, 200);
        }
      }
      
      // 更新着色器时间
      if (bubble.userData.uniforms && bubble.userData.uniforms.time) {
        bubble.userData.uniforms.time.value = time;
      }
    });
    
    // 重置缓慢气泡的函数
    function resetSlowBubble(bubble: THREE.Mesh) {
      // 重置位置
      bubble.position.y = -2.5;
      bubble.position.x = (Math.random() - 0.5) * 8;
      bubble.position.z = Math.random() * 3 - 1.5;
      
      // 重置大小
      bubble.scale.set(1, 1, 1);
      
      // 重置状态
      bubble.userData.active = true;
      bubble.userData.bursting = false;
      bubble.userData.age = 0;
      
      // 随机新的生命周期和爆开概率
      bubble.userData.lifespan = Math.random() * 20 + 10;
      
      // 随机新的速度和摆动参数
      bubble.userData.speed = Math.random() * 0.005 + 0.002;
      bubble.userData.wobbleSpeed = Math.random() * 0.05 + 0.02;
      bubble.userData.wobbleAmount = Math.random() * 0.1 + 0.05;
      
      // 淡入效果
      if (bubble.material instanceof THREE.Material) {
        bubble.material.opacity = 0;
        gsap.to(bubble.material, {
          opacity: 1,
          duration: 1,
          ease: "power1.in",
          delay: Math.random() * 0.5
        });
      }
    }

    // 渲染场景
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    // 继续动画循环
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // 过渡到慢速气泡状态
  const transitionToSlowBubbles = () => {
    if (transitionCompleteRef.current) return;
    transitionCompleteRef.current = true;

    console.log("过渡到慢速气泡状态");

    // 为每个气泡创建过渡动画
    bubblesRef.current.forEach((bubble) => {
      // 只对屏幕内的气泡应用缩小效果
      // 使用GSAP创建缩小消失的动画
      gsap.to(bubble.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 2,
        ease: "power2.out",
        onComplete: () => {
          bubble.userData.active = false;
          bubble.visible = false;
        },
      });
    });
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

  // 创建缓慢上升的球形气泡
  const createSlowBubbles = () => {
    if (!sceneRef.current || slowBubblesCreatedRef.current) return;
    slowBubblesCreatedRef.current = true;
    
    console.log("创建缓慢上升的球形气泡");
    
    // 气泡数量 - 稀疏分布
    const bubbleCount = 30;
    
    // 气泡顶点着色器 - 更真实的气泡变形
    const bubbleVertexShader = `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      
      // 噪声函数
      float noise(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
      }
      
      // 柏林噪声简化版
      float pnoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f); // 平滑插值
        
        float n = mix(
          mix(
            mix(noise(i), noise(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(noise(i + vec3(0.0, 1.0, 0.0)), noise(i + vec3(1.0, 1.0, 0.0)), f.x),
            f.y
          ),
          mix(
            mix(noise(i + vec3(0.0, 0.0, 1.0)), noise(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(noise(i + vec3(0.0, 1.0, 1.0)), noise(i + vec3(1.0, 1.0, 1.0)), f.x),
            f.y
          ),
          f.z
        );
        
        return n * 2.0 - 1.0;
      }
      
      void main() {
        vUv = uv;
        vNormal = normal;
        vPosition = position;
        
        // 更复杂的变形效果，模拟真实气泡的不规则性
        float noiseScale = 2.0;
        float noiseTime = time * 0.3;
        
        // 使用多层噪声创建更自然的变形
        float noise1 = pnoise(vec3(position.x * noiseScale, position.y * noiseScale, noiseTime)) * 0.02;
        float noise2 = pnoise(vec3(position.z * noiseScale, position.x * noiseScale, noiseTime * 0.7)) * 0.02;
        float noise3 = pnoise(vec3(position.y * noiseScale, position.z * noiseScale, noiseTime * 1.3)) * 0.02;
        
        // 组合噪声
        float combinedNoise = noise1 + noise2 + noise3;
        
        // 应用变形到顶点，保持整体球形但有微小的不规则性
        vec3 newPosition = position + normal * combinedNoise;
        
        // 计算视图空间位置用于片段着色器中的效果
        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
    
    // 气泡片段着色器 - 更真实的气泡光学效果
    const bubbleFragmentShader = `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      
      // 噪声函数
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      void main() {
        // 视线方向
        vec3 viewDir = normalize(vViewPosition);
        
        // 增强的菲涅尔效果 - 使边缘更亮，中心更透明
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 5.0);
        
        // 单一主光源 - 从左上方照射
        vec3 lightDir = normalize(vec3(-0.5, 0.8, 0.3));
        
        // 创建单一的椭圆形光斑
        float specular = 0.0;
        
        // 计算反射向量
        vec3 reflectDir = reflect(-lightDir, normalize(vNormal));
        float reflectDot = dot(reflectDir, viewDir);
        
        // 创建椭圆形光斑 - 使用非对称的指数
        if (reflectDot > 0.0) {
          // 基本高光
          specular = pow(reflectDot, 32.0);
          
          // 使光斑呈椭圆形 - 根据法线和光源方向调整
          vec3 halfVec = normalize(lightDir + viewDir);
          float NdotH = max(dot(normalize(vNormal), halfVec), 0.0);
          
          // 椭圆形状调整
          float elongation = 1.5; // 椭圆拉伸系数
          specular *= pow(NdotH, 8.0) * elongation;
          
          // 确保光斑强度适中
          specular = min(specular * 0.7, 0.7);
        }
        
        // 基础气泡颜色 - 非常淡的蓝色
        vec3 bubbleColor = vec3(0.2, 0.4, 0.7);
        
        // 添加一些随机的色彩变化 - 减少随机性使气泡更均匀
        float colorNoise = noise(vUv * 3.0 + time * 0.05) * 0.02;
        bubbleColor += vec3(colorNoise);
        
        // 非常轻微的彩虹效果 - 模拟光的色散
        vec3 rainbow = 0.5 + 0.5 * cos(time * 0.05 + vUv.xyx + vec3(0, 2, 4));
        
        // 最终颜色 - 结合所有效果
        vec3 finalColor = mix(bubbleColor, rainbow, 0.01); // 减少彩虹效果
        finalColor += vec3(1.0, 1.0, 1.0) * specular; // 添加单一光斑
        finalColor += vec3(0.3, 0.5, 0.9) * fresnel * 0.4; // 添加边缘光
        
        // 透明度 - 中心更透明，边缘更不透明
        float alpha = 0.15 + fresnel * 0.2;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;
    
    // 气泡材质
    const bubbleUniforms = {
      time: { value: 0.0 }
    };
    
    // 使用着色器材质创建动态气泡
    const bubbleMaterial = new THREE.ShaderMaterial({
      uniforms: bubbleUniforms,
      vertexShader: bubbleVertexShader,
      fragmentShader: bubbleFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, // 使用加法混合增强光效
    });
    
    // 创建多个气泡
    for (let i = 0; i < bubbleCount; i++) {
      // 随机大小 - 比之前更小
      const size = Math.random() * 0.01 + 0.03; // 最大值缩小2倍
      
      // 使用球体作为基础形状 - 更高的分段数使其更圆滑
      const geometry = new THREE.SphereGeometry(size, 48, 48);
      
      // 创建气泡网格
      const material = bubbleMaterial.clone();
      const bubble = new THREE.Mesh(geometry, material);
      
      // 确保每个气泡的材质都有自己的uniforms
      if (material instanceof THREE.ShaderMaterial) {
        bubble.userData.uniforms = material.uniforms;
      }
      
      // 随机位置 - 更均匀分布
      bubble.position.x = (Math.random() - 0.5) * 8;
      bubble.position.y = -2.5;
      bubble.position.z = Math.random() * 3 - 1.5;
      
      // 随机速度 - 非常缓慢上升
      bubble.userData.speed = Math.random() * 0.005 + 0.002;
      
      // 随机摆动参数 - 更自然的摆动
      bubble.userData.wobbleSpeed = Math.random() * 0.05 + 0.02; // 非常缓慢的摆动
      bubble.userData.wobbleAmount = Math.random() * 0.1 + 0.05; // 轻微的摆动幅度
      
      // 随机生命周期 - 有些气泡会在上升过程中爆开
      bubble.userData.lifespan = Math.random() * 20 + 10; // 10-30秒的生命周期
      bubble.userData.age = 0; // 当前年龄
      
      // 标记为活跃状态
      bubble.userData.active = true;
      bubble.userData.isSlowBubble = true; // 标记为缓慢气泡
      bubble.userData.bursting = false; // 标记是否正在爆开
      
      // 添加到场景
      sceneRef.current.add(bubble);
      slowBubblesRef.current.push(bubble);
      
      // 创建时间
      bubble.userData.creationTime = performance.now() * 0.001;
      
      // 初始时完全透明，然后淡入
      bubble.material.opacity = 1;
      // gsap.to(bubble.material, {
      //   opacity: 1,
      //   duration: 2,
      //   ease: "power1.inOut",
      //   delay: Math.random() * 2
      // });
    }
  };

  // 创建气泡爆开的碎片效果
  const createBubbleFragments = (bubble: THREE.Mesh) => {
    if (!sceneRef.current) return;
    
    // 碎片数量
    const fragmentCount = 3 + Math.floor(Math.random() * 3); // 3-5个碎片
    
    // 获取气泡的位置和大小
    const position = bubble.position.clone();
    const bubbleSize = (bubble.geometry as THREE.SphereGeometry).parameters.radius;
    
    // 获取气泡的材质属性
    const bubbleColor = new THREE.Color(0x80c0ff);
    // 可以从原气泡材质中获取更多属性，但目前不需要
    
    // 创建碎片
    for (let i = 0; i < fragmentCount; i++) {
      // 随机大小 - 比原气泡小很多
      const fragmentSize = bubbleSize * (0.15 + Math.random() * 0.2);
      
      // 创建碎片几何体 - 使用小球体而不是平面，更像小水滴
      const geometry = new THREE.SphereGeometry(fragmentSize, 8, 8);
      
      // 创建碎片材质 - 使用与气泡相似的材质
      const material = new THREE.MeshPhongMaterial({
        color: bubbleColor,
        transparent: true,
        opacity: 0.7,
        shininess: 100,
        specular: 0xffffff,
        side: THREE.DoubleSide
      });
      
      // 创建碎片网格
      const fragment = new THREE.Mesh(geometry, material);
      
      // 设置初始位置 - 与气泡位置相同，但有微小偏移
      fragment.position.copy(position).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05
        )
      );
      
      // 添加到场景
      sceneRef.current.add(fragment);
      
      // 随机方向 - 向外扩散
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5 + 0.5, // 偏向上方
        (Math.random() - 0.5) * 2
      ).normalize();
      
      // 动画 - 向外扩散并淡出
      const distance = 0.1 + Math.random() * 0.1; // 随机扩散距离
      
      gsap.to(fragment.position, {
        x: position.x + direction.x * distance,
        y: position.y + direction.y * distance,
        z: position.z + direction.z * distance,
        duration: 0.2 + Math.random() * 0.1, // 随机持续时间
        ease: "power1.out"
      });
      
      // 同时缩小并淡出
      gsap.to(fragment.scale, {
        x: 0.1,
        y: 0.1,
        z: 0.1,
        duration: 0.2 + Math.random() * 0.1,
        ease: "power1.in"
      });
      
      gsap.to(material, {
        opacity: 0,
        duration: 0.2 + Math.random() * 0.1,
        ease: "power1.in",
        onComplete: () => {
          // 动画完成后从场景中移除
          if (sceneRef.current) {
            sceneRef.current.remove(fragment);
          }
          // 释放资源
          geometry.dispose();
          material.dispose();
        }
      });
    }
  };
  
  // 从黑色背景过渡到深海背景
  const transitionToDeepSea = () => {
    if (!sceneRef.current) return;

    // 使用GSAP创建平滑过渡 - 缩短到1秒
    gsap.to(sceneRef.current.background, {
      duration: 2, // 从3秒改为1秒
      r: 0.0,
      g: 0.02,
      b: 0.05,
      ease: "power2.inOut",
      onComplete: () => {
        console.log("Transition to deep sea complete");
        // 在背景过渡完成后创建缓慢上升的球形气泡
        createSlowBubbles();
      },
    });

    // 首屏气泡渐隐
    setTimeout(() => {
      if (!transitionCompleteRef.current) {
        transitionToSlowBubbles();
      }
    }, 1100);
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
