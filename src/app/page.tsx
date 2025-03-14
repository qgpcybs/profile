"use client";

import dynamic from "next/dynamic";

// 动态导入DeepSea组件，禁用SSR
const Test = dynamic(() => import("../components/Test"), { ssr: false });
const DeepSea = dynamic(() => import("../components/DeepSea"), { ssr: false });

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-foreground">
      {/* DeepSea组件将作为背景 */}
      <DeepSea />
      {/* <Test /> */}

      {/* 页面内容将在后续添加 */}
      <main className="z-10 flex flex-col items-center justify-center">
        {/* 这里将在后续添加内容 */}
      </main>
    </div>
  );
}
