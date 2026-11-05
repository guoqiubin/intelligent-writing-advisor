import React from "react";
import { APP_VERSION } from "../workflow";

const steps = [
  {
    number: "01",
    title: "准备三份素材",
    summary: "上传 MP3、标记口播稿 DOCX 和 PDF/PPTX 课件。三份素材都在本地处理。",
    visual: <div className="sync-tutorial-upload-visual"><div className="sync-tutorial-file ready"><b>✓</b><span><strong>MiniMax MP3</strong><small>已上传音频.mp3</small></span></div><div className="sync-tutorial-file ready"><b>✓</b><span><strong>标记口播稿 DOCX</strong><small>已识别分页标记</small></span></div><div className="sync-tutorial-file ready"><b>✓</b><span><strong>上传课件 PDF / PPTX</strong><small>自动转换为高清页面</small></span></div></div>
  },
  {
    number: "02",
    title: "在文稿中标记翻页",
    summary: "在每一页开始的位置写入 [第 1 张 PPT]、[第 2 张 PPT]，系统据此安排翻页。",
    visual: <div className="sync-tutorial-script-visual"><span className="sync-tutorial-code">[第 1 张 PPT]</span><p>今天我们先建立一个共同的问题框架</p><span className="sync-tutorial-code">[第 2 张 PPT]</span><p>接下来进入第二个核心观点</p></div>
  },
  {
    number: "03",
    title: "先预览，再生成",
    summary: "点击“开始预览”，播放音频时页面会按时间线切换；下方可以查看翻页节点。",
    visual: <div className="sync-tutorial-preview-visual"><div className="sync-tutorial-mini-slide"><small>SYNC STUDIO / PAGE 01</small><strong>让声音和画面<br />自然对齐</strong><em>PAGE 1</em></div><div className="sync-tutorial-mini-timeline"><span>00:00</span><i /><span>第 1 页</span></div></div>
  },
  {
    number: "04",
    title: "选择本轮是否嵌入字幕",
    summary: "勾选“本轮生成字幕”，字幕会直接嵌入 MP4；不勾选则输出没有字幕的 MP4，不生成 SRT 文件。",
    visual: <div className="sync-tutorial-choice-visual"><span className="sync-tutorial-check">✓</span><strong>本轮生成字幕</strong><small>只控制 MP4 画面内是否出现字幕</small></div>
  },
  {
    number: "05",
    title: "通过检查后生成 MP4",
    summary: "点击“生成 MP4”后，系统会先检查素材，再显示当前处理阶段、进度、视频时长和渲染耗时。完成后可下载，并在“渲染历史”查看记录。",
    visual: <div className="sync-tutorial-progress-visual"><div><span>正在生成高清 MP4</span><strong>68%</strong></div><i><b /></i><small>逐帧渲染视频 · 已编码 12,480 帧</small></div>
  }
];

export function SyncStudioTutorial() {
  return <section className="sync-tutorial-page">
    <header className="sync-tutorial-heading">
      <div><p className="sync-eyebrow">SYNC STUDIO / QUICK START</p><h2>声画同步新手教程</h2><p>从三份素材开始，把口播、页面和字幕合成为一条高清 MP4。</p></div>
      <span className="sync-tutorial-version">适用于 {APP_VERSION}</span>
    </header>
    <div className="sync-tutorial-notice"><strong>本教程会随产品版本更新</strong><span>如果按钮、流程或页面发生变化，会在这里同步更新对应步骤和示意图。</span></div>
    <div className="sync-tutorial-steps">{steps.map((step) => <article className="sync-tutorial-step" key={step.number}><div className="sync-tutorial-step-copy"><span className="sync-tutorial-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.summary}</p></div></div><div className="sync-tutorial-visual">{step.visual}</div></article>)}</div>
    <section className="sync-tutorial-tips"><p className="sync-eyebrow">CHECK BEFORE EXPORT</p><h3>生成前记住三件事</h3><div><span>✓ 文稿分页标记和 PDF 页码连续对应</span><span>✓ 先预览确认声音与页面切换</span><span>✓ 关闭网页后仍可在“渲染历史”查看完成记录</span></div></section>
  </section>;
}
