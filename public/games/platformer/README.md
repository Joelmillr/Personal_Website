# Unity WebGL Build

Place the Unity WebGL build output here.

## Build Instructions

1. Open `Simple-2d-Platformer/App-03-COMPSCI-4482` in Unity 2021.3.11f1
2. File > Build Settings > Select "WebGL" platform > Switch Platform
3. Player Settings > Resolution: 960x600 (already configured)
4. Player Settings > Publishing Settings > Compression Format: Disabled (or Gzip)
5. Click "Build" and select this directory as the output
6. The build will produce:
   - `index.html`
   - `Build/` folder with .data, .framework.js, .loader.js, .wasm files
   - `TemplateData/` folder (optional)

The website will automatically detect and embed the game once these files are present.
