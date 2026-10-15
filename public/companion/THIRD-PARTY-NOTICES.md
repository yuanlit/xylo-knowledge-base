# Live2D Companion

- Runtime: oh-my-live2d 0.19.3, MIT, https://github.com/oh-my-live2d/oh-my-live2d
- Model: live2d-widget-model-shizuku 1.0.5, package-declared GPL-2.0, https://github.com/xiazeyu/live2d-widget-models
- Model: live2d-widget-model-koharu 1.0.5, package-declared GPL-2.0, https://github.com/xiazeyu/live2d-widget-models
- Models: live2d-widget-model-hibiki, live2d-widget-model-izumi, live2d-widget-model-ni-j and live2d-widget-model-nito 1.0.5, package-declared GPL-2.0, https://github.com/xiazeyu/live2d-widget-models
- Models: live2d-widget-model-nico, live2d-widget-model-nipsilon, live2d-widget-model-z16, live2d-widget-model-hijiki and live2d-widget-model-tororo 1.0.5, package-declared GPL-2.0, https://github.com/xiazeyu/live2d-widget-models
- Shizuku is a Live2D sample character. Underlying Cubism SDK and sample-model rights remain with their respective owners. Review the upstream Live2D terms before commercial redistribution.
- Runtime and model are packaged locally. No CDN scripts, remote model requests, analytics, or daily-quote services are enabled.

Generated live2d.js, runtime.js, model.js and model-*.js are rebuilt by scripts/prepare-companion-assets.mjs from the installed upstream packages. Character resources are loaded on demand from the local package. The embedded Cubism 2 SDK is extracted unchanged into live2d.js for external-script loading under CSP.
