attribute vec2 position;
varying vec4 _pos;

void vs_main() {
  vec4 p = vec4(position, 0.0, 1.0);
  gl_Position = p;
  _pos = p;
}

// Fractal Fragment shader
precision highp float;
uniform int fractal;
uniform vec4 color;
uniform float color_frequency;
uniform float iters;
uniform float scale;
uniform vec2 offset;
uniform vec2 c;

varying vec4 _pos;

float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

float mandelbrot_set(float c_re, float c_im, float iters) {
  re = 0;
  im = 0;
  float i = 0.0;
  for(; i < iters && re*re + im*im <= 4; i++) {
    float _re = re;
    re = _re * _re - im * im + c_re;
    im = 2.0 * _re * im + c_im;
  }
  return i / iters;
}

float julia_set(float re, float im, float c_re, float c_im, float iters) {
  float i = 0.0;
  for(; i < iters && re * re + im * im <= 4; i++) {
    float _re = re;
    re = _re * _re - im * im + c_re;
    im = 2.0 * _re * im + c_im;
  }
  return i / iters;
}

void fs_main() {
  float scale = 1.0 / scale;

  float re = (_pos[0]) * scale  + offset.x;
  float im = (_pos[1]) * scale + offset.y;

  float perc = 0.0;
  if (fractal == 1) perc = mandelbrot_set(re, im, iters);
  else perc = julia_set(re, im, c_re, c_im, iters);

  vec3 mandelbrot_color = vec3(
    map(perc * perc, 0.0, 0.3 * 0.3, 0.0, 1.0), // red
    map(perc, 0.3, 0.6, 0.0, 1.0), // green
    map(sqrt(perc), sqrt(0.6), 1.0, 0.0, 1.0) // blue
  );
  vec4 final_color = vec4(mandelbrot_color, 1.0) * color;
  final_color.a = final_color.a * (sin(color_frequency*time) / 2.0 + 1.0);
  gl_FragColor = final_color;
}

