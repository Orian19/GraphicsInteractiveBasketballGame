# Project Configuration

## Commands
- `node index.js` - Start the application (serves on port 8000)
- Access via browser at `http://localhost:8000`

## Project Structure
- WebGL 3D graphics application using THREE.js
- Scene implementation in `/src/hw5.js`
- OrbitControls for camera manipulation

## Code Style Guidelines
- ES modules (import/export)
- Use consistent spacing (2-space indentation)
- Descriptive variable names (e.g., `cameraTranslate` not `ct`)
- THREE.js objects follow conventions:
  - Scene, Camera, Renderer, Geometry, Material, Mesh
- Animation frame handling via requestAnimationFrame
- Event listeners for keyboard controls
- Camera/view controls through OrbitControls
- Functions use camelCase (e.g., `degreesToRadians`)
- Comments for explaining complex sections or calculations

## Implementation Notes
- Toggle orbit camera with 'o' key
- Main rendering happens in the animate() function
- Scene interactions should follow THREE.js patterns