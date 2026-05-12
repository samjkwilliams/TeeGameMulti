class SkySystem {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.("2d", { alpha: false }) || null;
    this.qualityRequest = options.quality || "auto";
    this.quality = "off";
    this.webgl2Supported = SkySystem.detectWebGL2();
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.time = 0;
    this.lastRenderTime = -1;
    this.presetKey = "";
    this.dirty = true;
    this.enhanced = null;
    this.cloudLayer = document.createElement("canvas");
    this.cloudLayerCtx = this.cloudLayer.getContext("2d");
    this.cloudMask = document.createElement("canvas");
    this.cloudMaskCtx = this.cloudMask.getContext("2d");
    this.cloudCacheKey = "";

    if (!this.canvas || !this.ctx) return;
    this.quality = this.resolveQuality(this.qualityRequest);
    if (this.quality === "enhanced") {
      this.enhanced = this.createEnhancedRenderer();
      if (!this.enhanced) this.quality = "simple";
    }
  }

  static detectWebGL2() {
    try {
      const test = document.createElement("canvas");
      return !!test.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power"
      });
    } catch {
      return false;
    }
  }

  resolveQuality(quality) {
    if (quality === "off") return "off";
    if (quality === "simple") return "simple";
    if (quality === "enhanced") return this.webgl2Supported ? "enhanced" : "simple";
    return "simple";
  }

  setQuality(quality) {
    this.qualityRequest = quality;
    this.quality = this.resolveQuality(quality);
    if (this.quality === "enhanced" && !this.enhanced) {
      this.enhanced = this.createEnhancedRenderer();
      if (!this.enhanced) this.quality = "simple";
    }
    this.dirty = true;
  }

  resize(width, height) {
    if (!this.ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const renderRatio = this.quality === "enhanced" ? Math.min(ratio, 1.35) : Math.min(ratio, 1.15);
    const nextWidth = Math.max(2, Math.floor(width * renderRatio));
    const nextHeight = Math.max(2, Math.floor(height * renderRatio));
    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
      this.width = width;
      this.height = height;
      this.pixelRatio = renderRatio;
      this.ctx.setTransform(renderRatio, 0, 0, renderRatio, 0, 0);
      this.dirty = true;
    }
    if (this.enhanced) this.resizeEnhanced();
  }

  setPreset(preset) {
    const key = preset?.key || "";
    if (key !== this.presetKey) {
      this.presetKey = key;
      this.dirty = true;
    }
  }

  render(preset, nowSeconds) {
    if (!this.ctx || this.quality === "off" || !preset) return false;
    this.setPreset(preset);
    this.time = nowSeconds || 0;

    // Performance mode: the sky is now rendered only when the hole/preset or
    // canvas size changes. This removes the constant 18-24fps sky redraw that
    // was costing smoothness in Chrome, while preserving the painted sky look.
    if (!this.dirty && this.lastRenderTime >= 0) {
      return true;
    }

    if (this.quality === "enhanced" && this.enhanced) {
      try {
        this.renderEnhanced(preset);
        this.lastRenderTime = this.time;
        this.dirty = false;
        return true;
      } catch {
        this.quality = "simple";
        this.enhanced = null;
      }
    }

    try {
      this.renderSimple(preset);
      this.lastRenderTime = this.time;
      this.dirty = false;
      return true;
    } catch {
      this.quality = "off";
      return false;
    }
  }

  renderSimple(preset) {
    const { ctx, width, height } = this;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    preset.gradient.forEach(([stop, color]) => gradient.addColorStop(stop, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const sun = preset.sunDirection || { x: 0.52, y: 0.82 };
    const glow = ctx.createRadialGradient(width * sun.x, height * sun.y, 0, width * sun.x, height * sun.y, height * 0.72);
    glow.addColorStop(0, preset.horizonGlow || "rgb(255 220 150 / 0.24)");
    glow.addColorStop(0.48, preset.hazeColor || "rgb(255 255 255 / 0.08)");
    glow.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    if (preset.haze > 0) {
      const haze = ctx.createLinearGradient(0, height * 0.36, 0, height);
      haze.addColorStop(0, "rgb(255 255 255 / 0)");
      haze.addColorStop(0.72, preset.hazeColor || "rgb(255 255 255 / 0.08)");
      haze.addColorStop(1, preset.hazeColor || "rgb(255 255 255 / 0.08)");
      ctx.globalAlpha = preset.haze;
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    this.drawSimpleClouds(preset);
    this.drawSimpleAtmosphere(preset);
  }

  drawSimpleClouds(preset) {
    const { ctx, width, height, time } = this;
    const density = preset.cloudDensity;
    if (density <= 0.02) return;

    const layer = this.getCloudLayer(preset);
    if (!layer) return;

    const drift = Math.sin(time * preset.cloudSpeed * 0.9) * width * 0.1;
    const drawW = width * 2.35;
    const drawH = height;
    const offset = -width * 0.68 + drift;
    ctx.save();
    ctx.globalCompositeOperation = preset.mood === "stormy" ? "source-over" : "screen";
    ctx.globalAlpha = preset.mood === "stormy" ? 1 : 0.96;
    ctx.drawImage(layer, offset, 0, drawW, drawH);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = preset.mood === "stormy" ? 0.3 : 0.18;
    const secondOffset = -width * 0.78 - drift * 0.42;
    ctx.drawImage(layer, secondOffset, height * 0.015, drawW * 1.08, drawH);
    ctx.restore();
  }

  getCloudLayer(preset) {
    if (!this.cloudLayerCtx || !this.cloudMaskCtx) return null;
    const layerWidth = Math.max(360, Math.min(760, Math.round(this.width * 1.05)));
    const layerHeight = Math.max(160, Math.min(360, Math.round(this.height * 0.58)));
    const cacheKey = [
      preset.key,
      layerWidth,
      layerHeight,
      preset.cloudDensity,
      preset.cloudSoftness,
      preset.cloudBand,
      preset.mood
    ].join(":");
    if (cacheKey === this.cloudCacheKey) return this.cloudLayer;

    this.cloudLayer.width = layerWidth;
    this.cloudLayer.height = layerHeight;
    this.cloudMask.width = layerWidth;
    this.cloudMask.height = layerHeight;
    this.generateCloudMask(preset, layerWidth, layerHeight);
    this.tintCloudLayer(preset, layerWidth, layerHeight);
    this.cloudCacheKey = cacheKey;
    return this.cloudLayer;
  }

  generateCloudMask(preset, width, height) {
    const image = this.cloudMaskCtx.createImageData(width, height);
    const data = image.data;
    const density = preset.cloudDensity;
    const softness = preset.cloudSoftness;
    const bandCenter = preset.cloudBand;
    const bandSpread = 0.035 + softness * 0.22;
    const seed = preset.seed * 19.37 + (preset.mood === "stormy" ? 7.1 : 0);
    const threshold = 0.55 - density * 0.2;
    const edge = 0.075 + softness * 0.08;

    for (let y = 0; y < height; y += 1) {
      const v = y / Math.max(1, height - 1);
      const band = Math.exp(-Math.pow((v - bandCenter) / bandSpread, 2));
      const lowShelf = Math.exp(-Math.pow((v - (bandCenter + softness * 0.18)) / (bandSpread * 1.8), 2)) * 0.38;
      const verticalFade = SkySystem.smoothstep(0.02, 0.14, v) * (1 - SkySystem.smoothstep(0.78, 1, v));
      for (let x = 0; x < width; x += 1) {
        const u = x / Math.max(1, width - 1);
        const warpX = SkySystem.fbm2(u * 1.2 + seed, v * 2.2 - seed, 4) - 0.5;
        const warpY = SkySystem.fbm2(u * 1.6 - seed * 0.2, v * 2.0 + seed, 4) - 0.5;
        const wu = u + warpX * 0.18;
        const wv = v + warpY * 0.12;
        const broad = SkySystem.fbm2(wu * 2.9 + seed, wv * 4.6 - seed * 0.27, 5);
        const weather = SkySystem.fbm2(wu * 1.15 - seed * 0.13, wv * 1.8 + seed, 4);
        const erosion = SkySystem.fbm2(wu * 8.2 + seed * 0.41, wv * 9.6 - seed, 4);
        const wisps = SkySystem.fbm2(wu * 17.0 - seed, wv * 12.5 + seed * 0.23, 3);
        const sheet = broad * 0.56 + weather * 0.3 + erosion * 0.18 - wisps * 0.16;
        const banded = sheet * (band * 1.18 + lowShelf) + band * (0.12 + density * 0.2);
        const cloud = Math.pow(SkySystem.smoothstep(threshold, threshold + edge, banded), 1.22);
        const breakup = SkySystem.smoothstep(0.22, 0.78, weather * 0.8 + erosion * 0.3);
        const alpha = Math.round(255 * Math.min(0.98, cloud * breakup * verticalFade * (0.58 + density * 1.35)));
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = alpha;
      }
    }
    this.cloudMaskCtx.putImageData(image, 0, 0);
  }

  tintCloudLayer(preset, width, height) {
    const ctx = this.cloudLayerCtx;
    ctx.clearRect(0, 0, width, height);

    const blur = Math.max(5, Math.round(7 + preset.cloudSoftness * 22));
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(this.cloudMask, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-in";
    const light = ctx.createLinearGradient(width * preset.sunDirection.x, 0, width * (1 - preset.sunDirection.x), height);
    light.addColorStop(0, preset.skyLightColor || preset.cloudLight);
    light.addColorStop(0.42, preset.cloudLight);
    light.addColorStop(0.62, preset.cloudMid);
    light.addColorStop(1, preset.cloudShade);
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = preset.mood === "stormy" ? 0.14 : 0.32;
    ctx.filter = "blur(2px)";
    ctx.fillStyle = preset.skyLightColor || preset.cloudLight;
    ctx.drawImage(this.cloudMask, -width * 0.026 * Math.sign(preset.sunDirection.x - 0.5 || 1), -height * 0.022);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    const underside = ctx.createLinearGradient(0, height * Math.max(0, preset.cloudBand - 0.08), 0, height * Math.min(1, preset.cloudBand + preset.cloudSoftness * 0.42));
    underside.addColorStop(0, "rgb(255 255 255 / 0)");
    underside.addColorStop(1, preset.cloudShade);
    ctx.globalAlpha = preset.mood === "stormy" ? 0.78 : 0.44;
    ctx.fillStyle = underside;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = preset.mood === "stormy" ? 0.2 : 0.13;
    ctx.filter = "blur(3px)";
    ctx.fillStyle = preset.cloudShade;
    ctx.drawImage(this.cloudMask, width * 0.018 * Math.sign(preset.sunDirection.x - 0.5 || 1), height * 0.028);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = preset.mood === "stormy" ? "source-over" : "screen";
    ctx.globalAlpha = preset.mood === "stormy" ? 0.18 : 0.23;
    ctx.filter = "blur(1.5px)";
    ctx.drawImage(this.cloudMask, -width * 0.018, -height * 0.012);
    ctx.restore();
  }

  drawSimpleAtmosphere(preset) {
    if (preset.mood !== "night" && preset.mood !== "stormy") return;
    const { ctx, width, height } = this;
    ctx.save();
    if (preset.mood === "night") {
      ctx.fillStyle = "rgb(255 248 232 / 0.72)";
      for (let i = 0; i < 14; i += 1) {
        const sx = SkySystem.fract((i + 3) * 0.371);
        const sy = SkySystem.fract((i + 7) * 0.219) * 0.28 + 0.04;
        const r = 0.55 + SkySystem.fract(i * 0.817) * 0.8;
        ctx.globalAlpha = 0.22 + r * 0.18;
        ctx.beginPath();
        ctx.arc(width * sx, height * sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const shelf = ctx.createRadialGradient(width * 0.5, height * 0.2, 0, width * 0.5, height * 0.2, height * 0.45);
      shelf.addColorStop(0, "rgb(10 16 24 / 0.22)");
      shelf.addColorStop(1, "rgb(10 16 24 / 0)");
      ctx.fillStyle = shelf;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  createEnhancedRenderer() {
    try {
      // Future volumetric work could plug in here by replacing this tiny
      // single-pass sky shader with a dedicated offscreen renderer. Keep it
      // isolated from gameplay so failed experiments can fall back to 2D.
      const enhancedCanvas = document.createElement("canvas");
      const gl = enhancedCanvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power"
      });
      if (!gl) return null;

      const vertexSource = `#version 300 es
        precision highp float;
        out vec2 vUv;
        void main() {
          vec2 pos = gl_VertexID == 0 ? vec2(-1.0, -1.0) : gl_VertexID == 1 ? vec2(3.0, -1.0) : vec2(-1.0, 3.0);
          vUv = pos * 0.5 + 0.5;
          gl_Position = vec4(pos, 0.0, 1.0);
        }`;

      const fragmentSource = `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 outColor;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uGlow;
        uniform vec3 uHorizon;
        uniform vec3 uCloudLight;
        uniform vec3 uCloudShade;
        uniform float uDensity;
        uniform float uSoftness;
        uniform float uSpeed;
        uniform float uBand;
        uniform float uHaze;
        uniform float uTime;
        uniform vec2 uSun;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += noise(p) * a;
            p = p * 2.03 + vec2(17.2, 9.4);
            a *= 0.52;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv;
          vec3 sky = mix(uHorizon, uGlow, smoothstep(0.0, 0.45, uv.y));
          sky = mix(sky, uMid, smoothstep(0.32, 0.72, uv.y));
          sky = mix(sky, uTop, smoothstep(0.65, 1.0, uv.y));
          float sun = 1.0 - smoothstep(0.0, 0.72, distance(uv, uSun));
          sky += sun * uHorizon * (0.25 + uHaze * 0.25);

          float band = exp(-pow((uv.y - uBand) / max(0.035, uSoftness), 2.0));
          vec2 p = vec2(uv.x * 2.0 + uTime * uSpeed * 0.06, uv.y * 3.2);
          float n = fbm(p * 2.0) * 0.72 + fbm(p * 4.0 + 8.0) * 0.28;
          float cloud = smoothstep(1.0 - uDensity * 0.52, 1.0, n * band + band * 0.22);
          cloud *= 0.24 + uDensity * 0.44;
          vec3 lit = mix(uCloudShade, uCloudLight, smoothstep(0.25, 0.92, uv.y + sun * 0.4));
          sky = mix(sky, lit, cloud);

          float haze = smoothstep(0.58, 0.0, uv.y) * uHaze * 0.18;
          sky = mix(sky, uHorizon, haze);
          outColor = vec4(sky, 1.0);
        }`;

      const program = this.createProgram(gl, vertexSource, fragmentSource);
      if (!program) return null;
      const vao = gl.createVertexArray();
      return {
        canvas: enhancedCanvas,
        gl,
        program,
        vao,
        uniforms: {
          top: gl.getUniformLocation(program, "uTop"),
          mid: gl.getUniformLocation(program, "uMid"),
          glow: gl.getUniformLocation(program, "uGlow"),
          horizon: gl.getUniformLocation(program, "uHorizon"),
          cloudLight: gl.getUniformLocation(program, "uCloudLight"),
          cloudShade: gl.getUniformLocation(program, "uCloudShade"),
          density: gl.getUniformLocation(program, "uDensity"),
          softness: gl.getUniformLocation(program, "uSoftness"),
          speed: gl.getUniformLocation(program, "uSpeed"),
          band: gl.getUniformLocation(program, "uBand"),
          haze: gl.getUniformLocation(program, "uHaze"),
          time: gl.getUniformLocation(program, "uTime"),
          sun: gl.getUniformLocation(program, "uSun")
        }
      };
    } catch {
      return null;
    }
  }

  resizeEnhanced() {
    if (!this.enhanced) return;
    const scale = 0.55;
    const w = Math.max(2, Math.floor(this.canvas.width * scale));
    const h = Math.max(2, Math.floor(this.canvas.height * scale));
    if (this.enhanced.canvas.width !== w || this.enhanced.canvas.height !== h) {
      this.enhanced.canvas.width = w;
      this.enhanced.canvas.height = h;
      this.dirty = true;
    }
  }

  renderEnhanced(preset) {
    const { gl, program, vao, uniforms, canvas } = this.enhanced;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    this.uniformColor(gl, uniforms.top, preset.shaderColors.top);
    this.uniformColor(gl, uniforms.mid, preset.shaderColors.mid);
    this.uniformColor(gl, uniforms.glow, preset.shaderColors.glow);
    this.uniformColor(gl, uniforms.horizon, preset.shaderColors.horizon);
    this.uniformColor(gl, uniforms.cloudLight, preset.shaderColors.cloudLight);
    this.uniformColor(gl, uniforms.cloudShade, preset.shaderColors.cloudShade);
    gl.uniform1f(uniforms.density, preset.cloudDensity);
    gl.uniform1f(uniforms.softness, preset.cloudSoftness);
    gl.uniform1f(uniforms.speed, preset.cloudSpeed);
    gl.uniform1f(uniforms.band, 1 - preset.cloudBand);
    gl.uniform1f(uniforms.haze, preset.haze);
    gl.uniform1f(uniforms.time, this.time);
    gl.uniform2f(uniforms.sun, preset.sunDirection.x, 1 - preset.sunDirection.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    this.ctx.drawImage(canvas, 0, 0, this.width, this.height);
  }

  createProgram(gl, vertexSource, fragmentSource) {
    const vertex = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  }

  uniformColor(gl, location, color) {
    gl.uniform3f(location, color[0], color[1], color[2]);
  }

  static colorToRgb(color) {
    const scratch = SkySystem.colorScratch || (SkySystem.colorScratch = document.createElement("canvas").getContext("2d"));
    scratch.fillStyle = color;
    const value = scratch.fillStyle;
    const hex = value.startsWith("#") ? value.slice(1) : "ffffff";
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return [
      parseInt(full.slice(0, 2), 16) / 255,
      parseInt(full.slice(2, 4), 16) / 255,
      parseInt(full.slice(4, 6), 16) / 255
    ];
  }

  static fract(value) {
    return value - Math.floor(value);
  }

  static smoothstep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  static hash2(x, y) {
    return SkySystem.fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
  }

  static valueNoise2(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = SkySystem.hash2(ix, iy);
    const b = SkySystem.hash2(ix + 1, iy);
    const c = SkySystem.hash2(ix, iy + 1);
    const d = SkySystem.hash2(ix + 1, iy + 1);
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
  }

  static fbm2(x, y, octaves) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i += 1) {
      value += SkySystem.valueNoise2(x * frequency, y * frequency) * amplitude;
      total += amplitude;
      frequency *= 2.03;
      amplitude *= 0.52;
    }
    return total > 0 ? value / total : 0;
  }
}

window.SkySystem = SkySystem;
