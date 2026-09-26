import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const flagsets = {
  default: [],
  d3d11: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu'],
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
