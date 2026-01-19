const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const contentPath = "./content/optimized/";
const mobileBreakpoint = 768;

// Store current project name for scroll restoration
const projectMatch = location.pathname.match(/\/([^/]+)\.html/);
if (projectMatch) {
  sessionStorage.setItem("lastProject", projectMatch[1]);
}

// Calculate fullscreen scale for home page
function setFullscreenScale() {
  if (!document.getElementById("home")) return;
  const isMobile = window.innerWidth <= mobileBreakpoint;

  if (isMobile) {
    // Mobile/tablet: No scaling needed, natural video height
    document.documentElement.style.setProperty("--cover-scale", 1);
    document.documentElement.style.setProperty("--contain-scale", 1);
  } else {
    // Desktop: 16:9 scaling
    const contentHeight = window.innerWidth * 9 / 16;
    const scaleY = window.innerHeight / contentHeight;
    document.documentElement.style.setProperty("--cover-scale", Math.max(1, scaleY));
    document.documentElement.style.setProperty("--contain-scale", Math.min(1, scaleY));
  }
}

// Restore scroll position when navigating back to home
let hasScrolled = false;
function scrollToLastProject() {
  if (hasScrolled) return;
  if (!document.getElementById("home")) return;

  const projectName = sessionStorage.getItem("lastProject");
  if (!projectName) return;

  const target = document.querySelector(`[style*="view-transition-name: ${projectName}"]`);
  if (target) {
    hasScrolled = true;
    const html = document.documentElement;
    html.style.scrollSnapType = "none";
    target.scrollIntoView({ behavior: "instant", block: "start" });
    requestAnimationFrame(() => {
      html.style.scrollSnapType = "";
    });
  }
}

window.addEventListener("pagereveal", (e) => {
  if (e.viewTransition) {
    setFullscreenScale();
    scrollToLastProject();
  }
});

window.addEventListener("pageshow", (e) => {
  if (e.persisted) scrollToLastProject();
});

document.addEventListener("DOMContentLoaded", scrollToLastProject);

