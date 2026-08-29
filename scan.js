/* Custom Lasts — browser foot scan. Camera + local vault. No uploads. */
(function () {
  "use strict";

  var app = document.getElementById("scan-app");
  if (!app) return;

  var SHOTS = [
    {
      id: "top",
      label: "Top",
      hint: "Hold the phone above the foot, looking straight down. Whole foot in the frame, toes and heel."
    },
    {
      id: "inner",
      label: "Inner side",
      hint: "Stand the phone beside the arch. Inner edge from heel to toe, foot flat on the floor."
    },
    {
      id: "outer",
      label: "Outer side",
      hint: "Other side. Outer edge from heel to toe, same standing height as the inner shot."
    },
    {
      id: "heel",
      label: "Heel",
      hint: "Behind the heel, looking forward along the foot. Heel centered, both sides visible."
    }
  ];

  var CONSTRAINTS = {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 }
    },
    audio: false
  };

  var state = {
    step: 0,
    side: null,
    shotIndex: 0,
    blobs: { top: null, inner: null, outer: null, heel: null },
    urls: { top: null, inner: null, outer: null, heel: null },
    stream: null,
    cameraError: false,
    frozen: false
  };

  var video = document.getElementById("camera");
  var freeze = document.getElementById("freeze");
  var cameraError = document.getElementById("camera-error");
  var fileFallback = document.getElementById("file-fallback");
  var consentBio = document.getElementById("consent-bio");
  var consentLocal = document.getElementById("consent-local");
  var consentContinue = document.getElementById("consent-continue");
  var btnCapture = document.getElementById("btn-capture");
  var btnRetake = document.getElementById("btn-retake");
  var btnNextShot = document.getElementById("btn-next-shot");
  var btnSave = document.getElementById("btn-save");
  var btnDiscard = document.getElementById("btn-discard");
  var saveError = document.getElementById("save-error");

  function prepareVideo(el) {
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
  }

  prepareVideo(video);

  function revokeUrl(key) {
    if (state.urls[key]) {
      URL.revokeObjectURL(state.urls[key]);
      state.urls[key] = null;
    }
  }

  function setBlob(key, blob) {
    revokeUrl(key);
    state.blobs[key] = blob;
    state.urls[key] = blob ? URL.createObjectURL(blob) : null;
  }

  function clearBlobs() {
    Object.keys(state.blobs).forEach(function (key) {
      setBlob(key, null);
    });
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
    video.srcObject = null;
  }

  function showPanel(step) {
    state.step = step;
    document.querySelectorAll(".scan-panel").forEach(function (panel) {
      var n = Number(panel.getAttribute("data-step"));
      var on = n === step;
      panel.classList.toggle("is-active", on);
      if (on) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
    document.querySelectorAll(".scan-progress li").forEach(function (li) {
      var n = Number(li.getAttribute("data-mark"));
      li.classList.toggle("is-now", n === step);
      li.classList.toggle("is-done", n < step);
    });
  }

  function syncConsent() {
    consentContinue.disabled = !(consentBio.checked && consentLocal.checked);
  }

  async function startCamera() {
    cameraError.hidden = true;
    state.cameraError = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      state.cameraError = true;
      cameraError.hidden = false;
      btnCapture.hidden = true;
      video.hidden = true;
      return;
    }
    stopCamera();
    try {
      var stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      state.stream = stream;
      prepareVideo(video);
      video.srcObject = stream;
      await video.play().catch(function () {});
    } catch (err) {
      state.cameraError = true;
      cameraError.hidden = false;
      btnCapture.hidden = true;
      video.hidden = true;
      stopCamera();
    }
  }

  function currentShot() {
    return SHOTS[state.shotIndex];
  }

  function renderShotChrome() {
    var shot = currentShot();
    var n = state.shotIndex + 1;
    document.getElementById("shot-kicker").textContent = "Shot " + n + " of 4 · " + (state.side === "left" ? "Left foot" : "Right foot");
    document.getElementById("capture-title").textContent = shot.label;
    document.getElementById("shot-hint").textContent = shot.hint;
    document.getElementById("viewfinder-caption").textContent = shot.label + " — " + shot.hint;
    var dots = document.getElementById("shot-dots");
    dots.innerHTML = SHOTS.map(function (s, i) {
      var cls = "shot-dot";
      if (i === state.shotIndex) cls += " is-now";
      else if (state.blobs[s.id]) cls += " is-done";
      return '<span class="' + cls + '" title="' + s.label + '"></span>';
    }).join("");
  }

  function showLive() {
    state.frozen = false;
    freeze.hidden = true;
    freeze.removeAttribute("src");
    video.hidden = state.cameraError;
    btnCapture.hidden = state.cameraError;
    btnRetake.hidden = true;
    btnNextShot.hidden = true;
    if (state.stream && !state.cameraError) {
      video.play().catch(function () {});
    }
  }

  function showFreeze(url) {
    state.frozen = true;
    freeze.src = url;
    freeze.hidden = false;
    video.hidden = true;
    btnCapture.hidden = true;
    btnRetake.hidden = false;
    var last = state.shotIndex === SHOTS.length - 1;
    btnNextShot.hidden = false;
    btnNextShot.textContent = last ? "Review" : "Next shot";
  }

  function enterCapture() {
    showPanel(2);
    state.shotIndex = 0;
    showLive();
    renderShotChrome();
    startCamera();
  }

  function canvasToJpeg(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) reject(new Error("Could not encode image"));
        else resolve(blob);
      }, "image/jpeg", 0.88);
    });
  }

  async function captureFromVideo() {
    if (!video.videoWidth) {
      await new Promise(function (resolve) {
        video.addEventListener("loadeddata", resolve, { once: true });
        setTimeout(resolve, 400);
      });
    }
    if (!video.videoWidth) throw new Error("Camera is not ready");
    var canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvasToJpeg(canvas);
  }

  function blobFromFile(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1920;
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (Math.max(w, h) > max) {
          var s = max / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvasToJpeg(canvas).then(resolve, reject);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that photo"));
      };
      img.src = url;
    });
  }

  async function acceptBlob(blob) {
    var key = currentShot().id;
    setBlob(key, blob);
    showFreeze(state.urls[key]);
    renderShotChrome();
  }

  function renderReview() {
    document.getElementById("review-lede").textContent =
      (state.side === "left" ? "Left" : "Right") +
      " foot. Four frames, still on this device. Save them to the vault or discard them.";
    var grid = document.getElementById("review-grid");
    grid.innerHTML = SHOTS.map(function (shot) {
      var url = state.urls[shot.id] || "";
      return (
        '<li class="review-card">' +
          '<img src="' + url + '" alt="' + shot.label + '" />' +
          '<div>' +
            '<p class="kicker">' + shot.label + '</p>' +
            '<button class="text-btn" type="button" data-retake="' + shot.id + '">Retake</button>' +
          '</div>' +
        '</li>'
      );
    }).join("");
  }

  function goToShot(id) {
    var idx = SHOTS.findIndex(function (s) { return s.id === id; });
    if (idx < 0) return;
    state.shotIndex = idx;
    showPanel(2);
    renderShotChrome();
    if (state.blobs[id]) showFreeze(state.urls[id]);
    else showLive();
    if (!state.stream && !state.cameraError) startCamera();
  }

  consentBio.addEventListener("change", syncConsent);
  consentLocal.addEventListener("change", syncConsent);

  consentContinue.addEventListener("click", function () {
    if (consentContinue.disabled) return;
    showPanel(1);
  });

  document.getElementById("back-to-consent").addEventListener("click", function (e) {
    e.preventDefault();
    showPanel(0);
  });

  document.querySelectorAll(".foot-card").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.side = btn.getAttribute("data-side");
      clearBlobs();
      enterCapture();
    });
  });

  btnCapture.addEventListener("click", function () {
    captureFromVideo()
      .then(acceptBlob)
      .catch(function () {
        state.cameraError = true;
        cameraError.hidden = false;
      });
  });

  btnRetake.addEventListener("click", function () {
    setBlob(currentShot().id, null);
    showLive();
    renderShotChrome();
    if (!state.stream) startCamera();
  });

  btnNextShot.addEventListener("click", function () {
    if (!state.blobs[currentShot().id]) return;
    if (state.shotIndex < SHOTS.length - 1) {
      state.shotIndex += 1;
      renderShotChrome();
      if (state.blobs[currentShot().id]) showFreeze(state.urls[currentShot().id]);
      else showLive();
    } else {
      stopCamera();
      renderReview();
      showPanel(3);
    }
  });

  fileFallback.addEventListener("change", function () {
    var file = fileFallback.files && fileFallback.files[0];
    fileFallback.value = "";
    if (!file) return;
    blobFromFile(file).then(acceptBlob).catch(function () {
      cameraError.hidden = false;
    });
  });

  document.getElementById("review-grid").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-retake]");
    if (!btn) return;
    goToShot(btn.getAttribute("data-retake"));
  });

  btnDiscard.addEventListener("click", function () {
    if (!window.confirm("Discard these four photos? They were never uploaded.")) return;
    clearBlobs();
    stopCamera();
    showPanel(1);
  });

  btnSave.addEventListener("click", function () {
    saveError.hidden = true;
    var images = {};
    var missing = false;
    SHOTS.forEach(function (shot) {
      images[shot.id] = state.blobs[shot.id];
      if (!state.blobs[shot.id]) missing = true;
    });
    if (missing || !state.side) {
      saveError.hidden = false;
      saveError.textContent = "Four photos and a foot side are required.";
      return;
    }
    btnSave.disabled = true;
    CustomLastsVault.addScan({
      side: state.side,
      createdAt: Date.now(),
      images: images
    }).then(function () {
      clearBlobs();
      stopCamera();
      showPanel(4);
    }).catch(function () {
      saveError.hidden = false;
      saveError.textContent = "Could not save in this browser. IndexedDB may be blocked.";
    }).then(function () {
      btnSave.disabled = false;
    });
  });

  document.getElementById("btn-another").addEventListener("click", function () {
    state.side = state.side === "left" ? "right" : "left";
    clearBlobs();
    enterCapture();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopCamera();
    else if (state.step === 2 && !state.frozen) startCamera();
  });

  window.addEventListener("pagehide", stopCamera);

  showPanel(0);
  syncConsent();
})();
