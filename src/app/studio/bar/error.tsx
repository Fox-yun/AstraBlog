"use client";
export default function Error({ reset }: { reset: () => void }) {
  return <div className="bar-stack"><h1>暂时无法读取酒谱管理</h1><p>请确认使用 Owner 账号登录，且酒单数据库迁移已完成。</p><button onClick={reset}>重试</button></div>;
}
