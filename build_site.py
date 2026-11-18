#!/usr/bin/env python3
"""Build the JYY OS 2026 static reader from the source ebook HTML.

Source: https://github.com/Pam1aos/JYY_OS_2026_ebook
The source book.html files are treated strictly as content; every page is
rebuilt with the Soft UI Evolution design system in ./site.
"""

from __future__ import annotations

import html
import hashlib
import json
import math
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source"
if not SRC.exists():
    # In the published repository the lecture folders live at the repo root.
    SRC = ROOT
SITE = ROOT / "site"
ASSET_VERSION = "dev"

PARTS = [
    {
        "key": "foundation",
        "num": "01",
        "title": "视角与基础",
        "desc": "先建立操作系统与这个时代的坐标系。",
    },
    {
        "key": "process",
        "num": "02",
        "title": "进程与系统调用",
        "desc": "程序如何被创建、寻址、连接与组织。",
    },
    {
        "key": "systems",
        "num": "03",
        "title": "标准库、链接与应用",
        "desc": "从 API 到可执行世界，一层层把应用搭起来。",
    },
    {
        "key": "concurrency",
        "num": "04",
        "title": "并发",
        "desc": "当多个执行流同时发生，正确性从何而来。",
    },
    {
        "key": "hetero",
        "num": "05",
        "title": "异步与异构",
        "desc": "从协程到 GPU，用不同抽象描述计算图。",
    },
    {
        "key": "storage",
        "num": "06",
        "title": "I/O、存储与文件系统",
        "desc": "数据如何穿过设备、内核与磁盘，跨越时间。",
    },
    {
        "key": "future",
        "num": "07",
        "title": "数据、安全与未来",
        "desc": "从数据库到系统边界，再回到人与 AI 的关系。",
    },
]

CHAPTERS = [
    {
        "num": "01",
        "part": "foundation",
        "title": "Agentic AI 时代的操作系统课",
        "hero": "Agentic AI 时代的<br>操作系统课",
        "deck": "从 Agentic AI 的时代背景出发，重新回答一个看似基础的问题：为什么今天还要学习操作系统。",
        "tag": "导论",
        "tone": "white",
    },
    {
        "num": "02",
        "part": "foundation",
        "title": "应用视角的操作系统",
        "hero": "应用视角的<br>操作系统",
        "deck": "从应用程序出发，理解程序、系统调用与真实应用之间的接口。",
        "tag": "系统调用",
        "tone": "mint",
    },
    {
        "num": "03",
        "part": "foundation",
        "title": "硬件视角的操作系统",
        "hero": "硬件视角的<br>操作系统",
        "deck": "从 CPU Reset 到固件启动，看硬件如何把控制权交给操作系统。",
        "tag": "硬件",
        "tone": "sky",
    },
    {
        "num": "04",
        "part": "foundation",
        "title": "LLM、Agents 与 Scaling Law",
        "hero": "LLM、Agents<br>与 Scaling Law",
        "deck": "从语言模型、Agent 到最小操作系统，理解 Scaling Law 如何改变软件。",
        "tag": "Agentic AI",
        "tone": "lilac",
    },
    {
        "num": "05",
        "part": "process",
        "title": "程序和进程",
        "hero": "程序和进程",
        "deck": "fork、execve 与 exit：一个进程如何诞生、变身和结束。",
        "tag": "进程",
        "tone": "white",
    },
    {
        "num": "06",
        "part": "process",
        "title": "进程的地址空间",
        "hero": "进程的<br>地址空间",
        "deck": "mmap、munmap 与 mprotect：进程地址空间如何被塑造、共享与保护。",
        "tag": "内存",
        "tone": "peach",
    },
    {
        "num": "07",
        "part": "process",
        "title": "访问操作系统对象",
        "hero": "访问操作系统<br>对象",
        "deck": "文件描述符与管道：操作系统对象如何被命名、共享与组合。",
        "tag": "I/O",
        "tone": "sky",
    },
    {
        "num": "08",
        "part": "process",
        "title": "终端和 UNIX Shell",
        "hero": "终端和<br>UNIX Shell",
        "deck": "从打字机到 Job Control，终端和 Shell 如何组织我们的命令世界。",
        "tag": "Shell",
        "tone": "mint",
    },
    {
        "num": "09",
        "part": "systems",
        "title": "C 标准库原理",
        "hero": "C 标准库<br>原理",
        "deck": "在系统调用之上，C 标准库如何搭起第一层应用世界。",
        "tag": "标准库",
        "tone": "white",
    },
    {
        "num": "10",
        "part": "systems",
        "title": "调试 C 标准库",
        "hero": "调试 C<br>标准库",
        "deck": "从 DWARF 到 vDSO 与 malloc，亲手调试 C 标准库。",
        "tag": "调试",
        "tone": "lilac",
    },
    {
        "num": "11",
        "part": "systems",
        "title": "链接和加载",
        "hero": "链接<br>和加载",
        "deck": "从 ELF 到动态链接，理解程序如何被链接、加载与运行。",
        "tag": "链接",
        "tone": "peach",
    },
    {
        "num": "12",
        "part": "systems",
        "title": "从零开始构建 Linux 应用世界",
        "hero": "从零开始构建<br>Linux 应用世界",
        "deck": "从 initramfs 到应用生态，从零构建一个 Linux 应用世界。",
        "tag": "应用世界",
        "tone": "sky",
    },
    {
        "num": "13",
        "part": "concurrency",
        "title": "多处理器编程",
        "hero": "多处理器编程",
        "deck": "从入门到放弃，理解并发为何困难，以及它为什么值得。",
        "tag": "并发",
        "tone": "white",
    },
    {
        "num": "14",
        "part": "concurrency",
        "title": "并发控制：互斥",
        "hero": "并发控制<br>互斥",
        "deck": "并发控制的第一课：一把锁背后的硬件、抽象与取舍。",
        "tag": "互斥",
        "tone": "mint",
    },
    {
        "num": "15",
        "part": "concurrency",
        "title": "并发控制：条件变量",
        "hero": "并发控制<br>条件变量",
        "deck": "条件变量与万能同步方法：让等待与唤醒变得可控。",
        "tag": "同步",
        "tone": "lilac",
    },
    {
        "num": "16",
        "part": "concurrency",
        "title": "并发控制：信号量",
        "hero": "并发控制<br>信号量",
        "deck": "信号量：用计数器组织并发世界里的合作与互斥。",
        "tag": "同步",
        "tone": "peach",
    },
    {
        "num": "17",
        "part": "concurrency",
        "title": "并发 Bugs 和应对",
        "hero": "并发 Bugs<br>和应对",
        "deck": "从死锁到原子性与顺序违反，系统梳理并发 Bugs 与应对方法。",
        "tag": "并发",
        "tone": "sky",
    },
    {
        "num": "18",
        "part": "concurrency",
        "title": "并行算法和数据结构",
        "hero": "并行算法<br>和数据结构",
        "deck": "从正确性走向可扩展性：并行算法与数据结构的核心问题。",
        "tag": "并行",
        "tone": "white",
    },
    {
        "num": "19",
        "part": "hetero",
        "title": "协程与异步编程",
        "hero": "协程与<br>异步编程",
        "deck": "协程、Goroutine 与异步编程：用不同抽象描述同一张计算图。",
        "tag": "异步",
        "tone": "mint",
    },
    {
        "num": "20",
        "part": "hetero",
        "title": "CPU、GPU 和 SIMT",
        "hero": "CPU、GPU<br>和 SIMT",
        "deck": "从指令级并行到海量线程，理解 CPU、GPU 与 SIMT 编程模型。",
        "tag": "异构计算",
        "tone": "lilac",
    },
    {
        "num": "21",
        "part": "hetero",
        "title": "一个 Token 的旅程",
        "hero": "一个 Token<br>的旅程",
        "deck": "从 HTTP 请求到数据中心与 GPU，追踪一个 Token 的完整旅程。",
        "tag": "LLM 系统",
        "tone": "peach",
    },
    {
        "num": "22",
        "part": "storage",
        "title": "输入输出设备和驱动",
        "hero": "输入输出设备<br>和驱动",
        "deck": "从一根 GPIO 线到 file_operations，理解设备与驱动如何接入系统。",
        "tag": "驱动",
        "tone": "sky",
    },
    {
        "num": "23",
        "part": "storage",
        "title": "存储设备原理",
        "hero": "存储设备<br>原理",
        "deck": "一个 bit 如何跨越时间：存储设备的原理、层次与取舍。",
        "tag": "存储",
        "tone": "white",
    },
    {
        "num": "24",
        "part": "storage",
        "title": "文件系统 API (1)",
        "hero": "文件系统 API<br>(1)",
        "deck": "目录树、链接与元数据：文件系统 API 的第一课。",
        "tag": "文件系统",
        "tone": "mint",
    },
    {
        "num": "25",
        "part": "storage",
        "title": "文件系统 API (2)",
        "hero": "文件系统 API<br>(2)",
        "deck": "监控、快照、覆盖与任意数据结构：文件系统 API 的第二课。",
        "tag": "文件系统",
        "tone": "lilac",
    },
    {
        "num": "26",
        "part": "storage",
        "title": "文件系统实现与崩溃一致性",
        "hero": "文件系统实现<br>与崩溃一致性",
        "deck": "从块设备到日志，理解文件系统实现与崩溃一致性的关键机制。",
        "tag": "文件系统",
        "tone": "peach",
    },
    {
        "num": "27",
        "part": "future",
        "title": "数据库系统",
        "hero": "数据库系统",
        "deck": "从文件持久化到 ACID 与向量检索，数据库如何在文件系统之上构建。",
        "tag": "数据库",
        "tone": "sky",
    },
    {
        "num": "28",
        "part": "future",
        "title": "计算机系统安全",
        "hero": "计算机<br>系统安全",
        "deck": "隔离、访问控制与攻击面：计算机系统安全的基本问题。",
        "tag": "安全",
        "tone": "white",
    },
    {
        "num": "29",
        "part": "future",
        "title": "虚拟机和容器",
        "hero": "虚拟机<br>和容器",
        "deck": "从全系统模拟、JIT 到 Namespaces、cgroups 与 Kubernetes，理解虚拟化的三条路线。",
        "tag": "虚拟化",
        "tone": "lilac",
    },
    {
        "num": "30",
        "part": "future",
        "title": "Agentic AI 和我们的未来",
        "hero": "Agentic AI<br>和我们的未来",
        "deck": "Agentic AI 和我们的未来：一学期操作系统课的总结与回望。",
        "tag": "课程总结",
        "tone": "mint",
    },
]

