struct VertexOutput {
	@builtin(position) position: vec4<f32>,
	@location(0) fragmentPosition: vec2<f32>,
}

struct Uniforms {
	center: vec2<f32>,
	rectangle: vec2<f32>,
	maxIter: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
	var output: VertexOutput;
	var positions: array<vec2<f32>, 4> = array<vec2<f32>, 4>(
		vec2<f32>(1.0, -1.0),
		vec2<f32>(1.0, 1.0),
		vec2<f32>(-1.0, -1.0),
		vec2<f32>(-1.0, 1.0),
	);
	let position2d: vec2<f32> = positions[vertexIndex];
	output.position = vec4<f32>(position2d, 0.0, 1.0);
	output.fragmentPosition = position2d;
	return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
	var c: vec2<f32> = uniforms.center + input.fragmentPosition * uniforms.rectangle;
	var z: vec2<f32> = c;
	
	var iter: u32 = 0u;
	let maxIter: u32 = uniforms.maxIter;
	for (; iter < maxIter && z.x * z.x + z.y * z.y <= 4.0; iter++) {
		z = vec2<f32>(
			z.x * z.x - z.y * z.y + c.x,
			2.0 * z.x * z.y + c.y,
		);
	}

	if (iter < maxIter) {
		return vec4<f32>(
			sin(f32(iter) / f32(maxIter) * 5.0),
			sin(f32(iter) / f32(maxIter) * 10.0),
			sin(f32(iter) / f32(maxIter) * 15.0),
			1.0,
		);
	} else {
		return vec4<f32>(
			0.0,
			0.0,
			0.0,
			1.0,
		);
	}
}