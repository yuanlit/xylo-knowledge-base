/* The opaque extension sandbox cannot use persistent storage. */
try {
  window.localStorage.getItem("OML2D_STATUS");
} catch {
  const values = new Map();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
    },
  });
}

const send = (status) => parent.postMessage({ type: "xylo:companion-status", status }, "*");
async function initialize() {
try {
  const id = new URLSearchParams(location.search).get("character");
  const character = window.XYLO_COMPANION_CHARACTERS.find((item) => item.id === id) || window.XYLO_COMPANION_CHARACTERS[0];
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `./companion/model-${character.id}.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Unable to load character: ${character.id}`));
    document.head.append(script);
  });
  const companion = window.OML2D.loadOml2d({
    parentElement: document.body,
    dockedPosition: "right",
    mobileDisplay: true,
    sayHello: false,
    transitionTime: 300,
    initialStatus: "active",
    stageStyle: { width: 220, height: 300, backgroundColor: "transparent" },
    menus: { disable: true },
    statusBar: { disable: true },
    tips: { style: { display: "none" }, idleTips: { wordTheDay: false, message: [] }, copyTips: { message: [] } },
    models: [{
      name: character.name,
      path: window.XYLO_COMPANION_MODEL,
      scale: 0.14,
      position: [0, 0],
      mobileScale: 0.14,
      mobilePosition: [0, 0],
      stageStyle: { width: 220, height: 300 },
      mobileStageStyle: { width: 220, height: 300 },
      volume: 0,
      motionPreloadStrategy: "IDLE",
    }],
  });
  const fitModel = () => {
    const model = companion.models.model;
    companion.setModelScale(1);
    const bounds = model.getLocalBounds();
    const padding = 10;
    const top = 40;
    const width = window.innerWidth - padding * 2;
    const height = window.innerHeight - top - padding;
    const scale = Math.min(width / bounds.width, height / bounds.height);
    companion.setModelScale(scale);
    companion.setModelPosition({
      x: padding + (width - bounds.width * scale) / 2 - bounds.x * scale,
      y: top + (height - bounds.height * scale) / 2 - bounds.y * scale,
    });
  };
  companion.onLoad((status) => {
    if (status !== "success") { send(status); return; }
    // The SDK applies its configured transform after emitting the load event.
    requestAnimationFrame(() => {
      fitModel();
      send("success");
      companion.stageSlideIn();
    });
  });
  window.addEventListener("resize", () => {
    if (companion.models.model?.internalModel) fitModel();
  });
  // The SDK stage lives entirely inside this disposable sandbox document.
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.type !== "xylo:companion-pointer") return;
    if (!Number.isFinite(event.data.x) || !Number.isFinite(event.data.y)) return;
    document.dispatchEvent(new PointerEvent("pointermove", {
      clientX: event.data.x,
      clientY: event.data.y,
      pointerType: "mouse",
      bubbles: true,
    }));
  });
} catch (error) {
  console.error("Live2D initialization failed", error);
  send("fail");
}
}
initialize();