FILTERS = [
    ("all", "全部"),
    ("foundation", "基础"),
    ("process", "进程"),
    ("systems", "系统库"),
    ("concurrency", "并发"),
    ("hetero", "异构"),
    ("storage", "存储"),
    ("future", "安全"),
]

TONE_ORDER = ["white", "mint", "sky", "lilac", "peach"]


def strip_tags(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " ", value)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(re.sub(r"\s+", " ", value)).strip()


def excerpt(value: str, limit: int = 76) -> str:
    value = strip_tags(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip("，。；、 ") + "…"


def source_article(chapter: dict) -> tuple[str, str]:
    folder = next(
        p
        for p in SRC.iterdir()
        if p.is_dir() and p.name.startswith(chapter["num"] + "-")
    )
    html_path = folder / "book.html"
    raw = html_path.read_text(encoding="utf-8")
    match = re.search(r'<article class="book-content">(.*?)</article>', raw, re.S)
    if not match:
        raise RuntimeError(f"article not found in {html_path}")
    body = match.group(1)

    info_match = re.search(r"<blockquote>(.*?)</blockquote>", body, re.S)
    info_html = info_match.group(1) if info_match else ""
    body = re.sub(r"<h1[^>]*>.*?</h1>", "", body, count=1, flags=re.S)
    body = re.sub(r"<blockquote>.*?</blockquote>", "", body, count=1, flags=re.S)
    body = re.sub(r"^\s*<hr\s*/?>", "", body, count=1, flags=re.S)

    # 参考时间 -> a compact timestamp chip
    body = re.sub(
        r"<p>\s*<em>[\(（]参考时间[:：]\s*([^)）]+)[\)）]</em>\s*</p>",
        r'<p class="timestamp"><span class="ts-label">参考时间</span><span>\1</span></p>',
        body,
    )

    # PNG/JPG screenshots were optimized to WebP during the build.
    def image_repl(match_: re.Match[str]) -> str:
        attrs_before, src, attrs_after = match_.groups()
        src = re.sub(r"\.(?:png|jpe?g)$", ".webp", src, flags=re.I)
        attrs = attrs_before + attrs_after
        if "loading=" not in attrs:
            attrs += ' loading="lazy"'
        if "decoding=" not in attrs:
            attrs += ' decoding="async"'
        return f'<img{attrs_before}src="images/{src}"{attrs_after}{attrs.split("src=", 1)[0] if False else ""}>'

    # Keep the rewrite simple and predictable.
    body = re.sub(
        r'<img([^>]*?)src="images/([^"]+)\.(?:png|jpe?g)"([^>]*)>',
        lambda m: (
            f'<img{m.group(1)}src="images/{re.sub(r"\.(png|jpe?g)$", "", m.group(2), flags=re.I)}.webp"'
            f'{m.group(3)}{"" if "loading=" in m.group(3) else " loading=\"lazy\""}'
            f'{"" if "decoding=" in m.group(3) else " decoding=\"async\""}>'
        ),
        body,
        flags=re.I,
    )

    # External links open in a new tab, except explicit in-page links.
    body = re.sub(
        r'<a href="(https?://[^"]+)"(?![^>]*\btarget=)',
        r'<a href="\1" target="_blank" rel="noopener"',
        body,
        flags=re.I,
    )

    # Make sure every heading has a stable id for the table of contents.
    def add_id(match_: re.Match[str]) -> str:
        level, attrs, text = match_.groups()
        if "id=" in attrs:
            return match_.group(0)
        slug = f"section-{abs(hash(text)) % 100000}"
        return f'<h{level}{attrs} id="{slug}">{text}</h{level}>'

    body = re.sub(r"<h([23])([^>]*)>(.*?)</h\1>", add_id, body, flags=re.S)
    return body, info_html


def chapter_data() -> list[dict]:
    chapters = []
    for item in CHAPTERS:
        chapter = dict(item)
        folder = next(
            p
            for p in SRC.iterdir()
            if p.is_dir() and p.name.startswith(item["num"] + "-")
        )
        body, info = source_article(chapter)
        info_video = re.search(
            r"https://www\.bilibili\.com/video/(BV[0-9A-Za-z]+)", info
        )
        info_handout = re.search(
            r"https://jyywiki\.cn/OS/2026/lect\d+\.md", info
        )
        chapter["body"] = body
        chapter["info"] = info
        chapter["images"] = len(re.findall(r"<img\b", body))
        chapter["chars"] = len(strip_tags(body))
        chapter["minutes"] = max(8, math.ceil(chapter["chars"] / 420))
        chapter["video"] = (
            info_video.group(0)
            if info_video
            else "https://www.bilibili.com/"
        )
        chapter["handout"] = (
            info_handout.group(0)
            if info_handout
            else f"https://jyywiki.cn/OS/2026/lect{int(item['num'])}.md"
        )
        chapter["toc"] = [
            {
                "id": m.group(1),
                "text": strip_tags(m.group(2)),
            }
            for m in re.finditer(
                r'<h2 id="([^"]+)"[^>]*>(.*?)</h2>', body, re.S
            )
        ]
        chapter["source_dir"] = folder.name
        chapters.append(chapter)
    return chapters


def part_for(key: str) -> dict:
    return next(part for part in PARTS if part["key"] == key)


def icon(name: str, cls: str = "") -> str:
    icons = {
        "arrow": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 12.5 12.5 3.5M6 3.5h6.5V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "book": '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h6M8 11.5h4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        "play": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3.6v8.8L12 8 5 3.6Z" fill="currentColor"/></svg>',
        "doc": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 1.75h5.6L13 5.15V14.3H4V1.75Z" stroke="currentColor" stroke-width="1.3"/><path d="M9.4 1.9v3.5H13M6 8h5M6 10.6h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
        "grid": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.2" y="2.2" width="4.4" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="9.4" y="2.2" width="4.4" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="2.2" y="9.4" width="4.4" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="9.4" y="9.4" width="4.4" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.3"/></svg>',
        "menu": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
        "panel": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.2" y="2.6" width="11.6" height="10.8" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M6.3 2.9v10.2" stroke="currentColor" stroke-width="1.3"/></svg>',
        "list": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5.6 4.1h8.2M5.6 8h8.2M5.6 11.9h8.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.7 4.1h.1M2.7 8h.1M2.7 11.9h.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
        "check": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.2 8.3 3.1 3.1 6.5-6.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "search": '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.2" stroke="currentColor" stroke-width="1.4"/><path d="m12 12 3.2 3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
        "spark": '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.6c.55 3.3 2.1 4.85 5.4 5.4-3.3.55-4.85 2.1-5.4 5.4-.55-3.3-2.1-4.85-5.4-5.4 3.3-.55 4.85-2.1 5.4-5.4Z" fill="currentColor"/><path d="M15.8 13.1c.25 1.5.95 2.2 2.45 2.45-1.5.25-2.2.95-2.45 2.45-.25-1.5-.95-2.2-2.45-2.45 1.5-.25 2.2-.95 2.45-2.45Z" fill="currentColor"/></svg>',
        "send": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m2.2 7.6 11.1-4.4-4.4 11.1-2-4.7-4.7-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m6.9 9.2 3.1-3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
        "layers": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m8 2 6 3-6 3-6-3 6-3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="m2 8 6 3 6-3M2 11l6 3 6-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "close": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
        "bookmark": '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.7h8v10.6L8 10.8l-4 2.5V2.7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    }
    return icons[name].replace("<svg ", f'<svg class="{cls}" ', 1) if cls else icons[name]


def head(
    title: str,
    description: str,
    css_prefix: str = "assets/",
    rag: bool = False,
) -> str:
    rag_css = (
        f'<link rel="stylesheet" href="/assets/css/rag.css?v={ASSET_VERSION}">'
        if rag
        else ""
    )
    rag_js = (
        f'<script defer src="/assets/js/rag.js?v={ASSET_VERSION}"></script>'
        if rag
        else f'<script defer src="/assets/js/chat.js?v={ASSET_VERSION}"></script>'
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description)}">
<meta name="theme-color" content="#eef2fb">
<meta property="og:type" content="website">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(description)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script src="/assets/js/layout-init.js?v={ASSET_VERSION}"></script>
<link rel="stylesheet" href="/assets/css/main.css?v={ASSET_VERSION}">
{rag_css}
<link rel="stylesheet" href="/assets/css/assistant.css?v={ASSET_VERSION}">
<script defer src="/assets/js/app.js?v={ASSET_VERSION}"></script>
{rag_js}
</head>"""


def ambient() -> str:
    return """<div class="ambient" aria-hidden="true"><span class="ambient-orb one"></span><span class="ambient-orb two"></span></div>
<div class="grain" aria-hidden="true"></div>"""


def brand(href: str = "/") -> str:
    return f"""<a class="brand" href="{href}" aria-label="JYY OS 2026 电子书首页">
<span class="brand-mark" aria-hidden="true"></span>
<span class="brand-text"><strong>JYY OS</strong><small>2026 · 电子书</small></span>
</a>"""


def home_page(chapters: list[dict]) -> str:
    total_minutes = sum(c["minutes"] for c in chapters)
    total_hours = max(1, round(total_minutes / 60))
    total_images = sum(c["images"] for c in chapters)

    facts = f"""<section class="facts reveal" aria-label="课程数据">
<div class="fact fact-first">
<span class="fact-icon">{icon("book")}</span>
<span class="fact-first"><strong>SPRING 2026</strong><small>蒋炎岩 · 操作系统原理</small></span>
</div>
<div class="fact"><div class="fact-num">{len(chapters)}<span>讲</span></div><div class="fact-label">完整课程，一页不落</div></div>
<div class="fact"><div class="fact-num">{total_images}<span>张</span></div><div class="fact-label">课堂截图，图文互证</div></div>
<div class="fact"><div class="fact-num">{total_hours}<span>小时</span></div><div class="fact-label">按自己的速度精读</div></div>
</section>"""

    spec_pills = ""
    for c in chapters[:3]:
        spec_pills += f"""<a class="spec-pill" href="/lecture/{c['num']}/">
<span class="num">{c['num']}</span><span class="name">{html.escape(c['title'])}</span><span class="go">↗</span>
</a>"""

    filters_html = "".join(
        f'<button class="filter" type="button" data-filter="{key}" aria-pressed="{"true" if key == "all" else "false"}">{label}</button>'
        for key, label in FILTERS
    )

    cards_by_part: dict[str, str] = {p["key"]: "" for p in PARTS}
    for c in chapters:
        search = f"{c['num']} {c['title']} {c['tag']} {strip_tags(c['deck'])} 第{c['num']}讲"
        cards_by_part[c["part"]] += f"""<a class="chapter-card reveal" href="/lecture/{c['num']}/" data-chapter="{c['num']}" data-part="{c['part']}" data-tone="{c['tone']}" data-search="{html.escape(search, quote=True)}">
<div class="card-top"><span class="chapter-num">LECTURE {c['num']}</span><span class="read-flag">已读</span><span class="card-time">{c['minutes']} min</span></div>
<h4>{html.escape(c['title'])}</h4>
<p>{html.escape(c['deck'])}</p>
<div class="card-foot"><span>{html.escape(c['tag'])}</span><span class="arrow" aria-hidden="true">↗</span></div>
</a>"""

    parts_html = ""
    for part in PARTS:
        count = sum(1 for c in chapters if c["part"] == part["key"])
        if not count:
            continue
        parts_html += f"""<section class="part" data-part="{part['key']}">
<header class="part-head">
<span class="part-index">PART {part['num']}</span>
<h3>{part['title']}</h3>
<p>{part['desc']}</p>
<span class="part-count">{count:02d} LECTURES</span>
</header>
<div class="chapter-grid" data-count="{count}">{cards_by_part[part['key']]}</div>
</section>"""

    hero = f"""<main class="wrap">
<section class="hero">
<div class="hero-copy">
<h1><span class="line">操作系统</span><span class="line"><span class="grad">原理</span><span class="dot">.</span></span></h1>
<p class="hero-en">Operating Systems · A book to read slowly</p>
<div class="hero-actions">
<a class="btn blue" href="/lecture/01/">开始阅读 <span class="arrow">↗</span></a>
<a class="btn ghost" href="#curriculum">浏览全部 {len(chapters)} 讲</a>
</div>
<div class="hero-tags"><span><i></i>图文精读</span><span><i></i>视频回链</span><span><i></i>官方讲义</span></div>
</div>
<div class="hero-stage">
<div class="spec-card">
<div class="spec-top">
<span class="spec-logo" aria-hidden="true"></span>
<span class="spec-nav"><span>SIGNAL</span><span>SURFACE</span><span>SYSTEM</span></span>
</div>
<div class="spec-body">
<div class="spec-panel">
<div class="spec-panel-head"><span>SPRING 2026 / INDEX</span><span>{len(chapters)}</span></div>
<div class="spec-stack">{spec_pills}</div>
<div class="spec-panel-foot">JIANG YANYAN / OPERATING SYSTEMS</div>
</div>
<div class="spec-meta">
<div><small>PRIMARY MOVE</small><strong class="blue">图文精读</strong></div>
<div><small>SURFACE BEHAVIOR</small><strong>{len(chapters)} 讲 · {total_images} 图</strong></div>
<div><small>VISUAL SIGNATURE</small><strong>清晰层级</strong></div>
</div>
</div>
<div class="spec-frag">SOFT UI<br>EVOLUTION</div>
</div>
<div class="float-chip read"><b>{len(chapters):02d}</b><span>讲完整收录<br>一页不落</span></div>
<div class="float-chip note"><b>2026</b><span>SPRING<br>JIANG YANYAN</span></div>
</div>
</section>
 {facts}"""

    curriculum = f"""<section class="section" id="curriculum">
<div class="curriculum-tools">
<label class="search-box"><span class="sr-only">搜索章节</span>{icon("search")}<input id="chapterSearch" type="search" placeholder="搜索章节、主题或关键词…" autocomplete="off"><kbd>/</kbd></label>
<div class="filters" role="group" aria-label="按主题筛选">{filters_html}</div>
</div>
<div id="curriculumParts">{parts_html}</div>
<div class="empty-state" id="emptyState" hidden><strong>没有找到相关章节</strong><p>试试「并发」「文件系统」或「Token」这样的关键词。</p></div>
</section>"""

    guide = f"""<section class="guide reveal" id="guide">
<div class="guide-copy">
<span class="eyebrow">READING PROTOCOL</span>
<h2>不是把视频<br>转成文字，<br><span>而是重新讲一遍。</span></h2>
<p>每一讲都从课堂内容中提炼结构：先给出导读与时间点，再用截图和文字把关键概念串起来。你可以在 20 分钟里抓住主线，也可以花一个小时沿着链接继续下潜。</p>
<a class="btn" href="/lecture/01/">从第一讲开始 <span class="arrow">↗</span></a>
</div>
<div class="guide-steps">
<div class="step"><span class="step-num">01</span><div><h3>先看导读</h3><p>一分钟了解这一讲要解决什么问题，以及它在整门课里的位置。</p></div><span class="mini-arrow">↗</span></div>
<div class="step"><span class="step-num">02</span><div><h3>图文精读</h3><p>沿着标题与截图阅读，代码、表格和关键结论都已重新排版。</p></div><span class="mini-arrow">↗</span></div>
<div class="step"><span class="step-num">03</span><div><h3>回到原片</h3><p>每张截图都带时间点，点击即可回到 B 站对应位置，听老师原话。</p></div><span class="mini-arrow">↗</span></div>
<div class="step"><span class="step-num">04</span><div><h3>留下进度</h3><p>标记读完的章节会保存在浏览器里，下次回来继续。</p></div><span class="mini-arrow">↗</span></div>
</div>
</section>"""

    footer = f"""<footer class="site-footer" id="about">
<div class="footer-card">
<div class="footer-top">
<div><span class="eyebrow">COLOPHON / 关于本书</span><h2>让复杂系统，<br>读起来有一点柔软。</h2></div>
<a class="btn ghost" href="/lecture/01/">进入正文 <span class="arrow">↗</span></a>
</div>
<div class="footer-grid">
<div class="footer-about">
{brand("/")}
<p>《操作系统原理》2026 春季课程图文电子书。课程讲义与幻灯片版权归蒋炎岩所有，采用 CC BY-NC 4.0 许可。</p>
</div>
<div class="footer-col"><h4>课程</h4><a href="https://jyywiki.cn/OS/2026/" target="_blank" rel="noopener">官方课程主页 ↗</a><a href="https://space.bilibili.com/202224425" target="_blank" rel="noopener">Bilibili · 蒋炎岩 ↗</a></div>
<div class="footer-col"><h4>开始</h4><a href="/lecture/01/">第 01 讲 · 绪论</a><a href="/lecture/13/">第 13 讲 · 并发</a><a href="/lecture/30/">第 30 讲 · 总结</a></div>
</div>
<div class="footer-legal"><span>© 2026 JYY OS 2026 电子书 · 非官方学习整理 · CC BY-NC 4.0</span><span>Soft UI Evolution · Designed for slow reading</span></div>
</div>
</footer>"""

    nav = f"""<header class="site-header" id="siteHeader">
<div class="wrap nav-shell">
{brand("/")}
<nav class="nav-links" id="navLinks" aria-label="主导航">
<a href="#curriculum">课程目录</a>
<a href="#guide">阅读指南</a>
<a href="#about">关于本书</a>
</nav>
<a class="nav-cta" href="/lecture/01/">开始阅读 {icon("arrow")}</a>
<button class="nav-toggle" id="navToggle" type="button" aria-label="打开导航菜单" aria-expanded="false" aria-controls="navLinks"><span></span><span></span></button>
</div>
</header>"""

    title = "JYY OS 2026 · 操作系统原理电子书"
    description = f"蒋炎岩《操作系统原理》2026 春季课程图文电子书，{len(chapters)} 讲完整收录，Soft UI Evolution 风格静态阅读站。"
    return (
        head(title, description)
        + f"""<body class="home-list">
{ambient()}
<main class="wrap home-main">
{curriculum}
</main>
{footer}
</body>
</html>
"""
    )


def reader_sidebar(chapters: list[dict], current: dict) -> str:
    groups = ""
    for part in PARTS:
        items = [c for c in chapters if c["part"] == part["key"]]
        if not items:
            continue
        links = "".join(
            f'<a class="side-link{" active" if c["num"] == current["num"] else ""}" href="/lecture/{c["num"]}/"><span class="n">{c["num"]}</span><span>{html.escape(c["title"])}</span></a>'
            for c in items
        )
        groups += f'<div class="side-group"><h4>{part["num"]} / {part["title"]}</h4>{links}</div>'
    return f"""<aside class="reader-side" id="readerSide" aria-label="章节目录">
<div class="side-head"><span>CONTENTS</span><b>{len(chapters)} 讲</b><button class="side-collapse" type="button" data-collapse="contents" aria-label="收起章节目录" title="收起目录">−</button></div>
<div class="side-scroll">{groups}</div>
<div class="side-foot"><span>已读进度</span><span><b data-read-count>0</b> / {len(chapters)}</span></div>
</aside>"""


def reader_toc(chapter: dict) -> str:
    if not chapter["toc"]:
        return ""
    links = "".join(
        f'<a href="#{item["id"]}">{html.escape(item["text"])}</a>'
        for item in chapter["toc"]
    )
    return f"""<aside class="reader-toc" id="readerToc" aria-label="本讲目录">
<div class="toc-label"><span>ON THIS PAGE</span><button class="side-collapse" type="button" data-collapse="toc" aria-label="收起本页目录" title="收起本页目录">−</button></div>
<nav class="toc-nav">{links}</nav>
<div class="toc-meter"><div class="toc-meter-top"><span>READING</span><b id="meterText">0%</b></div><div class="toc-meter-bar"><span id="meterBar"></span></div></div>
</aside>"""


def chapter_page(chapter: dict, chapters: list[dict], prev_c: dict | None, next_c: dict | None) -> str:
    part = part_for(chapter["part"])
    source_note = ""
    if chapter["info"]:
        source_note = f"""<details class="source-note"><summary>课程来源与版权说明</summary><div class="source-body">{chapter['info']}</div></details>"""

    toc = reader_toc(chapter)
    mobile_toc = ""
    if chapter["toc"]:
        items = "".join(
            f'<li><a href="#{item["id"]}">{html.escape(item["text"])}</a></li>'
            for item in chapter["toc"]
        )
        mobile_toc = f"""<details class="mobile-toc"><summary>本讲目录 <span>{len(chapter['toc'])} 节</span></summary><ol>{items}</ol></details>"""

    pager_left = (
        f'<a href="/lecture/{prev_c["num"]}/"><small>← PREVIOUS</small><strong>第 {prev_c["num"]} 讲 · {html.escape(prev_c["title"])}</strong></a>'
        if prev_c
        else '<a class="disabled" href="#" aria-disabled="true"><small>← PREVIOUS</small><strong>已经是第一讲</strong></a>'
    )
    pager_right = (
        f'<a class="next" href="/lecture/{next_c["num"]}/"><small>NEXT →</small><strong>第 {next_c["num"]} 讲 · {html.escape(next_c["title"])}</strong></a>'
        if next_c
        else '<a class="next disabled" href="#" aria-disabled="true"><small>NEXT →</small><strong>课程读完了</strong></a>'
    )

    topbar = f"""<div class="reader-progress" aria-hidden="true"><span></span></div>
<header class="reader-topbar" id="readerMenu">
<div class="reader-topbar-inner">
{brand("/")}
<div class="reader-crumb"><span>电子书</span><span class="sep">/</span><span>{part["title"]}</span><span class="sep">/</span><strong>第 {chapter["num"]} 讲</strong></div>
<div class="reader-top-actions">
<button class="icon-btn side-toggle contents-toggle" id="contentsToggle" type="button" aria-label="收起章节目录" aria-controls="readerSide" aria-pressed="true">{icon("panel")}<span>目录</span></button>
<button class="icon-btn side-toggle toc-toggle" id="tocToggle" type="button" aria-label="收起本页目录" aria-controls="readerToc" aria-pressed="true">{icon("list")}<span>本页</span></button>
<button class="icon-btn menu-toggle" id="menuToggle" type="button" aria-label="打开章节目录" aria-expanded="false" aria-controls="readerSide">{icon("menu")}<span>目录</span></button>
<button class="icon-btn" type="button" data-mark-read aria-pressed="false" aria-label="标记本讲为已读">{icon("check")}<span data-read-label>标记已读</span></button>
<a class="icon-btn" href="/#curriculum">{icon("grid")}<span>全部章节</span></a>
</div>
</div>
</header>
<div class="menu-scrim" aria-hidden="true"></div>"""

    article = f"""<article class="reader-article">
<header class="chapter-head">
<span class="chapter-orb" aria-hidden="true"></span>
<p class="eyebrow">LECTURE {chapter["num"]} · {part["title"]}</p>
<h1>{chapter["hero"]}</h1>
<p class="chapter-deck">{html.escape(chapter["deck"])}</p>
<div class="chapter-meta"><span>约 {chapter["minutes"]} 分钟</span><span>{chapter["images"]} 张课堂截图</span><span>2026 春季</span></div>
<div class="chapter-links">
<a class="chapter-link primary" href="{chapter["video"]}" target="_blank" rel="noopener">{icon("play")}Bilibili 原课</a>
<a class="chapter-link" href="{chapter["handout"]}" target="_blank" rel="noopener">{icon("doc")}官方讲义</a>
</div>
</header>
{mobile_toc}
<div class="prose">{chapter["body"]}</div>
{source_note}
<footer class="chapter-end">
<div class="end-cta"><div><h3>读到这里，标记一下你的进度。</h3><p>进度只保存在你的浏览器里，不需要登录。</p></div><button class="end-btn" type="button" data-mark-read aria-pressed="false"><span data-read-label>标记已读</span></button></div>
<nav class="pager" aria-label="章节翻页">{pager_left}{pager_right}</nav>
</footer>
</article>"""

    title = f"第 {chapter['num']} 讲 · {chapter['title']} | JYY OS 2026"
    description = chapter["deck"]
    return (
        head(title, description)
        + f"""<body class="reader-body" data-chapter="{chapter["num"]}">
{ambient()}
{topbar}
<div class="reader-layout">
{reader_sidebar(chapters, chapter)}
{article}
{toc}
</div>
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="查看课堂截图"><button class="lightbox-close" type="button" aria-label="关闭">×</button><img src="" alt=""></div>
</body>
</html>
"""
    )


def rag_page(chapters: list[dict]) -> str:
    total_images = sum(chapter["images"] for chapter in chapters)

    groups = []
    for part in PARTS:
        items = [chapter for chapter in chapters if chapter["part"] == part["key"]]
        if not items:
            continue
        buttons = "".join(
            f'<button class="rag-source" type="button" data-lecture="{chapter["num"]}" data-search="{html.escape(chapter["title"] + " " + chapter["tag"] + " " + chapter["num"], quote=True)}"><span class="rag-source-num">{chapter["num"]}</span><span class="rag-source-name">{html.escape(chapter["title"])}</span><span class="rag-source-time">{chapter["minutes"]}m</span></button>'
            for chapter in items
        )
        groups.append(
            f'<div class="rag-lib-group" data-rag-group><h3>{part["num"]} / {part["title"]}</h3>{buttons}</div>'
        )
    library_groups = "".join(groups)

    suggestions = [
        "用三句话总结第 14 讲：互斥",
        "互斥锁和信号量到底有什么区别？",
        "第 29 讲讲的三条虚拟化路线是什么？",
        "帮我出 5 道操作系统期末复习题",
    ]
    suggestions_html = "".join(
        f'<button class="rag-suggestion" type="button">{suggestion}</button>'
        for suggestion in suggestions
    )

    title = "课程知识库 · RAG 工作台 | JYY OS 2026"
    description = f"基于 {len(chapters)} 讲操作系统课程原文的 RAG 问答工作台，回答带原文引用与检索依据。"

    hero = f"""<main class="rag-main wrap">
<section class="rag-hero">
<div class="rag-hero-copy">
<span class="eyebrow">KNOWLEDGE BASE / RAG WORKSPACE</span>
<h1>把 {len(chapters)} 讲，<br><span>变成可以追问的知识库。</span></h1>
<p>不是只给一个结论。助教会先检索课程原文，再组织回答，并把每一段依据摊开给你。当前页面是完整的 RAG 工作台，而不是右下角的小窗口。</p>
<div class="rag-facts">
<span><b>{len(chapters)}</b> 讲</span>
<span><b>1,000+</b> 个小节</span>
<span><b>{total_images}</b> 张截图</span>
<span><b>DeepSeek</b> RAG</span>
</div>
<a class="rag-back-link" href="/">← 回到电子书阅读</a>
</div>
<div class="rag-flow-card">
<div class="rag-flow-head"><span>RETRIEVAL PIPELINE</span><b>LIVE</b></div>
<div class="rag-flow-step"><span>01</span><div><strong>检索原文</strong><small>从 1,000+ 个课程小节里找出相关片段</small></div></div>
<div class="rag-flow-step"><span>02</span><div><strong>组织答案</strong><small>按你的问题选择精简、标准或深入回答</small></div></div>
<div class="rag-flow-step"><span>03</span><div><strong>标注依据</strong><small>每一条结论都能回到具体讲次和小节</small></div></div>
<div class="rag-flow-foot"><span class="live-dot"></span> 30 讲已建立索引</div>
</div>
</section>
<section class="rag-shell" id="ragShell">
<aside class="rag-library" id="ragLibrary" aria-label="课程知识库">
<div class="rag-panel-head"><div><span>KNOWLEDGE BASE</span><h2>课程知识库</h2></div><button class="rag-panel-close" type="button" data-close-panel="library" aria-label="关闭知识库">{icon("close")}</button></div>
<label class="rag-search">{icon("search")}<input id="ragLibrarySearch" type="search" placeholder="搜索讲次…" autocomplete="off"><kbd>/</kbd></label>
<button class="rag-scope is-active" type="button" data-scope="all"><span>全部课程</span><b>{len(chapters)} 讲</b></button>
<div class="rag-lib-scroll" id="ragLibraryList">{library_groups}</div>
<p class="rag-panel-foot">检索范围只包含这 {len(chapters)} 讲，不会用课程外的内容补答案。</p>
</aside>
<section class="rag-chat">
<header class="rag-chat-head">
<div><span class="rag-status"><i></i> 知识库已连接</span><h2>课程助教</h2></div>
<div class="rag-head-actions">
<button class="rag-mobile-btn" type="button" id="ragLibraryToggle" aria-label="打开知识库">{icon("layers")}<span>知识库</span></button>
<button class="rag-mobile-btn" type="button" id="ragEvidenceToggle" aria-label="查看检索依据">{icon("bookmark")}<span>依据</span></button>
<button class="rag-new-btn" type="button" id="ragNewChat">＋ 新对话</button>
</div>
</header>
<div class="rag-toolbar">
<div class="rag-depth" role="group" aria-label="回答深度"><button type="button" data-depth="brief">精简</button><button type="button" data-depth="standard">标准</button><button type="button" data-depth="deep" class="is-active">深入</button></div>
<span class="rag-scope-current" id="ragScopeLabel">全部 {len(chapters)} 讲</span>
</div>
<div class="rag-messages" id="ragMessages" aria-live="polite">
<div class="rag-welcome">
<span class="rag-welcome-icon">{icon("spark")}</span>
<span class="eyebrow plain">START A DIALOGUE</span>
<h3>从 30 讲里，找到真正有出处的答案。</h3>
<p>我会先检索原文，再结合上下文回答。每一条关键结论都会附上可跳转的课程出处。</p>
<div class="rag-suggestions">{suggestions_html}</div>
<div class="rag-pipeline"><span>检索</span><i>→</i><span>阅读</span><i>→</i><span>回答</span><i>→</i><span>引用</span></div>
</div>
</div>
<form class="rag-composer" id="ragForm">
<textarea id="ragInput" rows="1" maxlength="2000" placeholder="问课程里的任何问题…" aria-label="输入课程问题"></textarea>
<div class="rag-composer-foot"><span>Enter 发送 · Shift + Enter 换行</span><button class="rag-send" type="submit" id="ragSend">{icon("send")}<span>发送</span></button></div>
</form>
<p class="rag-disclaimer">回答由检索到的课程原文生成，可能有误差，请以原课为准。 <a href="/">继续阅读电子书 ↗</a></p>
</section>
<aside class="rag-evidence" id="ragEvidence" aria-label="检索依据">
<div class="rag-panel-head"><div><span>RETRIEVED SOURCES</span><h2>原文依据</h2></div><button class="rag-panel-close" type="button" data-close-panel="evidence" aria-label="关闭依据">{icon("close")}</button></div>
<div class="rag-evidence-summary" id="ragEvidenceSummary">检索到的片段会显示在这里。</div>
<div class="rag-evidence-list" id="ragEvidenceList"><div class="rag-evidence-empty">{icon("layers")}<strong>等待一次提问</strong><p>每一次回答都会附上 4–8 段相关课程原文。</p></div></div>
</aside>
</section>
</main>
<div class="rag-scrim" id="ragScrim"></div>"""

    return (
        head(title, description, rag=True)
        + f"""<body class="rag-page">
{ambient()}
<header class="site-header" id="ragHeader">
<div class="wrap nav-shell">
{brand("/")}
<nav class="nav-links" id="ragNavLinks" aria-label="主导航">
<a href="/">电子书</a>
<a href="/#curriculum">30 讲目录</a>
<a href="/assistant/" class="active" aria-current="page">课程助教</a>
</nav>
<a class="nav-cta" href="/">回到阅读 {icon("arrow")}</a>
<button class="nav-toggle" id="ragNavToggle" type="button" aria-label="打开导航菜单" aria-expanded="false" aria-controls="ragNavLinks"><span></span><span></span></button>
</div>
</header>
{hero}
</body>
</html>
"""
    )


def not_found_page() -> str:
    title = "页面没有找到 | JYY OS 2026"
    return (
        head(title, "这个页面不存在，回到 JYY OS 2026 电子书首页继续阅读。")
        + f"""<body>
{ambient()}
<header class="site-header"><div class="wrap nav-shell">{brand("/")}<a class="nav-cta" href="/">回到首页 {icon("arrow")}</a></div></header>
<main class="wrap" style="padding: 15vh 0; text-align:center;">
<p class="eyebrow" style="justify-content:center;">404 / LOST IN THE KERNEL</p>
<h1 style="font-size:clamp(56px,10vw,110px);letter-spacing:-.07em;line-height:.95;margin:24px 0;">这一页<br><span style="color:#2f6bff">不存在。</span></h1>
<p class="muted" style="max-width:420px;margin:24px auto 0;">可能是链接写错了，也可能它已经被移到别处。回到目录，继续读操作系统。</p>
<a class="btn blue" href="/" style="margin-top:30px;">回到首页 <span class="arrow">↗</span></a>
</main>
</body>
</html>
"""
    )


def split_chunks(text: str, limit: int = 1100) -> list[str]:
    """Split a section into retrieval-sized pieces at sentence boundaries."""
    if len(text) <= limit:
        return [text]
    pieces: list[str] = []
    for sentence in re.split(r"(?<=[。！？；：])", text):
        sentence = sentence.strip()
        while len(sentence) > limit:
            pieces.append(sentence[:limit].rstrip())
            sentence = sentence[limit:].lstrip()
        if not sentence:
            continue
        if pieces and len(pieces[-1]) + len(sentence) <= limit:
            pieces[-1] += sentence
        else:
            pieces.append(sentence)
    return pieces or [text]


def build_course_index(chapters: list[dict]) -> None:
    """Create the retrieval index consumed by /api/chat and /assistant."""
    data_dir = SITE / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    lectures = [
        {
            "num": c["num"],
            "title": c["title"],
            "part": part_for(c["part"])["title"],
            "deck": c["deck"],
            "minutes": c["minutes"],
            "url": f"/lecture/{c['num']}/",
        }
        for c in chapters
    ]
    sections: list[dict] = []
    chunks: list[dict] = []
    heading_re = re.compile(
        r'<h([23])\b[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>', re.S
    )

    for chapter in chapters:
        body = chapter["body"]
        matches = list(heading_re.finditer(body))
        blocks: list[tuple[str, str, str]] = []
        if matches:
            intro = body[: matches[0].start()]
            blocks.append(("导语", "", intro))
            for index, match in enumerate(matches):
                end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
                blocks.append(
                    (
                        strip_tags(match.group(3)),
                        match.group(2),
                        body[match.end() : end],
                    )
                )
        else:
            blocks.append(("全文", "", body))

        for title, anchor, raw in blocks:
            text = strip_tags(raw)
            text = re.sub(
                r"参考时间[:：]?\s*\d{1,2}:\d{2}(?::\d{2})?", " ", text
            )
            text = re.sub(r"\s+", " ", text).strip()
            if len(text) < 40:
                continue
            if len(text) > 8000:
                text = text[:8000].rsplit(" ", 1)[0] + "…"
            section_id = f"L{chapter['num']}-{anchor or 'intro'}"
            section = {
                "id": section_id,
                "lecture": chapter["num"],
                "lectureTitle": chapter["title"],
                "part": part_for(chapter["part"])["title"],
                "title": title,
                "anchor": anchor,
                "url": f"/lecture/{chapter['num']}/"
                + (f"#{anchor}" if anchor else ""),
                "text": text,
            }
            sections.append(section)
            for index, chunk_text in enumerate(split_chunks(text)):
                chunks.append(
                    {
                        "id": f"{section_id}-c{index}",
                        "sectionId": section_id,
                        "lecture": chapter["num"],
                        "lectureTitle": chapter["title"],
                        "part": section["part"],
                        "title": title,
                        "anchor": anchor,
                        "url": section["url"],
                        "text": chunk_text,
                    }
                )

    payload = {
        "version": 2,
        "lectures": lectures,
        "sections": sections,
        "chunks": chunks,
    }
    (data_dir / "course-index.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Course index: {len(lectures)} lectures, {len(sections)} sections, "
        f"{len(chunks)} chunks, "
        f"{(data_dir / 'course-index.json').stat().st_size / 1024:.0f} KB"
    )


CONCEPTS = [
    ("C-abstraction", "抽象与接口", "foundation", ["01", "02", "03"], "操作系统用一组稳定接口，把硬件的复杂性藏起来。", ["C-syscall", "C-process"]),
    ("C-ai", "Agentic AI", "foundation", ["01", "04", "30"], "从语言模型、工具调用到最小操作系统，理解 AI 时代的系统底座。", ["C-token", "C-agent", "C-security"]),
    ("C-syscall", "系统调用", "process", ["02", "07"], "应用与内核之间的正式边界：进程通过系统调用访问操作系统对象。", ["C-fd", "C-process"]),
    ("C-process", "进程", "process", ["05", "06"], "程序、fork/execve、退出与地址空间：一个进程如何诞生和结束。", ["C-address", "C-thread"]),
    ("C-address", "地址空间", "process", ["06"], "虚拟地址、mmap、权限位与进程私有内存视图。", ["C-process", "C-fs"]),
    ("C-fd", "文件描述符", "process", ["07", "08"], "用整数句柄命名操作系统对象，并通过管道和 Shell 组合程序。", ["C-libc", "C-syscall"]),
    ("C-libc", "C 标准库", "systems", ["09", "10"], "在系统调用之上搭起的第一层应用世界，也是调试与抽象的入口。", ["C-link", "C-process"]),
    ("C-link", "链接与加载", "systems", ["11", "12"], "从 ELF、符号解析到动态链接和从零构建 Linux 应用世界。", ["C-libc", "C-process"]),
    ("C-thread", "线程", "concurrency", ["13"], "多处理器编程的最小执行单位，也是并发问题的起点。", ["C-race", "C-parallel"]),
    ("C-race", "数据竞争", "concurrency", ["13", "17"], "共享内存、指令交错与顺序违反：并发 Bug 的根源。", ["C-mutex", "C-deadlock"]),
    ("C-mutex", "互斥", "concurrency", ["14", "17"], "用锁把复杂并发退回顺序世界，同时付出性能与死锁的代价。", ["C-cond", "C-sem"]),
    ("C-cond", "条件变量", "concurrency", ["15"], "让线程在条件不满足时等待，并在条件变化时被唤醒。", ["C-sem", "C-mutex"]),
    ("C-sem", "信号量", "concurrency", ["16"], "用计数 token 表达互斥、同步、限流与生产者消费者。", ["C-deadlock", "C-mutex"]),
    ("C-deadlock", "死锁", "concurrency", ["17"], "多把锁、循环等待与锁顺序：并发系统必须面对的失败模式。", ["C-mutex", "C-race"]),
    ("C-parallel", "并行", "concurrency", ["18"], "从正确性走向可扩展性：并行算法与数据结构。", ["C-thread", "C-gpu"]),
    ("C-async", "异步与协程", "hetero", ["19"], "用协程、Goroutine 和事件循环描述同一张计算图。", ["C-token", "C-parallel"]),
    ("C-gpu", "GPU / SIMT", "hetero", ["20"], "从指令级并行到海量线程，理解 CPU、GPU 与 SIMT 编程模型。", ["C-parallel", "C-token"]),
    ("C-token", "Token 旅程", "hetero", ["21"], "一个 Token 从 HTTP 请求穿过数据中心、网络和 GPU 的完整旅程。", ["C-ai", "C-gpu"]),
    ("C-driver", "设备与驱动", "storage", ["22"], "从 GPIO 线到 file_operations：设备如何接入操作系统。", ["C-storage", "C-syscall"]),
    ("C-storage", "存储设备", "storage", ["23"], "一个 bit 如何跨越时间：磁盘、闪存与存储层次。", ["C-fs", "C-driver"]),
    ("C-fs", "文件系统", "storage", ["24", "25", "26"], "目录树、链接、快照、日志与崩溃一致性。", ["C-db", "C-journal"]),
    ("C-journal", "崩溃一致性", "storage", ["26"], "从块设备到日志：系统崩溃后如何保证文件系统仍然可用。", ["C-fs", "C-db"]),
    ("C-db", "数据库", "future", ["27"], "从文件持久化到 ACID 与向量检索，数据库如何在文件系统之上构建。", ["C-fs", "C-security"]),
    ("C-security", "系统安全", "future", ["28"], "隔离、访问控制与攻击面：系统边界在哪里。", ["C-vm", "C-agent"]),
    ("C-vm", "虚拟化", "future", ["29"], "全系统模拟、JIT、硬件虚拟化与 VMM 的影子页表。", ["C-container", "C-security"]),
    ("C-container", "容器", "future", ["29", "30"], "Namespaces、cgroups、Docker 与 Kubernetes 的隔离与编排。", ["C-agent", "C-vm"]),
    ("C-agent", "Agentic 未来", "future", ["30"], "Agentic AI 与操作系统的下一次交汇。", ["C-ai", "C-container"]),
]

LECTURE_NEXT = [
    "01:02", "02:03", "03:04", "04:05", "05:06", "06:07", "07:08",
    "08:09", "09:10", "10:11", "11:12", "12:13", "13:14", "14:15",
    "15:16", "16:17", "17:18", "18:19", "19:20", "20:21", "21:22",
    "22:23", "23:24", "24:25", "25:26", "26:27", "27:28", "28:29",
    "29:30",
]


def build_knowledge_graph(chapters: list[dict]) -> None:
    """Build the curated course concept graph opened from the chat window."""
    data_dir = SITE / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    by_num = {chapter["num"]: chapter for chapter in chapters}
    part_title = {part["key"]: part["title"] for part in PARTS}

    nodes = [
        {
            "id": "core",
            "label": "操作系统",
            "type": "core",
            "part": "all",
            "desc": "30 讲课程的中心：接口、抽象、并发、存储与安全。",
            "lectures": [chapter["num"] for chapter in chapters],
        }
    ]
    for part in PARTS:
        nodes.append(
            {
                "id": f"part-{part['key']}",
                "label": part["title"],
                "type": "hub",
                "part": part["key"],
                "desc": part["desc"],
                "lectures": [
                    chapter["num"]
                    for chapter in chapters
                    if chapter["part"] == part["key"]
                ],
            }
        )
    for chapter in chapters:
        nodes.append(
            {
                "id": f"L{chapter['num']}",
                "label": chapter["num"],
                "title": chapter["title"],
                "type": "lecture",
                "part": chapter["part"],
                "desc": chapter["deck"],
                "href": f"/lecture/{chapter['num']}/",
                "lectures": [chapter["num"]],
            }
        )
    for concept_id, label, part, lecture_nums, desc, related in CONCEPTS:
        nodes.append(
            {
                "id": concept_id,
                "label": label,
                "type": "concept",
                "part": part,
                "desc": desc,
                "lectures": lecture_nums,
                "related": related,
            }
        )

    edges: list[dict] = []
    seen_edges = set()

    def edge(source: str, target: str, kind: str) -> None:
        key = f"{source}>{target}:{kind}"
        if key in seen_edges:
            return
        seen_edges.add(key)
        edges.append({"source": source, "target": target, "type": kind})

    for part in PARTS:
        hub = f"part-{part['key']}"
        edge("core", hub, "core")
        for chapter in chapters:
            if chapter["part"] == part["key"]:
                edge(hub, f"L{chapter['num']}", "contains")
        for concept_id, _, concept_part, _, _, _ in CONCEPTS:
            if concept_part == part["key"]:
                edge(hub, concept_id, "focus")

    for concept_id, _, _, lecture_nums, _, related in CONCEPTS:
        for lecture_num in lecture_nums:
            if lecture_num in by_num:
                edge(concept_id, f"L{lecture_num}", "explains")
        for related_id in related:
            edge(concept_id, related_id, "related")

    for pair in LECTURE_NEXT:
        left, right = pair.split(":")
        edge(f"L{left}", f"L{right}", "next")

    payload = {"version": 1, "nodes": nodes, "edges": edges}
    (data_dir / "knowledge-graph.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Knowledge graph: {len(nodes)} nodes, {len(edges)} edges, "
        f"{(data_dir / 'knowledge-graph.json').stat().st_size / 1024:.0f} KB"
    )


def write_assets() -> None:
    favicon = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#8fb1ff"/><stop offset=".5" stop-color="#6277ef"/><stop offset="1" stop-color="#d69bb8"/></linearGradient></defs>
<rect width="64" height="64" rx="18" fill="url(#g)"/>
<rect x="23" y="23" width="18" height="18" rx="5" fill="none" stroke="#fff" stroke-width="3" transform="rotate(11 32 32)"/>
<circle cx="53" cy="11" r="12" fill="#ffd2c2" opacity=".9"/>
</svg>"""
    (SITE / "assets" / "favicon.svg").write_text(favicon, encoding="utf-8")

    vercel = {
        "trailingSlash": True,
        "cleanUrls": True,
        "redirects": [
            {"source": "/assistant", "destination": "/", "permanent": False},
            {"source": "/assistant/", "destination": "/", "permanent": False},
        ],
        "functions": {
            "api/chat.js": {
                "maxDuration": 60,
            }
        },
        "headers": [
            {
                "source": "/assets/(.*)",
                "headers": [
                    {
                        "key": "Cache-Control",
                        "value": "public, max-age=31536000, immutable",
                    }
                ],
            },
            {
                "source": "/lecture/(.*)/images/(.*)",
                "headers": [
                    {
                        "key": "Cache-Control",
                        "value": "public, max-age=31536000, immutable",
                    }
                ],
            },
            {
                "source": "/(.*)",
                "headers": [
                    {"key": "X-Content-Type-Options", "value": "nosniff"},
                    {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
                ],
            },
        ],
    }
    (SITE / "vercel.json").write_text(
        json.dumps(vercel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (SITE / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n", encoding="utf-8"
    )


def compute_asset_version() -> str:
    """Fingerprint CSS/JS so immutable caching cannot pin an old UI."""
    digest = hashlib.sha256()
    for relative in (
        "assets/css/main.css",
        "assets/css/assistant.css",
        "assets/js/app.js",
        "assets/js/chat.js",
        "assets/js/layout-init.js",
    ):
        path = SITE / relative
        digest.update(relative.encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def main() -> None:
    global ASSET_VERSION
    if not SRC.exists():
        raise SystemExit("source/ is missing; extract the upstream ebook archive first.")
    ASSET_VERSION = compute_asset_version()
    SITE.mkdir(parents=True, exist_ok=True)
    (SITE / "assets" / "css").mkdir(parents=True, exist_ok=True)
    (SITE / "assets" / "js").mkdir(parents=True, exist_ok=True)
    (SITE / "assets" / "fonts").mkdir(parents=True, exist_ok=True)

    chapters = chapter_data()
    if len(chapters) != 30:
        raise SystemExit(f"expected 30 chapters, got {len(chapters)}")

    (SITE / "index.html").write_text(home_page(chapters), encoding="utf-8")
    (SITE / "404.html").write_text(not_found_page(), encoding="utf-8")

    by_num = {c["num"]: c for c in chapters}
    for index, chapter in enumerate(chapters):
        prev_c = chapters[index - 1] if index > 0 else None
        next_c = chapters[index + 1] if index < len(chapters) - 1 else None
        out_dir = SITE / "lecture" / chapter["num"]
        out_dir.mkdir(parents=True, exist_ok=True)
        out_dir.joinpath("index.html").write_text(
            chapter_page(chapter, chapters, prev_c, next_c), encoding="utf-8"
        )

    write_assets()
    build_course_index(chapters)
    build_knowledge_graph(chapters)
    total_kb = sum(
        p.stat().st_size for p in SITE.rglob("*") if p.is_file()
    ) / 1024
    print(f"Built {len(chapters)} chapters.")
    print(f"Reading time: {sum(c['minutes'] for c in chapters) / 60:.1f} h")
    print(f"Site size including images: {total_kb / 1024:.1f} MB")
    print(f"Output: {SITE}")


if __name__ == "__main__":
    main()
