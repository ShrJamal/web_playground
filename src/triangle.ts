export async function createTriangle(device: GPUDevice, ctx: GPUCanvasContext) {
  const format = 'bgra8unorm'
  ctx.configure({
    device: device,
    format: format,
  })

  //const shader = Shaders();
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: `
		  struct Output {
			@builtin(position) pos : vec4<f32>,
			@location(0) color : vec4<f32>,
		  };
		  @vertex
		  fn vs_main(@builtin(vertex_index) VertexIndex: u32) -> Output {
			  var pos = array<vec2<f32>, 3>(
				  vec2<f32>(0.0, 0.5),
				  vec2<f32>(-0.5, -0.5),
				  vec2<f32>(0.5, -0.5)
			  );
		  
			  var color = array<vec3<f32>, 3>(
				  vec3<f32>(1.0, 0.0, 0.0),
				  vec3<f32>(0.0, 1.0, 0.0),
				  vec3<f32>(0.0, 0.0, 1.0)
			  );
		  
			  var output: Output;
			  output.pos = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
			  output.color = vec4<f32>(color[VertexIndex], 1.0);
			  return output;
		  }`,
      }),
      entryPoint: 'vs_main',
    },
    fragment: {
      module: device.createShaderModule({
        code: `
		  @fragment
			fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
				return color;
			}
		  `,
      }),
      entryPoint: 'fs_main',
      targets: [
        {
          format: format,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  })

  const commandEncoder = device.createCommandEncoder()
  const textureView = ctx.getCurrentTexture().createView()
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.2, g: 0.247, b: 0.314, a: 1.0 }, //background color
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  })
  renderPass.setPipeline(pipeline)
  renderPass.draw(3, 1, 0, 0)
  renderPass.end()

  device.queue.submit([commandEncoder.finish()])
}