document.addEventListener("DOMContentLoaded", () => {
  const videos = document.querySelectorAll(".video");
  const sections = document.querySelectorAll("section");

  setFullscreenScale();
  window.addEventListener("resize", setFullscreenScale);

  let activeTitle = null;
  let pendingTimeouts = new Map();

  (function () {
    const identityEl = document.getElementById("identity");
    if (!identityEl) return;

    const path = window.location.pathname.replace(/\/$/, "");

    const COPY_BY_PATH = {
      "/eight-sleep.html": "Motion design for Eight Sleep's product and brand",
      "/rain.html": "Motion design for Rain",
      "/specter.html": "Motion design for Specter w/ OTK Studio",
      "/bocci.html":
        "Motion design for Bocci's 20th Anniversary w/ Studio Frith",
      "/programme.html": "Motion design for Programme",
    };

    const newText = COPY_BY_PATH[path];
    if (!newText) return;

    /* ----------------------------
     Timing
  ----------------------------- */
    const START_DELAY = 500;
    const CURSOR_FADE_DURATION = 180;
    const PAUSE_AFTER_CURSOR = 120;
    const PAUSE_AFTER_SELECT = 180;

    const TYPE_BASE = 22;
    const TYPE_VARIANCE = 28;
    const MID_WORD_PAUSE_CHANCE = 0.08;
    const MID_WORD_PAUSE = [120, 260];

    /* ----------------------------
     Helpers
  ----------------------------- */
    function selectAllText(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    /* ----------------------------
     Start AFTER delay (no DOM changes before)
  ----------------------------- */
    setTimeout(() => {
      /* ---- create cursor (fade in) ---- */
      const cursor = document.createElement("span");
      cursor.textContent = "|";
      cursor.style.marginLeft = "2px";
      cursor.style.display = "inline-block";
      cursor.style.opacity = "0";
      cursor.style.transition = `opacity ${CURSOR_FADE_DURATION}ms ease`;

      /* critical: exclude cursor from selection */
      cursor.style.userSelect = "none";
      cursor.style.webkitUserSelect = "none";
      cursor.style.pointerEvents = "none";

      identityEl.appendChild(cursor);

      requestAnimationFrame(() => {
        cursor.style.opacity = "1";
      });

      /* ---- cursor blinking ---- */
      let blinking = true;
      let cursorVisible = true;

      setInterval(() => {
        if (!blinking) return;
        cursorVisible = !cursorVisible;
        cursor.style.visibility = cursorVisible ? "visible" : "hidden";
      }, 500);

      /* ---- after cursor fade, select text ---- */
      setTimeout(() => {
        selectAllText(identityEl);

        setTimeout(() => {
          window.getSelection().removeAllRanges();

          /* ---- replace text & start typing ---- */
          const textNode = document.createTextNode("");
          identityEl.textContent = "";
          identityEl.appendChild(textNode);
          identityEl.appendChild(cursor);

          blinking = false;
          cursor.style.visibility = "visible";

          let index = 0;

          function type() {
            if (index >= newText.length) {
              blinking = true; // resume blinking when done
              return;
            }

            textNode.textContent += newText.charAt(index);
            index++;

            let delay = TYPE_BASE + Math.random() * TYPE_VARIANCE;

            if (
              newText.charAt(index) !== " " &&
              Math.random() < MID_WORD_PAUSE_CHANCE
            ) {
              delay +=
                MID_WORD_PAUSE[0] +
                Math.random() * (MID_WORD_PAUSE[1] - MID_WORD_PAUSE[0]);
            }

            setTimeout(type, delay);
          }

          type();
        }, PAUSE_AFTER_SELECT);
      }, CURSOR_FADE_DURATION + PAUSE_AFTER_CURSOR);
    }, START_DELAY);
  })();

  if (window.innerWidth > mobileBreakpoint) {
    sections.forEach((section) => {
      const title = section.querySelector(".title");

      section.addEventListener("mouseenter", (e) => {
        if (activeTitle && activeTitle !== title) {
          activeTitle.style.opacity = 0;
        }
        activeTitle = title;
        title.style.opacity = 1;
        title.style.left = e.clientX + "px";
        title.style.top = e.clientY + "px";
      });

      section.addEventListener("mouseleave", () => {
        title.style.opacity = 0;
        if (activeTitle === title) activeTitle = null;
      });

      section.addEventListener("mousemove", (e) => {
        if (!activeTitle) return;
        activeTitle.style.left = e.clientX + "px";
        activeTitle.style.top = e.clientY + "px";
      });
    });
  }

  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        const img = target.querySelector("img");
        const existingVideo = target.querySelector("video");

        if (isIntersecting) {
          if (existingVideo) return;

          clearTimeout(pendingTimeouts.get(target));
          pendingTimeouts.delete(target);

          const loadVideo = () => {
            if (target.querySelector("video")) return;

            const video = document.createElement("video");

            Object.assign(video, {
              src: getVideoSource(video, target.dataset),
              muted: true,
              autoplay: true,
              loop: true,
              playsInline: true,
            });

            video.addEventListener("playing", () => {
              video.style.opacity = "1";
              if (window.innerWidth > mobileBreakpoint) {
                setTimeout(() => (img.style.opacity = "0"), 300);
              }
            });

            target.appendChild(video);
          };

          if (window.innerWidth <= mobileBreakpoint) {
            const timeout = setTimeout(loadVideo, 200);
            pendingTimeouts.set(target, timeout);
          } else {
            loadVideo();
          }
        } else {
          clearTimeout(pendingTimeouts.get(target));
          pendingTimeouts.delete(target);

          if (existingVideo) {
            setTimeout(() => {
              existingVideo.pause();
              existingVideo.removeAttribute("src");
              existingVideo.load();
              existingVideo.remove();
            }, 300);

            existingVideo.style.opacity = "0";
            if (window.innerWidth > mobileBreakpoint) {
              img.style.opacity = "1";
            }
          }
        }
      });
    },
    { threshold: 0.5 }
  );

  function getVideoSource(video, dataset) {
    const src =
      window.innerWidth <= mobileBreakpoint && dataset.srcMobile
        ? dataset.srcMobile
        : dataset.src;

    const formats = {
      "video/mp4; codecs=hevc": "_h265.mp4",
      "video/webm; codecs=vp9": ".webm",
      "video/mp4; codecs=avc1": "_h264.mp4",
    };

    if (isMac && isSafari) {
      delete formats["video/webm; codecs=vp9"];
    }

    const format = Object.keys(formats).find(
      (format) => video.canPlayType(format) !== ""
    );
    const suffix = formats[format];

    return contentPath + src + suffix;
  }

  videos.forEach((video) => {
    const src =
      window.innerWidth <= mobileBreakpoint && video.dataset.srcMobile
        ? video.dataset.srcMobile
        : video.dataset.src;
    video.querySelector("img").src = contentPath + src + "-poster.webp";
    video.querySelector("img").alt = src;
    videoObserver.observe(video);
  });

  console.log(
    isSafari
      ? `Designed & engineered by OTK Studio`
      : `\n\n   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  \n   ░▒▓██████▓▒░░░▒▓█████████▓▒░▒▓█▓▒░░░▒▓█▓▒░░ \n ░▒▓█▓▒░░░░▒▓█▓▒░░░░░▒▓█▓▒░░░░░▒▓█▓▒░░▒▓█▓▒░░ \n░▒▓█▓▒░░░░░░▒▓█▓▒░░░░▒▓█▓▒░░░░░▒▓█▓▒░▒▓█▓▒░░  \n░▒▓█▓▒░░░░░░▒▓█▓▒░░░░▒▓█▓▒░░░░░▒▓██████▓▒░░░  \n░▒▓█▓▒░░░░░░▒▓█▓▒░░░░▒▓█▓▒░░░░░▒▓█▓▒░▒▓█▓▒░░  \n ░▒▓█▓▒░░░░▒▓█▓▒░░░░░▒▓█▓▒░░░░░▒▓█▓▒░░▒▓█▓▒░░ \n   ░▒▓██████▓▒░░░░░░░▒▓█▓▒░░░░░▒▓█▓▒░░░▒▓█▓▒░░ \n   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  \n\n      Designed & engineered by OTK Studio \n\n`
  );
});
