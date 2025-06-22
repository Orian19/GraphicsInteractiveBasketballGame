# Exercise 5 – Basketball Court Infrastructure with THREE.js

## Overview
This exercise focuses on implementing the static infrastructure of a basketball court scene using THREE.js. You will create the court, hoops, and basketball, but WITHOUT physics, animation, or interactive controls. This is the foundation for the next exercise (HW06) which will add the interactive elements.

## Tasks - HW05 INFRASTRUCTURE ONLY
1. Add court lines to the basketball court:
   - Center line
   - Center circle  
   - Three-point lines on both sides
   - Court markings must be white and clearly visible

2. Create basketball hoops (static):
   - Backboard (white, partially transparent)
   - Rim (orange) at regulation height
   - Net using line segments (at least 8 segments)
   - Support structure (pole and arms) positioned BEHIND the backboard
   - Place hoops on both ends of the court

3. Implement a static basketball:
   - Create a sphere with orange material and black seams
   - Position at center court
   - Proper size and spherical geometry
   - NO physics or movement

4. Camera and lighting infrastructure:
   - Interactive camera controls (orbit) - toggle with 'O' key
   - Appropriate lighting with shadows
   - Proper initial camera positioning

5. Basic UI framework preparation:
   - HTML containers for future score display
   - HTML containers for future controls display  
   - Basic CSS styling for UI elements

## Technical Requirements
- All objects should cast and receive shadows
- Use appropriate meshes and materials for each object
- The scene should be responsive when the browser window is resized
- Basketball must remain STATIC (no physics or movement)

## IMPORTANT NOTE
**Physics-based movement, interactive controls (arrow keys, spacebar), shooting mechanics, and scoring systems will be implemented in the next exercise (HW06). Do NOT implement these features in HW05.**

## Getting Started
- The starter code already includes:
  - Basic THREE.js setup with a scene, camera, and renderer
  - A simple brown court surface
  - Lighting setup with shadows enabled
  - Orbit controls for easy scene navigation (toggle with 'o' key)
  
- Examine the `createBasketballCourt()` function and build upon it
- Use the `degrees_to_radians()` helper function for any rotation calculations
- Add all your code to the hw5.js file

## Reference
- Standard basketball court dimensions are ~28m x 15m (92ft x 50ft)
- Standard basketball rim height is 3.05m (10ft)
- Use different materials for different parts (MeshBasicMaterial for lines, MeshPhongMaterial for shiny objects)