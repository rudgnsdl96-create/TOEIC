/* TOEIC 학습 앱 service worker — offline app shell */
/* ⚠ 무엇이든 수정하면 아래 CACHE 를 "toeic-" + data/list.js 의 APP_VERSION 과 같은 값으로 올릴 것 */
const CACHE = "toeic-2026-11-27-v1";   // data/list.js 의 APP_VERSION 과 같은 값
const SHELL = [
  "./",
  "./index.html",
  "./data/list.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    // data/list.js 에 적힌 TEST 데이터 파일까지 미리 저장 → 처음 설치 직후에도 오프라인에서 열림
    try {
      const t = await (await fetch("./data/list.js", { cache: "no-cache" })).text();
      const v = (t.match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
      const files = (((t.match(/DATA_FILES\s*=\s*\[([^\]]*)\]/) || [])[1] || "").match(/"[^"]+"/g) || []).map((f) => f.slice(1, -1));
      if (v) await c.addAll(files.map((f) => `./data/${f}.js?v=${v}`));
    } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("toeic-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 화면 이동: 네트워크 우선, 오프라인이면 캐시된 앱 사용
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // 문제 목록(data/list.js)은 항상 최신본 우선 → 새 TEST·새 버전을 바로 반영
  if (url.pathname.endsWith("/data/list.js")) {
    e.respondWith(fetch(req, { cache: "no-cache" }).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});
