export const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`

export const fragmentShaderSource = `
    precision highp float;

    uniform vec2 u_resolution;
    // Double precision uniforms passed as two floats (high, low)
    uniform vec2 u_zoomCenterHigh;
    uniform vec2 u_zoomCenterLow;
    uniform float u_zoomSizeHigh;
    uniform float u_zoomSizeLow;
    
    uniform int u_maxIterations;
    uniform int u_fractalType; // 0 = Mandelbrot, 1 = Julia, 2 = Burning Ship
    uniform vec2 u_juliaCHigh;
    uniform vec2 u_juliaCLow;

    // --- Double-Double Arithmetic Functions ---
    // Represents a number as vec2(hi, lo) where value = hi + lo
    
    vec2 ds_set(float a) {
        return vec2(a, 0.0);
    }

    vec2 ds_add(vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float t1, t2, e;

        t1 = dsa.x + dsb.x;
        e = t1 - dsa.x;
        t2 = ((dsb.x - e) + (dsa.x - (t1 - e))) + dsa.y + dsb.y;

        dsc.x = t1 + t2;
        dsc.y = t2 - (dsc.x - t1);
        return dsc;
    }

    vec2 ds_sub(vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float t1, t2, e;

        t1 = dsa.x - dsb.x;
        e = t1 - dsa.x;
        t2 = ((-dsb.x - e) + (dsa.x - (t1 - e))) + dsa.y - dsb.y;

        dsc.x = t1 + t2;
        dsc.y = t2 - (dsc.x - t1);
        return dsc;
    }

    vec2 ds_mul(vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float c11, c21, c2, e, t1, t2;
        float a1, a2, b1, b2, cona, conb, split = 8193.0;

        cona = dsa.x * split;
        a1 = cona - (cona - dsa.x);
        a2 = dsa.x - a1;

        conb = dsb.x * split;
        b1 = conb - (conb - dsb.x);
        b2 = dsb.x - b1;

        c11 = dsa.x * dsb.x;
        c21 = a1 * b1 - c11;
        c21 += a1 * b2;
        c21 += a2 * b1;
        c21 += a2 * b2;

        c2 = dsa.x * dsb.y + dsa.y * dsb.x;

        t1 = c11 + c2;
        e = t1 - c11;
        t2 = dsa.y * dsb.y + ((c2 - e) + (c11 - (t1 - e))) + c21;

        dsc.x = t1 + t2;
        dsc.y = t2 - (dsc.x - t1);

        return dsc;
    }

    vec2 ds_sqr(vec2 dsa) {
        return ds_mul(dsa, dsa);
    }
    
    // Compare double-double with float
    bool ds_gt(vec2 dsa, float b) {
        return dsa.x > b;
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
        
        // Perform the entire calculation in double-double precision
        vec2 zoomSize = vec2(u_zoomSizeHigh, u_zoomSizeLow);
        vec2 uv_ds = vec2(uv.x, 0.0); // Treat uv as high-precision, assuming resolution is not extreme
        vec2 aspect_ds = vec2(aspect.x, 0.0);

        // offset = (uv - 0.5) * aspect * zoomSize
        vec2 offset_x = ds_mul(ds_mul(ds_sub(uv_ds, ds_set(0.5)), aspect_ds), zoomSize);
        
        uv_ds = vec2(uv.y, 0.0); // reuse for y
        aspect_ds = vec2(aspect.y, 0.0); // reuse for y
        vec2 offset_y = ds_mul(ds_mul(ds_sub(uv_ds, ds_set(0.5)), aspect_ds), zoomSize);

        // c = u_zoomCenter + offset
        vec2 cx = ds_add(vec2(u_zoomCenterHigh.x, u_zoomCenterLow.x), offset_x);
        vec2 cy = ds_add(vec2(u_zoomCenterHigh.y, u_zoomCenterLow.y), offset_y);
        
        vec2 zx, zy; // High precision Z
        vec2 jcx, jcy; // High precision Julia C

        if (u_fractalType == 1) {
            // Julia
            zx = cx;
            zy = cy;
            jcx = vec2(u_juliaCHigh.x, u_juliaCLow.x);
            jcy = vec2(u_juliaCHigh.y, u_juliaCLow.y);
            // For Julia, c is constant (the juliaC uniform)
            cx = jcx;
            cy = jcy;
        } else {
            // Mandelbrot / Burning Ship
            zx = ds_set(0.0);
            zy = ds_set(0.0);
        }

        int iterations = 0;
        for (int i = 0; i < 10000; i++) {
            if (i >= u_maxIterations) break;
            
            vec2 zx2 = ds_sqr(zx);
            vec2 zy2 = ds_sqr(zy);
            
            // Check escape: zx^2 + zy^2 > 4.0
            vec2 magSq = ds_add(zx2, zy2);
            if (ds_gt(magSq, 4.0)) {
                iterations = i;
                break;
            }

            if (u_fractalType == 2) {
                // Burning Ship
                // z = (|x| + i|y|)^2 + c
                // x_new = x^2 - y^2 + cx
                // y_new = 2|xy| + cy
                
                // We need absolute values for x and y before update
                // abs for double-double: if x < 0, negate both high and low
                if (zx.x < 0.0) zx = vec2(-zx.x, -zx.y);
                if (zy.x < 0.0) zy = vec2(-zy.x, -zy.y);
                
                vec2 next_x = ds_add(ds_sub(zx2, zy2), cx);
                vec2 next_y = ds_add(ds_mul(ds_set(2.0), ds_mul(zx, zy)), cy);
                
                zx = next_x;
                zy = next_y;
            } else {
                // Mandelbrot & Julia
                // z = z^2 + c
                // x_new = x^2 - y^2 + cx
                // y_new = 2xy + cy
                
                vec2 next_x = ds_add(ds_sub(zx2, zy2), cx);
                vec2 next_y = ds_add(ds_mul(ds_set(2.0), ds_mul(zx, zy)), cy);
                
                zx = next_x;
                zy = next_y;
            }
            iterations = i;
        }

        if (iterations == u_maxIterations) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
            float t = float(iterations) / float(u_maxIterations);
            vec3 color = hsv2rgb(vec3(sqrt(t) * 0.8 + 0.5, 0.8, 1.0));
            gl_FragColor = vec4(color, 1.0);
        }
    }
`
