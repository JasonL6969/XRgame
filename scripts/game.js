    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // Query flags for debugging
    const params = new URLSearchParams(window.location.search || "");
    const FORCE_NO_XR = params.has("noxr");
    const FORCE_NO_DOM = params.has("nodom");
    const FORCE_3D_HUD = params.has("force3dhud");

    function shuffleInPlace(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function makeBeep() {
      let ctx = null;
      return {
        play(freq=660, dur=0.08, gain=0.06) {
          if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          g.gain.value = gain;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + dur);
        }
      };
    }
    const beep = makeBeep();

    // Pre-baked Cantonese TTS mp3 fallback (generated via tts/texts.json)
    const ttsAudioBase = "audio/";
    const audioMap = {
      "呢件文物同植物有關。": "cabbage_hint1",
      "佢係用玉石雕成，但睇落好似真菜葉咁柔軟。": "cabbage_hint2",
      "綠色、似菜葉。": "cabbage_hint3",
      "呢件文物同食物有關，但唔係食得㗎。": "meat_hint1",
      "佢利用天然石紋做出層次，好似有肥有瘦。": "meat_hint2",
      "粉紅加深色分層，好似一嚿叉燒。": "meat_hint3",
      "呢件文物係一件好細緻嘅瓷器。": "chicken_hint1",
      "佢用咗一種叫『鬥彩』嘅裝飾技法。": "chicken_hint2",
      "杯身上有公雞、母雞同小雞圖案。": "chicken_hint3",
      "你搵到翠玉白菜喇！佢用翠玉雕成，好似真白菜，象徵清白同好彩。": "cabbage_speak",
      "你答啱喇！肉形石係石頭雕成，好似叉燒咁，仲用石頭天然顏色做出肥瘦。": "meat_speak",
      "你搵到明成化鬥彩雞缸杯喇！佢係成化年間嘅名瓷，以鬥彩技法燒製，畫有一家雞嘅溫馨場面。": "chicken_speak",
      "你搵到翠玉白菜喇！": "found_cabbage",
      "你搵到肉形石喇！": "found_meat",
      "你搵到明成化鬥彩雞缸杯喇！": "found_chicken",
      "嘩！你搵得超快！": "praise_fast",
      "好叻！搵得好快！": "praise_good",
      "下一件文物簡介：肉形石展示咗古代工匠點樣善用天然石紋，令作品以假亂真。": "next_intro_meat",
      "下一件文物簡介：鬥彩雞缸杯係明代成化朝最受推崇嘅瓷器之一。": "next_intro_chicken",
      "準備好未？下一件開始喇。": "next_ready",
      "完成喇！你已經收集咗三件文物。好叻！": "finish_all",
      "時間到喇，下次再挑戰。": "time_up",
      "唔係呢件，再搵下！": "not_this_one",
      "你好近喇，留意下細節。": "close_one",
      "方向啱，但仲未係。": "direction_ok",
      "呢件同目標無關，轉個方向望下。": "far_one"
    };

    const playAudio = (id, textForToast="") => {
      if (!id) return false;
      try {
        // stop any existing fallback audio to avoid overlapping playback
        if (window.__currentTtsAudio) {
          try { window.__currentTtsAudio.pause(); window.__currentTtsAudio.currentTime = 0; } catch(e) {}
          window.__currentTtsAudio = null;
        }
        const a = new Audio(`${ttsAudioBase}${id}.mp3`);
        window.__currentTtsAudio = a;
        setSpeakBusy(true);
        a.onended = () => { setSpeakBusy(false); window.__currentTtsAudio = null; };
        a.onerror = () => { setSpeakBusy(false); window.__currentTtsAudio = null; };
        a.play().catch(() => { setSpeakBusy(false); window.__currentTtsAudio = null; });
      } catch (e) {
        return false;
      }
      if (textForToast) showToast(textForToast);
      return true;
    };

    function showToast(text) {
      const toast = document.getElementById("toast");
      const toastText = document.getElementById("toastText");
      if (!toast || !toastText) return;
      toastText.textContent = text;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 900);
    }

    function setInfoCard(show, title="", body="") {
      const box = document.getElementById("info");
      const t = document.getElementById("infoTitle");
      const b = document.getElementById("infoBody");
      if (!box || !t || !b) return;
      if (!show) {
        box.classList.remove("show");
        return;
      }
      t.textContent = title;
      b.textContent = body;
      box.classList.add("show");
    }

    // Cantonese TTS
    let cachedVoice = null;

    function pickCantoneseVoice() {
      if (!('speechSynthesis' in window)) return null;
      const voices = window.speechSynthesis.getVoices?.() || [];
      if (!voices.length) return null;

      const hk = voices.find(v => (v.lang || '').toLowerCase() === 'zh-hk');
      if (hk) return hk;

      const hk2 = voices.find(v => /hk/i.test(v.lang || '') || /canton/i.test(v.name || ''));
      if (hk2) return hk2;

      const hant = voices.find(v => /zh-hant/i.test(v.lang || ''));
      if (hant) return hant;
      const zhtw = voices.find(v => /zh-tw/i.test(v.lang || ''));
      if (zhtw) return zhtw;
      const zh = voices.find(v => /^zh/i.test(v.lang || ''));
      return zh || null;
    }

    function primeTTS() {
      if (!('speechSynthesis' in window)) return;
      try { window.speechSynthesis.getVoices(); } catch (e) {}
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoice = pickCantoneseVoice();
      };
      cachedVoice = pickCantoneseVoice();
    }

    const hasNativeTTS = () => {
      try {
        if (!('speechSynthesis' in window)) return false;
        const v = window.speechSynthesis.getVoices?.();
        return v && v.length > 0;
      } catch (e) { return false; }
    };
    let speakBusy = false;
    const setSpeakBusy = (v) => { speakBusy = !!v; };

    function speakCantonese(text) {
      if (!text) return false;
      if (!hasNativeTTS()) return false;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-HK';
      if (!cachedVoice) cachedVoice = pickCantoneseVoice();
      if (cachedVoice) u.voice = cachedVoice;
      u.rate = 1.02;
      u.pitch = 1.0;
      try { window.speechSynthesis.cancel(); } catch(e) {}
      try { window.speechSynthesis.speak(u); return true; } catch(e) { return false; }
    }

    function sayWithFallback(text, toastAlso=false) {
      if (!text) return;
      if (!speakCantonese(text)) {
        const id = audioMap[text];
        if (!playAudio(id, toastAlso ? text : "")) {
          if (toastAlso) showToast(text);
        }
      }
    }

    function speakQueue(texts, onDone) {
      const list = (texts || []).filter(Boolean);
      if (!list.length) {
        if (typeof onDone === 'function') onDone();
        return;
      }
      setSpeakBusy(true);

      const nativeOK = hasNativeTTS();

      if (nativeOK) {
        try { window.speechSynthesis.cancel(); } catch(e) {}
        let i = 0;
        const next = () => {
          if (i >= list.length) {
            setSpeakBusy(false);
            if (typeof onDone === 'function') onDone();
            return;
          }
          const t = list[i++];
          const u = new SpeechSynthesisUtterance(t);
          u.lang = 'zh-HK';
          if (!cachedVoice) cachedVoice = pickCantoneseVoice();
          if (cachedVoice) u.voice = cachedVoice;
          u.rate = 1.02;
          u.pitch = 1.0;
          u.onend = () => next();
          try { window.speechSynthesis.speak(u); } catch(e) { next(); }
        };
        next();
        return;
      }

      // fallback: sequentially play pre-baked mp3
      let i = 0;
      const nextAudio = () => {
        if (i >= list.length) {
          setSpeakBusy(false);
          if (typeof onDone === 'function') onDone();
          return;
        }
        const t = list[i++];
        const id = audioMap[t];
        if (!id) { showToast(t); return nextAudio(); }
        try {
          const a = new Audio(`${ttsAudioBase}${id}.mp3`);
          a.onended = () => nextAudio();
          a.onerror = () => { showToast(t); nextAudio(); };
          a.play().catch(() => { showToast(t); nextAudio(); });
        } catch (e) { showToast(t); nextAudio(); }
      };
      nextAudio();
    }

    // Controller: trigger -> picked
    AFRAME.registerComponent("controller-picker", {
      init() {
        this.el.addEventListener("triggerdown", () => {
          try { beep.play(520, 0.03, 0.001); } catch(e) {}
          const rc = this.el.components.raycaster;
          if (!rc) return;
          const hit = (rc.intersectedEls && rc.intersectedEls[0]) ? rc.intersectedEls[0] : null;
          if (!hit) return;
          const target = hit.closest?.('.artifactHit') || hit;
          target.emit("picked", { hand: this.el.id }, false);
        });
      }
    });

    function onActivate(el, handler) {
      el.addEventListener("picked", handler);
      el.addEventListener("click", handler);
    }

    AFRAME.registerComponent("hunt-game", {
      init() {
        // Apply debug flags: noxr / nodom
        const sceneRoot = document.getElementById("sceneRoot");
        if (FORCE_NO_XR && sceneRoot) {
          sceneRoot.setAttribute("xr-mode-ui", "enabled: false");
          sceneRoot.setAttribute("webxr", "");
          sceneRoot.setAttribute("vr-mode-ui", "enabled: false");
        }

        this.hudTitle = document.getElementById("title");
        this.hudMsg = document.getElementById("msg");
        this.hudTimer = document.getElementById("timer");
        this.hudFound = document.getElementById("found");
        this.progressBar = document.getElementById("progressBar");
        this.floatingText = document.querySelector("#floatingText a-troika-text");
        this.itemsRoot = document.getElementById("items");
        this.hud3dTitle = document.getElementById("hud3dTitle");
        this.hud3dMsg = document.getElementById("hud3dMsg");
        this.hud3dTimer = document.getElementById("hud3dTimer");
        this.hud3dRoot = document.getElementById("hud3d");
        this.hud3dBtnPrimary = document.getElementById("hud3dBtnPrimary");
        this.hud3dBtnSecondary = document.getElementById("hud3dBtnSecondary");
        this.hudCanvas = document.getElementById("hudCanvas");
        this.hudCtx = this.hudCanvas?.getContext?.("2d") || null;
        this.hudTex = null;
        this.hudButtonLabel = "開始";
        this.hud3dFallbackTitle = document.getElementById("hud3dFallbackTitle");
        this.hud3dFallbackMsg = document.getElementById("hud3dFallbackMsg");
        this.hud3dFallbackTimer = document.getElementById("hud3dFallbackTimer");
        this.hasDomOverlay = !FORCE_NO_DOM;
        this.forced3dHUD = FORCE_3D_HUD;

        this.huntRootEl = this.el;

        this.started = false;
        this.totalSeconds = 210;
        this.leftSeconds = this.totalSeconds;
        this._tickInterval = null;

        this.artifacts = [
          {
            id: "cabbage",
            name: "翠玉白菜",
            hints: ["呢件文物同植物有關。","佢係用玉石雕成，但睇落好似真菜葉咁柔軟。","綠色、似菜葉。"],
            extraIntro: "翠玉白菜係清代宮廷收藏，因為造型生動，成為故宮代表文物之一。",
            infoTitle: "翠玉白菜（清代）",
            infoBody: `• 用翠玉雕成，好似真白菜\n• 象徵清白同好彩\n• 係故宮最受歡迎文物之一`,
            speak: "你搵到翠玉白菜喇！佢用翠玉雕成，好似真白菜，象徵清白同好彩。",
            make: (el) => this.buildCabbage(el)
          },
          {
            id: "meat",
            name: "肉形石",
            hints: ["呢件文物同食物有關，但唔係食得㗎。","佢利用天然石紋做出層次，好似有肥有瘦。","粉紅加深色分層，好似一嚿叉燒。"],
            extraIntro: "肉形石展示咗古代工匠點樣善用天然石紋，令作品以假亂真。",
            infoTitle: "肉形石（清代）",
            infoBody: `• 用石頭雕到似叉燒\n• 利用石頭天然顏色做肥瘦\n• 提醒你：睇落似食物，其實係文物`,
            speak: "你答啱喇！肉形石係石頭雕成，好似叉燒咁，仲用石頭天然顏色做出肥瘦。",
            make: (el) => this.buildMeatStone(el)
          },
          {
            id: "chickenCup",
            name: "明 成化 鬥彩雞缸杯",
            hints: ["呢件文物係一件好細緻嘅瓷器。","佢用咗一種叫『鬥彩』嘅裝飾技法。","杯身上有公雞、母雞同小雞圖案。"],
            extraIntro: "鬥彩雞缸杯係明代成化朝最受推崇嘅瓷器之一。",
            infoTitle: "明 成化 鬥彩雞缸杯",
            infoBody: `• 明代成化年間嘅宮廷御用瓷器\n• 以『鬥彩』技法燒製\n• 杯身繪有公雞、母雞同小雞\n• 明末已有『一雙值錢十萬』嘅說法`,
            speak: "你搵到明成化鬥彩雞缸杯喇！佢係成化年間嘅名瓷，以鬥彩技法燒製，畫有一家雞嘅溫馨場面。",
            make: (el) => this.buildChickenCup(el)
          }
        ];

        this.decoys = [
          { id: "decoy_green_tall", name: "綠色擺設", make: (el) => this.buildDecoyGreenTall(el) },
          { id: "decoy_green_gem",  name: "綠色寶石", make: (el) => this.buildDecoyGreenGem(el) },
          { id: "decoy_meat_block", name: "肉色石塊", make: (el) => this.buildDecoyMeatBlock(el) },
          { id: "decoy_brown_stone",name: "啡色石頭", make: (el) => this.buildDecoyBrownStone(el) },
          { id: "decoy_teal_pillar",name: "假文物",   make: (el) => this.buildDecoyTealPillar(el) },
          { id: "decoy_plate",      name: "刻紋板",   make: (el) => this.buildDecoyPlate(el) }
        ];

        this.targetIndex = 0;
        this.hintLevel = 0;
        this.hintIntervalMs = 6000;
        this._hintTimeouts = [];
        this.targetStartTimeMs = 0;

        this.cameraEl = document.querySelector('a-camera');
        this.foundSet = new Set();

        const rightHand = document.getElementById("rightHand");
        rightHand.addEventListener("triggerdown", () => {
          if (!this.started) this.startGame();
        });
        window.addEventListener("click", () => {
          if (!this.started) this.startGame();
        });
        window.addEventListener("keydown", (e) => {
          if (e.code !== "Space") return;
          if (!this.started) this.startGame();
        });

        this.setReadyHUD();
        setInfoCard(false);
        primeTTS();

        const scene = this.el.sceneEl;
        if (scene) {
          scene.addEventListener('enter-vr', () => {
            // XR enter – attempt to detect DOM overlay support, but guard for session problems.
            let renderStarted = false;
            let xrTimeout = null;
            const onRenderStart = () => { renderStarted = true; if (xrTimeout) { clearTimeout(xrTimeout); xrTimeout = null; } };
            try {
              const session = scene.renderer?.xr?.getSession?.();
              const hasDom = !!(session && session.domOverlayState && session.domOverlayState.type);
              this.hasDomOverlay = FORCE_NO_DOM ? false : hasDom;
              // If developer forced 3D HUD, override DOM overlay usage
              if (this.forced3dHUD) {
                this.hasDomOverlay = false;
                this.setHUD3DVisible(true);
              } else {
                this.setHUD3DVisible(!hasDom || FORCE_NO_DOM);
              }
              if (hasDom && !FORCE_NO_DOM && !this.forced3dHUD) document.body.classList.remove("xr-nodom");
            } catch (e) {
              this.hasDomOverlay = false;
              this.setHUD3DVisible(true);
            }

            // start a short timeout: if we don't see 'renderstart' within 8s, inform user and log XR info
            scene.addEventListener('renderstart', onRenderStart, { once: true });
            xrTimeout = setTimeout(() => {
              if (!renderStarted) {
                showToast('XR 載入逾時：如使用 Quest，請嘗試在 URL 加上 ?nodom 後重試，以停用 DOM overlay');
                console.warn('[hunt-game] XR renderstart timeout; navigator.xr:', window.navigator.xr);
                try { console.warn('[hunt-game] renderer.xr:', scene.renderer?.xr); } catch(e) {}
              }
            }, 8000);

            this.centerHuntOnPlayer();
            this.spawnArtifacts();
            this.applyTargetHighlight();
          });

          scene.addEventListener('exit-vr', () => {
            this.hasDomOverlay = !FORCE_NO_DOM;
            this.setHUD3DVisible(FORCE_NO_DOM ? true : false);
            if (!FORCE_NO_DOM) document.body.classList.remove("xr-nodom");
          });
        }

        this.centerHuntOnPlayer();
        this.spawnArtifacts();
        this.applyTargetHighlight();
      },

      remove() {
        if (this._tickInterval) clearInterval(this._tickInterval);
      },

      centerHuntOnPlayer() {
        try {
          const cam = this.cameraEl;
          if (!cam || !cam.object3D) return;
          const p = new THREE.Vector3();
          cam.object3D.getWorldPosition(p);
          // Place the hunt root slightly in front of the player (so spawned items are in view)
          const forward = new THREE.Vector3();
          cam.object3D.getWorldDirection(forward);
          // move forward by ~1.6m (same as original scene default)
          const offset = forward.multiplyScalar(1.6);
          const targetPos = p.clone().add(offset);
          this.huntRootEl.object3D.position.set(targetPos.x, 0.15, targetPos.z);
        } catch (e) {}
      },

      setReadyHUD() {
        this.hudTitle.textContent = "開始：撳一下（桌機）／按 Trigger（Quest）";
        this.hudMsg.textContent = "開始後，上面會顯示目標。搵到物件就點佢，會顯示資料同讀出廣東話。";
        this.updateTimerHUD();
        this.updateProgressHUD();
        this.hudFound.textContent = "0";
        this.floatingText.setAttribute("value", "撳一下開始，搵到目標就點佢");
        this.updateHUD3D("故宮尋寶", "撳一下開始 / 按 Trigger", "⏱ 03:30｜已找到 0/3");
        this.setHUD3DVisible(!this.hasDomOverlay);
        this.configureHUD3DButtons({ state: "ready" });

        // 3D HUD buttons -> start/restart
        if (this.hud3dBtnPrimary) {
          onActivate(this.hud3dBtnPrimary, () => {
            if (this.started) {
              this.startGame(); // restart
            } else {
              this.startGame();
            }
          });
        }
      },

      startGame() {
        this.centerHuntOnPlayer();
        this.spawnArtifacts();
        this.applyTargetHighlight();

        this.started = true;
        this.leftSeconds = this.totalSeconds;
        this.targetIndex = 0;
        this.foundSet.clear();
        this.hudFound.textContent = "0";
        setInfoCard(false);

        this.resetAllItems();
        this.applyTargetHighlight();

        beep.play(784, 0.07, 0.05);
        showToast("開始！搵第一樣～");
        this.updateHUD3D("遊戲開始", "留意提示，點擊正確文物", this.hud3dTimer?.getAttribute("value") || "");
        this.configureHUD3DButtons({ state: "inGame" });

        this.startHintCycle(true);

        if (this._tickInterval) clearInterval(this._tickInterval);
        this._tickInterval = setInterval(() => {
          this.leftSeconds--;
          this.updateTimerHUD();
          this.updateProgressHUD();
          if (this.leftSeconds <= 0) this.endGame(false);
        }, 1000);
      },

      endGame(success) {
        if (this._tickInterval) clearInterval(this._tickInterval);
        this._tickInterval = null;

        const msg = success ? "完成！你係『故宮小偵探』🕵️" : "時間到～再試多次都得！";

        this.hudTitle.textContent = success ? "完成！" : "時間到";
        this.hudMsg.textContent = msg;

        this.floatingText.setAttribute("value", success ? "恭喜完成！" : "下次再挑戰～");
        showToast(success ? "🎉 完成！" : "⏱ 時間到");
        beep.play(success ? 988 : 220, 0.12, 0.06);

        this.started = false;
        setInfoCard(true, this.hudTitle.textContent, msg);

        if (success) {
          this.showCollection();
          sayWithFallback("完成喇！你已經收集咗三件文物。好叻！", true);
          this.updateHUD3D("完成！", "恭喜完成收藏！按 Trigger 重玩", this.hud3dTimer?.getAttribute("value") || "");
          this.configureHUD3DButtons({ state: "end" });
        } else {
          sayWithFallback("時間到喇，下次再挑戰。", true);
          this.updateHUD3D("時間到", "按 Trigger / click 重新開始", this.hud3dTimer?.getAttribute("value") || "");
          this.configureHUD3DButtons({ state: "end" });
        }
      },

      showCollection() {
        while (this.itemsRoot.firstChild) this.itemsRoot.removeChild(this.itemsRoot.firstChild);

        const rowY = 0.05;
        const z = -0.4;
        const xs = [-0.55, 0, 0.55];

        this.artifacts.forEach((a, i) => {
          const wrap = document.createElement("a-entity");
          wrap.setAttribute("position", `${xs[i]} ${rowY} ${z}`);
          wrap.setAttribute("rotation", "0 0 0");

          const base = document.createElement("a-cylinder");
          base.setAttribute("height", "0.06");
          base.setAttribute("radius", "0.20");
          base.setAttribute("material", "color:#111827; opacity:0.35; transparent:true; roughness:1");
          base.setAttribute("position", "0 -0.10 0");

          const body = document.createElement("a-entity");
          body.setAttribute("position", "0 0 0");
          a.make(body);

          const label = document.createElement("a-text");
          label.setAttribute("value", a.name);
          label.setAttribute("align", "center");
          label.setAttribute("width", "1.6");
          label.setAttribute("position", "0 -0.28 0");
          label.setAttribute("color", "#EAF2FF");
          label.setAttribute("opacity", "0.92");

          wrap.appendChild(body);
          wrap.appendChild(base);
          wrap.appendChild(label);
          this.itemsRoot.appendChild(wrap);
        });

        this.floatingText.setAttribute("value", "收藏展示：你已收集三件文物！");
      },

      updateTimerHUD() {
        const s = clamp(this.leftSeconds, 0, 9999);
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        this.hudTimer.textContent = `${mm}:${ss}`;
        this.updateHUD3DTimer();
        this.redrawHUDCanvas();
      },

      updateProgressHUD() {
        const found = this.foundSet.size;
        const pct = clamp((found / this.artifacts.length) * 100, 0, 100);
        this.progressBar.style.width = `${pct.toFixed(0)}%`;
        this.updateHUD3DTimer();
        this.redrawHUDCanvas();
      },

      updateHUD3D(title, msg, timerLine) {
        if (this.hud3dTitle && typeof title === "string") this.hud3dTitle.setAttribute("value", title);
        if (this.hud3dTitleAlt && typeof title === "string") this.hud3dTitleAlt.setAttribute("value", title);
        if (this.hud3dMsg && typeof msg === "string") this.hud3dMsg.setAttribute("value", msg);
        if (this.hud3dMsgAlt && typeof msg === "string") this.hud3dMsgAlt.setAttribute("value", msg);
        if (this.hud3dTimer && typeof timerLine === "string") this.hud3dTimer.setAttribute("value", timerLine);
        if (this.hud3dTimerAlt && typeof timerLine === "string") this.hud3dTimerAlt.setAttribute("value", timerLine);
        // 保險：若 troika 沒載入，也確保備援文字可見
        if (this.hud3dTitleAlt) this.hud3dTitleAlt.setAttribute("visible", true);
        if (this.hud3dMsgAlt) this.hud3dMsgAlt.setAttribute("visible", true);
        if (this.hud3dTimerAlt) this.hud3dTimerAlt.setAttribute("visible", true);
        if (this.hud3dFallbackTitle) this.hud3dFallbackTitle.setAttribute("value", title || "");
        if (this.hud3dFallbackMsg) this.hud3dFallbackMsg.setAttribute("value", msg || "");
        if (this.hud3dFallbackTimer) this.hud3dFallbackTimer.setAttribute("value", timerLine || "");
        this.redrawHUDCanvas({ title, msg, timer: timerLine });
      },

      configureHUD3DButtons({ state }) {
        if (!this.hud3dBtnPrimary || !this.hud3dBtnSecondary) return;
        if (state === "ready") {
          this.hud3dBtnPrimary.setAttribute("visible", true);
          if (this.hud3dBtnPrimaryLabel) {
            this.hud3dBtnPrimaryLabel.setAttribute("value", "開始");
            this.hud3dBtnPrimaryLabel.setAttribute("visible", true);
          }
          if (this.hud3dBtnPrimaryLabelAlt) this.hud3dBtnPrimaryLabelAlt.setAttribute("visible", true);
          this.hud3dBtnSecondary.setAttribute("visible", false);
          if (this.hud3dBtnSecondaryLabel) this.hud3dBtnSecondaryLabel.setAttribute("visible", false);
          if (this.hud3dBtnSecondaryLabelAlt) this.hud3dBtnSecondaryLabelAlt.setAttribute("visible", false);
          this.hudButtonLabel = "開始";
        } else if (state === "inGame") {
          this.hud3dBtnPrimary.setAttribute("visible", false);
          this.hud3dBtnSecondary.setAttribute("visible", false);
          if (this.hud3dBtnSecondaryLabel) this.hud3dBtnSecondaryLabel.setAttribute("visible", false);
          if (this.hud3dBtnPrimaryLabelAlt) this.hud3dBtnPrimaryLabelAlt.setAttribute("visible", false);
          if (this.hud3dBtnSecondaryLabelAlt) this.hud3dBtnSecondaryLabelAlt.setAttribute("visible", false);
          this.hudButtonLabel = "";
        } else if (state === "end") {
          this.hud3dBtnPrimary.setAttribute("visible", true);
          if (this.hud3dBtnPrimaryLabel) {
            this.hud3dBtnPrimaryLabel.setAttribute("value", "再玩一次");
            this.hud3dBtnPrimaryLabel.setAttribute("visible", true);
          }
          if (this.hud3dBtnPrimaryLabelAlt) this.hud3dBtnPrimaryLabelAlt.setAttribute("visible", true);
          this.hud3dBtnSecondary.setAttribute("visible", false);
          if (this.hud3dBtnSecondaryLabel) this.hud3dBtnSecondaryLabel.setAttribute("visible", false);
          if (this.hud3dBtnSecondaryLabelAlt) this.hud3dBtnSecondaryLabelAlt.setAttribute("visible", false);
          this.hudButtonLabel = "再玩一次";
        }
        // 確保備援文字跟著主文字顯示狀態
        if (this.hud3dBtnPrimaryLabelAlt) this.hud3dBtnPrimaryLabelAlt.setAttribute("visible", this.hud3dBtnPrimary.getAttribute("visible"));
        if (this.hud3dBtnSecondaryLabelAlt) this.hud3dBtnSecondaryLabelAlt.setAttribute("visible", this.hud3dBtnSecondary.getAttribute("visible"));
        this.redrawHUDCanvas();
      },

      setHUD3DVisible(show) {
        if (this.hud3dRoot) this.hud3dRoot.setAttribute("visible", !!show);
        document.body.classList.toggle("xr-nodom", !!show);
        if (show) this.redrawHUDCanvas();
      },

      redrawHUDCanvas(manualData = {}) {
        if (!this.hudCtx || !this.hudCanvas || !this.hud3dPanel) return;
        // lazy acquire texture
        if (!this.hudTex) {
          const mesh = this.hud3dPanel.getObject3D("mesh");
          if (mesh && mesh.material && mesh.material.map) {
            this.hudTex = mesh.material.map;
          }
        }
        const ctx = this.hudCtx;
        const w = this.hudCanvas.width;
        const h = this.hudCanvas.height;
        ctx.clearRect(0,0,w,h);
        // background panel
        ctx.fillStyle = "rgba(15,23,42,0.9)";
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = "#FFFFFF";
        // title
        const title = manualData.title || this.hud3dTitle?.getAttribute("value") || "故宮尋寶";
        ctx.font = 'bold 58px "Noto Sans TC", "PingFang TC", system-ui';
        ctx.fillStyle = "#EAF2FF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(title, w/2, h*0.28);
        // message
        const msg = manualData.msg || this.hud3dMsg?.getAttribute("value") || "按 Trigger / 點擊開始";
        ctx.font = '46px "Noto Sans TC", "PingFang TC", system-ui';
        ctx.fillStyle = "#cfe1ff";
        ctx.fillText(msg, w/2, h*0.46);
        // timer
        const timer = manualData.timer || this.hud3dTimer?.getAttribute("value") || "";
        ctx.font = '44px "Noto Sans TC", "PingFang TC", system-ui';
        ctx.fillStyle = "#9dd5ff";
        ctx.fillText(timer, w/2, h*0.62);
        // button
        const btn = manualData.btn || this.hudButtonLabel || "";
        if (btn) {
          const bw = w*0.32, bh = h*0.16;
          const bx = w*0.60 - bw/2, by = h*0.72 - bh/2;
          ctx.fillStyle = "#10b981";
          ctx.fillRect(bx, by, bw, bh);
          ctx.font = 'bold 46px "Noto Sans TC", "PingFang TC", system-ui';
          ctx.fillStyle = "#0b1220";
          ctx.fillText(btn, bx + bw/2, by + bh/2 + 4);
        }
        if (this.hudTex) this.hudTex.needsUpdate = true;
      },

      updateHUD3DTimer() {
        if (!this.hud3dTimer) return;
        const mmss = this.hudTimer?.textContent || "00:00";
        const found = this.foundSet.size;
        this.hud3dTimer.setAttribute("value", `⏱ ${mmss}｜已找到 ${found}/3`);
        this.redrawHUDCanvas();
      },

      announceTarget(opts = {}) {
        const a = this.artifacts[this.targetIndex];
        if (!a) return;
        const hint = (a.hints && a.hints[this.hintLevel]) ? a.hints[this.hintLevel] : "";
        const stageTxt = `提示 ${this.hintLevel + 1}/3：${hint}`;

        this.hudTitle.textContent = `目標：搵「${a.name}」`;
        this.hudMsg.textContent = stageTxt;
        this.floatingText.setAttribute("value", `搵：${a.name}`);
        this.updateHUD3D(`目標：${a.name}`, stageTxt, this.hud3dTimer?.getAttribute("value") || "");

        if (opts.speak === false) return;
        sayWithFallback(hint, true);
      },

      clearHintTimers() {
        if (this._hintTimeouts && this._hintTimeouts.length) {
          this._hintTimeouts.forEach(t => clearTimeout(t));
        }
        this._hintTimeouts = [];
      },

      startHintCycle(speakNow = false) {
        this.clearHintTimers();
        this.hintLevel = 0;
        this.targetStartTimeMs = performance.now();
        this.announceTarget({ speak: speakNow });

        this._hintTimeouts.push(setTimeout(() => {
          if (!this.started) return;
          this.hintLevel = 1;
          this.announceTarget({ speak: true });
        }, this.hintIntervalMs));

        this._hintTimeouts.push(setTimeout(() => {
          if (!this.started) return;
          this.hintLevel = 2;
          this.announceTarget({ speak: true });
        }, this.hintIntervalMs * 2));
      },

      spawnArtifacts() {
        while (this.itemsRoot.firstChild) this.itemsRoot.removeChild(this.itemsRoot.firstChild);

        const makeRingSpots = (count, rMin = 1.35, rMax = 2.65, y = 0.0) => {
          const out = [];
          const base = Math.random() * Math.PI * 2;
          for (let i = 0; i < count; i++) {
            const a = base + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
            const r = rMin + Math.random() * (rMax - rMin);
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const rotY = (-a * 180 / Math.PI) + 90;
            out.push({ position: `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`, rotation: `0 ${rotY.toFixed(0)} 0` });
          }
          return out;
        };

        const pool = [
          ...this.artifacts.map(a => ({ kind: "artifact", ...a })),
          ...this.decoys.map(d => ({ kind: "decoy", ...d }))
        ];

        const spots = makeRingSpots(pool.length, 1.35, 2.65, 0.0);
        shuffleInPlace(spots);

        console.log('[spawnArtifacts] pool length:', pool.length);
        pool.forEach((a, i) => {
          const wrapper = document.createElement("a-entity");
          wrapper.setAttribute("id", `item_${a.id}`);

          const s = spots[i] || { position: "0 0 0", rotation: "0 0 0" };
          wrapper.setAttribute("position", s.position);
          wrapper.setAttribute("rotation", s.rotation);
          wrapper.setAttribute("class", "artifact");

          const base = document.createElement("a-cylinder");
          base.setAttribute("height", "0.08");
          base.setAttribute("radius", a.kind === "decoy" ? "0.20" : "0.22");
          base.setAttribute("material", "color:#111827; opacity:0.35; transparent:true; roughness:1");
          base.setAttribute("position", "0 -0.12 0");

          const body = document.createElement("a-entity");
          body.setAttribute("class", "artifactBody");
          body.setAttribute("position", "0 0.03 0");

          a.make(body);

          console.log('[spawnArtifacts] placed', a.id, 'at', s.position);

          const hit = body.querySelector(".artifactHit") || body;
          hit.classList.add("clickable");
          hit.setAttribute("data-id", a.id);

          onActivate(hit, () => this.onPick(a.id));

          wrapper.appendChild(body);
          wrapper.appendChild(base);
          this.itemsRoot.appendChild(wrapper);
        });
      },

      resetAllItems() {
        this.artifacts.forEach(a => {
          const el = document.querySelector(`#item_${a.id} .artifactHit`);
          if (!el) return;
          el.setAttribute("data-found", "0");
          el.removeAttribute("animation__hint");
          el.removeAttribute("animation__pulse");
        });
      },

      applyTargetHighlight() {
        this.artifacts.forEach(a => {
          const el = document.querySelector(`#item_${a.id} .artifactHit`);
          if (!el) return;
          el.removeAttribute("animation__hint");
        });

        const target = this.artifacts[this.targetIndex];
        if (!target) return;
        const el = document.querySelector(`#item_${target.id} .artifactHit`);
        if (!el) return;

        el.setAttribute("animation__hint", "property: position; dir: alternate; dur: 900; loop: true; to: 0 0.07 0; easing: easeInOutSine;");
      },

      onPick(id) {
        if (speakBusy) {
          showToast("請先聽完講解，再操作");
          return;
        }
        if (!this.started) {
          this.startGame();
          return;
        }

        const target = this.artifacts[this.targetIndex];
        if (!target) return;

        if (id !== target.id) {
          const getWorldPos = (artifactId) => {
            const wrap = document.getElementById(`item_${artifactId}`);
            if (!wrap || !wrap.object3D) return null;
            const v = new THREE.Vector3();
            wrap.object3D.getWorldPosition(v);
            return v;
          };

          const pWrong = getWorldPos(id);
          const pTarget = getWorldPos(target.id);
          let dist = 999;
          if (pWrong && pTarget) dist = pWrong.distanceTo(pTarget);

          let msg = "唔係呢件～再搵下！";
          let speak = "唔係呢件，再搵下！";
          let tone = 220;

          if (dist < 0.75) {
            msg = "你好近喇！留意下細節～";
            speak = "你好近喇，留意下細節。";
            tone = 392;
          } else if (dist < 1.6) {
            msg = "方向啱啱好，但仲未係。";
            speak = "方向啱，但仲未係。";
            tone = 294;
          } else {
            msg = "呢件同目標無關，轉個方向望下。";
            speak = "呢件同目標無關，轉個方向望下。";
            tone = 196;
          }

          showToast(msg);
          beep.play(tone, 0.09, 0.05);
          sayWithFallback(speak, false);
          return;
        }

        if (this.foundSet.has(id)) {
          showToast("呢件你已經搵到喇～");
          beep.play(520, 0.05, 0.03);
          return;
        }

        this.foundSet.add(id);
        this.hudFound.textContent = String(this.foundSet.size);
        this.updateProgressHUD();

        const el = document.querySelector(`#item_${id} .artifactHit`);
        if (el) {
          el.setAttribute("data-found", "1");
          el.setAttribute("animation__pulse", "property: scale; dir: alternate; dur: 180; loop: true; to: 1.08 1.08 1.08; easing: easeOutQuad;");
          setTimeout(() => el.removeAttribute("animation__pulse"), 700);
        }

        const dtSec = (performance.now() - this.targetStartTimeMs) / 1000;
        let praise = "";
        if (dtSec <= 6.5) praise = "嘩！你搵得超快！";
        else if (dtSec <= 12) praise = "好叻！搵得好快！";

        showToast(praise ? `搵到喇！${praise}` : "搵到喇！");
        beep.play(988, 0.09, 0.06);

        setInfoCard(true, target.infoTitle, target.infoBody);

        if (this.foundSet.size >= this.artifacts.length) {
          speakQueue([target.speak, praise, `你搵到${target.name}喇！`], () => this.endGame(true));
          return;
        }

        const nextArtifact = this.artifacts[clamp(this.targetIndex + 1, 0, this.artifacts.length - 1)];

        this.targetIndex = clamp(this.targetIndex + 1, 0, this.artifacts.length - 1);
        this.applyTargetHighlight();
        this.clearHintTimers();
        this.hintLevel = 0;

        speakQueue([
          target.speak,
          praise,
          `你搵到${target.name}喇！`,
          `下一件文物簡介：${nextArtifact.extraIntro || ''}`,
          "準備好未？下一件開始喇。"
        ], () => {
          this.startHintCycle(true);
        });
      },

      // GLB builders
      buildCabbage(root) { this.spawnGLB(root, "#mdl-cabbage", { targetHeight: 0.28, yOffset: 0.00, rotY: 180, tint: "#4ade80" }); },
      buildMeatStone(root) { this.spawnGLB(root, "#mdl-meat", { targetHeight: 0.25, yOffset: 0.00, rotY: 180, tint: "#fb7185" }); },
      buildChickenCup(root) { this.spawnGLB(root, "#mdl-chicken", { targetHeight: 0.23, yOffset: 0.00, rotY: 180, tint: "#e5e7eb" }); },

      // Decoys
      buildDecoyGreenTall(root) {
        if (this.trySpawnGLB(root, "#mdl-fake01", { targetHeight: 0.20, yOffset: 0.00, rotY: 180 })) return;
        const stem = document.createElement("a-cylinder");
        stem.setAttribute("height", "0.26");
        stem.setAttribute("radius", "0.06");
        stem.setAttribute("material", "color:#22c55e; roughness:0.7;");
        stem.setAttribute("position", "0 0.06 0");
        const top = document.createElement("a-sphere");
        top.setAttribute("class", "artifactHit");
        top.setAttribute("radius", "0.10");
        top.setAttribute("material", "color:#34d399; roughness:0.6;");
        top.setAttribute("position", "0 0.18 0");
        root.appendChild(stem); root.appendChild(top);
      },

      buildDecoyGreenGem(root) {
        if (this.trySpawnGLB(root, "#mdl-fake02", { targetHeight: 0.18, yOffset: 0.00, rotY: 180 })) return;
        const gem = document.createElement("a-octahedron");
        gem.setAttribute("class", "artifactHit");
        gem.setAttribute("radius", "0.12");
        gem.setAttribute("material", "color:#16a34a; roughness:0.25; metalness:0.25;");
        gem.setAttribute("animation__spin", "property: rotation; to: 0 360 0; loop: true; dur: 2600; easing: linear;");
        root.appendChild(gem);
      },

      buildDecoyMeatBlock(root) {
        if (this.trySpawnGLB(root, "#mdl-fake03", { targetHeight: 0.18, yOffset: 0.00, rotY: 180 })) return;
        const block = document.createElement("a-box");
        block.setAttribute("class", "artifactHit");
        block.setAttribute("width", "0.20");
        block.setAttribute("height", "0.12");
        block.setAttribute("depth", "0.18");
        block.setAttribute("material", "color:#fb7185; roughness:0.85;");
        const stripe = document.createElement("a-box");
        stripe.setAttribute("width", "0.20");
        stripe.setAttribute("height", "0.05");
        stripe.setAttribute("depth", "0.18");
        stripe.setAttribute("position", "0 0.06 0");
        stripe.setAttribute("material", "color:#78350f; roughness:0.9; opacity:0.95; transparent:true;");
        root.appendChild(block); root.appendChild(stripe);
      },

      buildDecoyBrownStone(root) {
        if (this.trySpawnGLB(root, "#mdl-fake04", { targetHeight: 0.18, yOffset: 0.00, rotY: 180 })) return;
        const stone = document.createElement("a-dodecahedron");
        stone.setAttribute("class", "artifactHit");
        stone.setAttribute("radius", "0.13");
        stone.setAttribute("material", "color:#a16207; roughness:1.0;");
        root.appendChild(stone);
      },

      buildDecoyTealPillar(root) {
        const fakeIds = ["#mdl-fake01", "#mdl-fake02", "#mdl-fake03", "#mdl-fake04"];
        const pick = fakeIds[Math.floor(Math.random() * fakeIds.length)];
        if (this.trySpawnGLB(root, pick, { targetHeight: 0.22, yOffset: 0.00, rotY: 180 })) return;
        const cyl = document.createElement("a-cylinder");
        cyl.setAttribute("class", "artifactHit");
        cyl.setAttribute("radius", "0.10");
        cyl.setAttribute("height", "0.26");
        cyl.setAttribute("material", "color:#0d9488; roughness:0.8; metalness:0.1;");
        root.appendChild(cyl);
      },

      buildDecoyPlate(root) {
        const plate2 = document.createElement("a-plane");
        plate2.setAttribute("class", "artifactHit");
        plate2.setAttribute("width", "0.20");
        plate2.setAttribute("height", "0.20");
        plate2.setAttribute("material", "color:#e0f2fe; opacity:0.18; transparent:true;");
        plate2.setAttribute("position", "0 0.06 0.02");
        const mark2 = document.createElement("a-text");
        mark2.setAttribute("value", "?");
        mark2.setAttribute("align", "center");
        mark2.setAttribute("width", "0.8");
        mark2.setAttribute("position", "0 0.06 0.03");
        mark2.setAttribute("color", "#EAF2FF");
        mark2.setAttribute("opacity", "0.6");
        root.appendChild(plate2); root.appendChild(mark2);
      },

      // GLB helper
      trySpawnGLB(root, assetId, opts) {
        const asset = document.querySelector(assetId);
        if (!asset) return false;
        const src = asset.getAttribute("src");
        if (!src) return false;
        this.spawnGLB(root, assetId, opts);
        return true;
      },

      spawnGLB(root, assetId, { targetHeight = 0.20, yOffset = 0.0, rotY = 180, tint = "#cbd5e1" } = {}) {
        const model = document.createElement("a-gltf-model");
        model.setAttribute("src", assetId);
        model.setAttribute("class", "artifactHit");
        model.setAttribute("rotation", `0 ${rotY} 0`);
        model.setAttribute("position", `0 ${yOffset} 0`);
        model.setAttribute("shadow", "cast: false; receive: false");

        console.log('[spawnGLB] appending model', assetId);
        model.addEventListener("model-loaded", () => {
          console.log('[spawnGLB] model-loaded', assetId);
          try {
            const obj = model.getObject3D("mesh");
            if (!obj) return;

            obj.traverse((n) => {
              if (!n.isMesh) return;
              n.frustumCulled = false;
              const m = n.material;
              if (!m) return;
              m.side = THREE.DoubleSide;
            });

            obj.traverse((n) => {
              if (!n.isMesh) return;
              const m = n.material;
              if (!m) return;

              if (typeof m.metalness === 'number') m.metalness = 0.0;
              if (typeof m.roughness === 'number') m.roughness = Math.max(m.roughness, 0.7);

              if (!m.map && m.color) {
                try { m.color.set(tint); } catch (e) {}
              }

              if (m.emissive) {
                m.emissive.setHex(0x111111);
                m.emissiveIntensity = 0.22;
              }

              m.needsUpdate = true;
            });

            obj.position.set(0, 0, 0);
            obj.scale.set(1, 1, 1);

            model.object3D.updateWorldMatrix(true, true);
            obj.updateWorldMatrix(true, true);

            const box0 = new THREE.Box3().setFromObject(obj);
            const size0 = new THREE.Vector3();
            box0.getSize(size0);
            const h0 = Math.max(size0.y, 0.0001);
            const s = targetHeight / h0;

            model.object3D.scale.set(s, s, s);
            model.object3D.updateWorldMatrix(true, true);
            obj.updateWorldMatrix(true, true);

            const box1 = new THREE.Box3().setFromObject(obj);
            const center1 = new THREE.Vector3();
            box1.getCenter(center1);
            obj.position.sub(center1);
            obj.updateWorldMatrix(true, true);

            const box2 = new THREE.Box3().setFromObject(obj);
            const minY = box2.min.y;
            obj.position.y -= minY;
            obj.updateWorldMatrix(true, true);

            obj.traverse((n) => {
              if (!n.isMesh) return;
              const m = n.material;
              if (!m) return;

              if (typeof m.metalness === 'number') m.metalness = 0.0;
              if (typeof m.roughness === 'number') m.roughness = Math.max(m.roughness, 0.7);

              if (m.color && m.color.getHexString && m.color.getHexString() === '000000') {
                m.color.setHex(0x777777);
              }

              if (m.emissive) {
                m.emissive.setHex(0x111111);
                m.emissiveIntensity = 0.22;
              }

              m.needsUpdate = true;
            });
          } catch (err) {
            console.warn('[spawnGLB] model post-process failed:', err);
          }
        });

        model.addEventListener('model-error', (ev) => {
          console.warn('[spawnGLB] model-error', assetId, ev);
          showToast('⚠️ 有模型載入失敗：檢查 3dModel/ 路徑同檔名大小寫');

          // Fallback: create a visible placeholder so user can confirm spawn worked
          try {
            const placeholder = document.createElement('a-box');
            placeholder.setAttribute('class', 'artifactHit');
            placeholder.setAttribute('width', '0.28');
            placeholder.setAttribute('height', '0.18');
            placeholder.setAttribute('depth', '0.20');
            placeholder.setAttribute('material', 'color:#f97316; roughness:0.6; metalness:0.05;');
            placeholder.setAttribute('position', `0 ${yOffset + 0.02} 0`);
            placeholder.setAttribute('rotation', `0 ${rotY} 0`);
            root.appendChild(placeholder);
            console.log('[spawnGLB] appended placeholder for', assetId);
          } catch (err) {
            console.error('[spawnGLB] placeholder creation failed', err);
          }
        });

        root.appendChild(model);
      }
    });

    console.log('[boot] hunt-game script loaded OK');
