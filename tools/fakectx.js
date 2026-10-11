/* Headless art harness (used by tests/levels.test.js and tests/metro.test.js).
   A recording 2D context that:
     * accepts every canvas call (no canvas library needed),
     * fails loudly when a coordinate is NaN (which draws nothing in a browser),
     * tracks the transform stack, so `calls.bbox` is the REAL drawn bounds of a
       creature - which is how the tests check that every silhouette fits its
       own box and that nothing sinks through the floor. */
function makeFakeCtx() {
    const calls = {
        n: 0, nan: [], bbox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        reset() {
            calls.n = 0; calls.nan.length = 0;
            calls.bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        }
    };
    const grad = () => ({ addColorStop() { } });

    /* --- affine transform stack (a b c d e f), same order as canvas --- */
    let m = [1, 0, 0, 1, 0, 0], stack = [];
    const mul = (n) => [
        m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
    ];
    const apply = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

    /* transform ops take numbers that are NOT points, so they never count
       towards the drawing bounds (only NaN is checked on them) */
    const XFORM = new Set(["translate", "scale", "rotate", "transform", "setTransform", "save", "restore", "resetTransform"]);
    const check = (name, args) => {
        for (const a of args) if (typeof a === "number" && !isFinite(a)) calls.nan.push(name);
        if (!XFORM.has(name) && typeof args[0] === "number" && typeof args[1] === "number") {
            const [x, y] = apply(args[0], args[1]);
            const b = calls.bbox;
            b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
            b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
        }
    };

    const special = {
        save() { stack.push(m.slice()); },
        restore() { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
        translate(x, y) { m = mul([1, 0, 0, 1, x || 0, y || 0]); check("translate", [x, y]); },
        scale(x, y) { m = mul([x || 0, 0, 0, y === undefined ? (x || 0) : y, 0, 0]); check("scale", [x, y]); },
        rotate(a) { const c = Math.cos(a || 0), s = Math.sin(a || 0); m = mul([c, s, -s, c, 0, 0]); check("rotate", [a]); },
        transform(a, b, c, d, e, f) { m = mul([a, b, c, d, e, f]); },
        setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
        resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
        measureText: () => ({ width: 10 }),
        createLinearGradient: () => grad(), createRadialGradient: () => grad(), createPattern: () => grad(),
        /* a 1px dot: keeps the recorded bounds meaningful for wide strokes */
        createImageData: () => ({ data: [] }), getImageData: () => ({ data: [] })
    };

    const handler = {
        get(t, prop) {
            if (prop === "calls") return calls;
            if (prop === "canvas") return { width: 100, height: 100 };
            if (prop in special) return special[prop];
            if (prop in t) return t[prop];
            return (...args) => { calls.n++; check(String(prop), args); };
        },
        set(t, prop, v) {
            if (typeof v === "number" && !isFinite(v)) calls.nan.push("set:" + String(prop));
            t[prop] = v; return true;
        }
    };
    return new Proxy({
        globalAlpha: 1, lineWidth: 1, lineCap: "butt", lineJoin: "miter",
        font: "", textAlign: "left", fillStyle: "#000", strokeStyle: "#000", shadowBlur: 0
    }, handler);
}
module.exports = { makeFakeCtx };
