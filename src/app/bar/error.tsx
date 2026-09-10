"use client";
export default function Error({ reset }: { reset: () => void }) {
  return <div className="space-y-5"><h1>暂时无法加载酒单</h1><p>请稍后再试，你的浏览器偏好不会被清空。</p><button onClick={reset}>重试</button></div>;
}
