# Bundled art assets

All assets are served locally; the game makes no runtime requests to asset services.

- `pbr/asphalt_02_*.jpg`: Poly Haven **Asphalt 02**, Rob Tuytel. 2048px diffuse, OpenGL normal and roughness maps. https://polyhaven.com/a/asphalt_02 — CC0.
- `pbr/sandstone_cracks_*.jpg`: Poly Haven **Sandstone Cracks**. 2048px diffuse, OpenGL normal and roughness maps. https://polyhaven.com/a/sandstone_cracks — CC0.
- `pbr/golden-hour.hdr`: Poly Haven **Kloppenheim 06 (Pure Sky)**, Greg Zaal and Jarod Guest. 2048px Radiance HDR. https://polyhaven.com/a/kloppenheim_06_puresky — CC0.
- Asset license: https://polyhaven.com/license
- Sports coupe, pine needle sprays, canyon terrain, rock geometry and roadside structures: original procedural geometry in `sports-car.js`, `scenery.js`, `environment-architecture.js` and `renderer.js`. Profile terrain textures and seven linear HDR skies are authored procedurally in `scenery.js`; profile settings are in `engine/environments.js`. These are not licensed vehicle replicas or scanned models.

Three.js r147 CSM and RGBELoader are vendored from https://github.com/mrdoob/three.js/tree/r147/examples/jsm under the MIT license in `vendor/THREE-LICENSE.txt`. Adaptation replaces ES-module imports/exports with classic-script closures for the existing application; the CSM clear-coat guard is also corrected from `CLEARCOAT` to `USE_CLEARCOAT` to match the bundled r147 physical shaders and initialize the coating normal.
