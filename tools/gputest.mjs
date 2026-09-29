import puppeteer from 'puppeteer-core';
// Prints the WebGL renderer Chrome actually got. On a GPU machine it must name the GPU
// (NVIDIA, Apple, ...); "SwiftShader" means it fell back to CPU rendering.
const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform];
const ANGLE = process.env.ANGLE || { win32: 'd3d11', darwin: 'metal' }[process.platform] || 'swiftshader';
const flagsets = {
  default: [],
  [ANGLE]: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
};
for (const [name, flags] of Object.entries(flagsets)) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: flags });
  const page = await browser.newPage();
  const info = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'no webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRB: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      pointSize: Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)),
      floatRT: !!gl.getExtension('EXT_color_buffer_float'),
      aniso: !!gl.getExtension('EXT_texture_filter_anisotropic'),
    };
  });
  console.log(name, JSON.stringify(info));
  await browser.close();
}
