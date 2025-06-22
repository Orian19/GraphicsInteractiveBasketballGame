import { OrbitControls } from './OrbitControls.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// court dims
const courtWidth = 30;
const courtHeight = courtWidth / 2; // 2:1 ratio
const courtDepth = 0.1;

// physics constants
const GRAVITY = -9.2;  // gravity for gameplay (real gravity is around -9.8 m/s^2)
const AIR_RESISTANCE = 0.018; // reduced air resistance for better shots

const basketballMovement = {
    // movement settings
    speed: 0.08, // base speed
    currentSpeed: { x: 0, z: 0 }, // current movement speed with momentum
    acceleration: 0.015,
    deceleration: 0.03,
    maxSpeed: 0.15,
    rotationFactor: 0.8,
    minRotation: 0.04,
    keysPressed: {}, // tracking which keys are pressed
    courtBounds: {
        minX: -(courtWidth / 2 - 0.5),
        maxX: courtWidth / 2 - 0.5,
        minZ: -(courtHeight / 2 - 0.5),
        maxZ: courtHeight / 2 - 0.5
    },
    // shot power settings
    shotPower: {
        current: 50, // current power level (0-100)
        min: 0,
        max: 100,
        step: 5,
        default: 50
    },
    // shooting mechanics settings
    shooting: {
        active: false, // is the ball in the air
        velocity: {
            x: 0,
            y: 0,
            z: 0
        },
        baseVelocity: 13.8,
        lastPosition: null, // for collision detection
        floorY: 0.35 + 0.1,
        spinFactor: 0.05
    }
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
scene.add(directionalLight);

function createBasketLight(x, y, z, targetX, targetY, targetZ) {
    /*
    create a focused lights for the basketball hoop area
    */

    const basketLight = new THREE.SpotLight(0xffffff, 1.5, 20, Math.PI / 4, 0.3, 1.2);
    basketLight.position.set(x, y, z);
    basketLight.target.position.set(targetX, targetY, targetZ);
    basketLight.castShadow = true;
    basketLight.shadow.mapSize.width = 1024;
    basketLight.shadow.mapSize.height = 1024;
    scene.add(basketLight);
    scene.add(basketLight.target);
    return basketLight;
}

// add focused lighting for each basket
// left basket lighting
const leftBasketLight = createBasketLight(-(courtWidth / 2), 12, 3, -(courtWidth / 2), 3, 0);

// right basket lighting
const rightBasketLight = createBasketLight(courtWidth / 2, 12, 3, courtWidth / 2, 3, 0);

// Enable shadows
renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;

// material helper functions

function createStandardMaterial(color, options = {}) {
    /*
    create a standard material with specified color and options
    */

    return new THREE.MeshStandardMaterial({
        color: color,
        roughness: options.roughness || 0.7,
        metalness: options.metalness || 0.3,
        ...options
    });
}

function degrees_to_radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}

// Create basketball court
function createBasketballCourt() {
    // create a parquet floor texture for the court
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // base brown color for the court (maintained as original)
    const baseColor = '#c68642';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boardWidth = 16;
    const boardHeight = 64;

    // create rows of parquet pattern
    for (let y = 0; y < canvas.height; y += boardHeight * 2) {
        for (let x = 0; x < canvas.width; x += boardWidth * 2) {
            // draw the parquet rectangles in alternating directions
            drawParquetBoard(ctx, x, y, boardWidth, boardHeight, boardWidth * 2, true);
            drawParquetBoard(ctx, x + boardWidth, y, boardWidth, boardHeight, boardWidth * 2, true);
            drawParquetBoard(ctx, x, y + boardHeight, boardWidth, boardHeight, boardWidth * 2, false);
            drawParquetBoard(ctx, x + boardWidth, y + boardHeight, boardWidth, boardHeight, boardWidth * 2, false);
        }
    }

    function drawParquetBoard(ctx, x, y, width, height, patternWidth, isHorizontal) {
        /*
        draw a single parquet board with wood effect
        */

        const colorShift = Math.random() * 12 - 6;
        const r = 198 + colorShift;
        const g = 134 + colorShift;
        const b = 66 + colorShift;

        // fill the board with base color
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, width, height);

        // add wood grain effect
        const grainCount = isHorizontal ? 6 : 2;
        const grainSpacing = isHorizontal ? height / grainCount : width / grainCount;

        ctx.strokeStyle = `rgba(${r - 20}, ${g - 20}, ${b - 20}, 0.3)`;
        ctx.lineWidth = 1;

        // draw wood grain lines
        for (let i = 0; i < grainCount; i++) {
            ctx.beginPath();
            if (isHorizontal) {
                // horizontal grain
                ctx.moveTo(x, y + i * grainSpacing + grainSpacing / 2);
                ctx.lineTo(x + width, y + i * grainSpacing + grainSpacing / 2);
            } else {
                // vertical grain
                ctx.moveTo(x + i * grainSpacing + grainSpacing / 2, y);
                ctx.lineTo(x + i * grainSpacing + grainSpacing / 2, y + height);
            }
            ctx.stroke();
        }

        // draw board outlines
        ctx.strokeStyle = 'rgba(100, 60, 30, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }

    // create court texture from canvas
    const courtTexture = new THREE.CanvasTexture(canvas);
    courtTexture.wrapS = THREE.RepeatWrapping;
    courtTexture.wrapT = THREE.RepeatWrapping;
    courtTexture.repeat.set(1, 1);

    // court floor with parquet texture
    const courtGeometry = new THREE.BoxGeometry(courtWidth, 0.2, courtHeight);
    const courtMaterial = new THREE.MeshPhongMaterial({
        map: courtTexture,
        color: 0xffffff,
        shininess: 60,
        bumpMap: courtTexture,
        bumpScale: 0.01
    });
    const court = new THREE.Mesh(courtGeometry, courtMaterial);
    court.receiveShadow = true;
    // court lines (white)
    scene.add(court);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lineThickness = 0.02;
    const lineHeight = courtDepth + lineThickness / 2;

    createCourtBoundary(lineMaterial, lineHeight);
    createCenterLine(lineMaterial, lineHeight);
    createCenterCircle(lineMaterial, lineHeight);
    createThreePointLines(lineMaterial, lineHeight);
    createFreeThrowAreas(lineMaterial, lineHeight);
    createKeyAreas(lineMaterial, lineHeight);
}

// ===============================
// COURT DIMENSIONS AND APPEARANCE
// ===============================

function createCourtLine(material, width, depth, thickness, x, y, z) {
    /*
    create a single court line with specific dims
    */

    const lineGeometry = new THREE.BoxGeometry(width, thickness, depth);
    const line = new THREE.Mesh(lineGeometry, material);
    line.position.set(x, y, z);
    scene.add(line);
    return line;
}

function createCourtBoundary(material, height) {
    /*  
    create the outer boundary lines of the basketball court
    the court is 30 units long and 15 units wide (2:1 ratio)
    rhe lines are positioned at the edges of the court
    */

    const lineWidth = 0.1;
    const lineThickness = 0.02;

    // side lines (long sides)
    createCourtLine(material, courtWidth, lineWidth, lineThickness, 0, height, courtHeight / 2);
    createCourtLine(material, courtWidth, lineWidth, lineThickness, 0, height, -courtHeight / 2);

    // end lines (short sides)
    createCourtLine(material, lineWidth, courtHeight, lineThickness, courtHeight, height, 0);
    createCourtLine(material, lineWidth, courtHeight, lineThickness, -courtHeight, height, 0);
}

function createCenterLine(material, height) {
    /*
    create the center line of the basketball court
    */
    createCourtLine(material, courtDepth, courtHeight, 0.02, 0, height, 0);
}

function createCenterCircle(material, height) {
    /*
    create the center circle of the basketball court
    */
    const circleRadius = 1.8;
    const circleGeometry = new THREE.RingGeometry(circleRadius - 0.05, circleRadius + 0.05, 64);
    const centerCircle = new THREE.Mesh(circleGeometry, material);
    centerCircle.rotation.x = -degrees_to_radians(90);
    centerCircle.position.set(0, height, 0);
    scene.add(centerCircle);
}

function createThreePointLines(material, height) {
    /*
    create the three-point lines of the basketball court
    */

    // three-point arc parameters
    const arcRadius = 6.75; // arc radius from basket
    const straightLineLength = 4.2; // length of straight corner lines
    const basketOffset = 1.2; // distance of basket from baseline

    function createThreePointSide(basketX) {
        /*
        create the three-point line for one side of the court
        */

        const actualBasketX = basketX > 0 ? basketX - basketOffset : basketX + basketOffset;

        // create arc
        createThreePointArc(material, height, actualBasketX, arcRadius);

        // create straight corner lines
        createCourtLine(material, courtDepth, straightLineLength, 0.02, basketX, height, straightLineLength / 2);
        createCourtLine(material, courtDepth, straightLineLength, 0.02, basketX, height, -straightLineLength / 2);
    }

    // create three-point lines for both sides
    createSymmetricCourtElements(createThreePointSide);
}

function createThreePointArc(material, height, basketX, radius) {
    /*
    create a three-point arc centered on the basket position
    */
    const arcGeometry = new THREE.RingGeometry(radius - 0.05, radius + 0.05, 64, 1, 0, degrees_to_radians(180));
    const arc = new THREE.Mesh(arcGeometry, material);
    arc.rotation.x = -degrees_to_radians(90);

    if (basketX < 0) {
        arc.rotation.z = -degrees_to_radians(90); // left side
    } else {
        arc.rotation.z = degrees_to_radians(90); // right side
    }

    arc.position.set(basketX, height, 0);
    scene.add(arc);

    // create connecting lines from arc endpoints to baseline
    const basketOffset = 1.2; // distance of basket from baseline
    const connectionLength = basketOffset; // length of connecting line
    const connectionGeometry = new THREE.BoxGeometry(connectionLength, 0.02, courtDepth);

    const arcEndY = radius;

    if (arcEndY < courtHeight / 2) { // half the court height (15/2)
        // top connection line
        const topConnection = new THREE.Mesh(connectionGeometry, material);
        if (basketX > 0) {
            topConnection.position.set(basketX + connectionLength / 2, height, arcEndY);
        } else {
            topConnection.position.set(basketX - connectionLength / 2, height, arcEndY);
        }
        scene.add(topConnection);

        // bottom connection line
        const bottomConnection = new THREE.Mesh(connectionGeometry, material);
        if (basketX > 0) {
            bottomConnection.position.set(basketX + connectionLength / 2, height, -arcEndY);
        } else {
            bottomConnection.position.set(basketX - connectionLength / 2, height, -arcEndY);
        }
        scene.add(bottomConnection);
    }
}

function createSymmetricCourtElements(createElementFunc, ...args) {
    /*
    create symmetric court elements for both sides of the court
    */

    createElementFunc(courtHeight, ...args);  // right side
    createElementFunc(-courtHeight, ...args); // left side
}

function createFreeThrowAreas(material, height) {
    /*
    create the free throw areas of the basketball court
    */

    const freeThrowDistance = 5.8; // distance from basket to free throw line
    const keyWidth = 3.6;

    function createFreeThrowLine(basketX) {
        /*
        create the free throw line for one side of the court
        */

        const x = basketX > 0 ? basketX - freeThrowDistance : basketX + freeThrowDistance;
        createCourtLine(material, courtDepth, keyWidth, 0.02, x, height, 0);
    }

    function createFreeThrowCircle(basketX) {
        /*
        create the free throw circle for one side of the court
        */

        const x = basketX > 0 ? basketX - freeThrowDistance : basketX + freeThrowDistance;
        const freeThrowCircleRadius = 1.8;
        const circleGeometry = new THREE.RingGeometry(
            freeThrowCircleRadius - 0.05,
            freeThrowCircleRadius + 0.05,
            64);
        const circle = new THREE.Mesh(circleGeometry, material);
        circle.rotation.x = -degrees_to_radians(90);
        circle.position.set(x, height, 0);
        scene.add(circle);
    }

    // create free throw lines and circles for both sides
    createSymmetricCourtElements(createFreeThrowLine);
    createSymmetricCourtElements(createFreeThrowCircle);
}

function createKeyAreas(material, height) {
    /*
    create the key areas (painted area near the basket) of the basketball court
    */

    const keyWidth = 3.6;
    const keyLength = 5.8;
    const lineWidth = 0.1;

    // right key area
    createKeyArea(material, height, courtHeight, keyWidth, keyLength, lineWidth);

    // left key area  
    createKeyArea(material, height, -courtHeight, keyWidth, keyLength, lineWidth);
}

function createKeyArea(material, height, basketX, width, length, lineWidth) {
    /*
    create a single key area at the specified basket position
    */

    const direction = basketX > 0 ? -1 : 1; // which side of court

    // side lines of the key (vertical lines)
    const keySideGeometry = new THREE.BoxGeometry(length, 0.02, lineWidth);

    const keySide1 = new THREE.Mesh(keySideGeometry, material);
    keySide1.position.set(basketX + direction * length / 2, height, width / 2);
    scene.add(keySide1);

    const keySide2 = new THREE.Mesh(keySideGeometry, material);
    keySide2.position.set(basketX + direction * length / 2, height, -width / 2);
    scene.add(keySide2);

    // end line of the key (connecting line at free throw line)
    const keyEndGeometry = new THREE.BoxGeometry(lineWidth, 0.02, width);
    const keyEnd = new THREE.Mesh(keyEndGeometry, material);
    keyEnd.position.set(basketX + direction * length, height, 0);
    scene.add(keyEnd);
}

// ================
// BASKETBALL HOOPS
// ================

function createBasketballHoops() {
    /*
    create the basketball hoops on both sides of the court
    */

    const basketOffsetFromEndline = 0.5;

    createBasketballHoop(courtHeight - basketOffsetFromEndline, 0, -1); // right side hoop
    createBasketballHoop(-courtHeight + basketOffsetFromEndline, 0, 1); // left side hoop
}

function createBasketballHoop(x, z, direction) {
    /*
    create a basketball hoop at the specified position
    x: X position of the hoop
    z: Z position of the hoop
    direction: -1 for right side, 1 for left side
    */

    const backboardWidth = 2.6;
    const backboardHeight = 1.8;
    const backboardThickness = 0.1;
    const rimRadius = 0.6;
    const rimTubeRadius = 0.03;
    const backboardToRimDistance = 0.6;
    const rimHeight = 6.0;
    const supportPoleRadius = 0.2;
    const supportOffset = -2.5; // support pole behind the backboard

    // create a canvas for the backboard texture with branding
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // add team branding (different for each hoop)
    const teamName = direction > 0 ? "HOME TEAM" : "VISITORS";
    const teamColor = direction > 0 ? '#0066cc' : '#cc3300';

    // draw decorative border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // draw team logo circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 4, canvas.height / 8, 0, degrees_to_radians(360));
    ctx.fillStyle = teamColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.stroke();

    // add team text
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = teamColor;
    ctx.textAlign = 'center';
    ctx.fillText(teamName, canvas.width / 2, canvas.height / 2);

    // draw target box
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 8;
    const boxSize = canvas.width / 4;
    ctx.strokeRect(
        canvas.width / 2 - boxSize / 2,
        canvas.height * 0.65 - boxSize / 2,
        boxSize,
        boxSize
    );

    // create the backboard texture from the canvas
    const backboardTexture = new THREE.CanvasTexture(canvas);

    // create backboard with frame
    const backboardFrameGroup = new THREE.Group();

    // main backboard panel
    const backboardGeometry = new THREE.BoxGeometry(
        backboardThickness,
        backboardHeight,
        backboardWidth
    );

    // partially transparent white backboard
    const backboardMaterial = new THREE.MeshPhongMaterial({
        map: backboardTexture,
        transparent: true,
        opacity: 0.7, // partial transparency
        side: THREE.DoubleSide,
        shininess: 80
    });

    const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
    backboard.castShadow = true;
    backboard.receiveShadow = true;
    backboardFrameGroup.add(backboard);
    // metal frame around the backboard
    const frameThickness = 0.05;
    const frameDepth = backboardThickness * 1.2;

    function createFramePiece(width, height, depth, x, y, z) {
        /*
        create a single frame piece for the backboard
        */

        const frameGeometry = new THREE.BoxGeometry(width, height, depth);
        const frameMaterial = createStandardMaterial(0x888888, { metalness: 0.7, roughness: 0.2 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(x, y, z);
        backboardFrameGroup.add(frame);
        return frame;
    }

    // create frame pieces (top, bottom, left, right)
    createFramePiece(frameDepth, frameThickness, backboardWidth, 0, backboardHeight / 2, 0);  // top
    createFramePiece(frameDepth, frameThickness, backboardWidth, 0, -backboardHeight / 2, 0); // bottom
    createFramePiece(frameDepth, backboardHeight, frameThickness, 0, 0, backboardWidth / 2);  // left
    createFramePiece(frameDepth, backboardHeight, frameThickness, 0, 0, -backboardWidth / 2); // right

    // position the entire backboard assembly
    backboardFrameGroup.position.set(x, rimHeight + (backboardHeight / 2 - rimRadius), z);
    scene.add(backboardFrameGroup);

    const targetBoxSize = 0.45;
    const targetBoxDepth = 0.01;
    const targetBoxGeometry = new THREE.BoxGeometry(
        targetBoxDepth,
        targetBoxSize,
        targetBoxSize
    );

    const targetBoxMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3
    });

    const targetBox = new THREE.Mesh(targetBoxGeometry, targetBoxMaterial);
    targetBox.position.set(
        x + direction * (backboardThickness / 2 + targetBoxDepth / 2),
        rimHeight,
        z
    );
    scene.add(targetBox);
    // rim
    const rimGroup = new THREE.Group();
    // orange metallic rim
    const rimGeometry = new THREE.TorusGeometry(rimRadius, rimTubeRadius, 8, 24);
    const rimMaterial = createStandardMaterial(0xff4500, {
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x331100,
        emissiveIntensity: 0.2
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = degrees_to_radians(90);
    rim.castShadow = true;
    rimGroup.add(rim);

    // position the entire rim group
    rimGroup.position.set(
        x + direction * (backboardThickness / 2 + backboardToRimDistance),
        rimHeight,
        z
    );

    scene.add(rimGroup);

    // net
    createBasketballNet(
        x + direction * (backboardThickness / 2 + backboardToRimDistance),
        rimHeight,
        z,
        rimRadius,
        0.6 // net height
    );

    // support structure
    createSupportStructure(
        x,
        z,
        rimHeight,
        backboardHeight,
        backboardWidth,
        backboardThickness,
        direction,
        supportPoleRadius,
        supportOffset
    );
}

function createBasketballNet(x, y, z, rimRadius, netHeight) {
    /*
    create a basketball net at the specified position
    */

    const segments = 16; // number of vertical strips
    const horizontalSegments = 8; // number of horizontal rings
    netHeight = 0.8;

    // create a group to hold all net lines
    const netGroup = new THREE.Group();

    // vertical strips
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * degrees_to_radians(360);
        const startX = x + Math.cos(angle) * rimRadius;
        const startZ = z + Math.sin(angle) * rimRadius;

        const points = [];
        points.push(new THREE.Vector3(startX, y, startZ));

        // create curved path down to bottom of net
        for (let j = 1; j <= horizontalSegments; j++) {
            const ratio = j / horizontalSegments;
            // net narrows from top to bottom
            const narrowingFactor = 1 - (0.6 * ratio);

            points.push(new THREE.Vector3(
                x + Math.cos(angle) * rimRadius * narrowingFactor,
                y - ratio * netHeight,
                z + Math.sin(angle) * rimRadius * narrowingFactor
            ));
        }

        // vertical strips
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2 // Thicker lines (note: may not work in all browsers)
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        netGroup.add(line);
    }

    // horizontal rings
    for (let i = 1; i <= horizontalSegments; i++) {
        const ringPoints = [];
        const ratio = i / horizontalSegments;
        const ringY = y - ratio * netHeight;
        const ringRadius = rimRadius * (1 - (0.6 * ratio));

        for (let j = 0; j <= segments; j++) {
            const angle = (j / segments) * degrees_to_radians(360);
            ringPoints.push(new THREE.Vector3(
                x + Math.cos(angle) * ringRadius,
                ringY,
                z + Math.sin(angle) * ringRadius
            ));
        }

        const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
        const ringMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const ring = new THREE.Line(ringGeometry, ringMaterial);
        netGroup.add(ring);
    }

    scene.add(netGroup);
}

function createSupportStructure(x, z, rimHeight, backboardHeight, backboardWidth, backboardThickness, direction, poleRadius, supportOffset) {
    /*
    create the support structure for the basketball hoop
    */

    const supportGroup = new THREE.Group();

    // create branded texture for the pole with team colors
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // fill with base color
    const teamColor = direction > 0 ? '#0066cc' : '#cc3300';
    const teamName = direction > 0 ? "HOME" : "VISITOR";

    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // add team color
    ctx.fillStyle = teamColor;
    ctx.fillRect(0, 50, canvas.width, 40);
    ctx.fillRect(0, canvas.height - 90, canvas.width, 40);

    // add team name
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(teamName, 0, 0);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 25, courtHeight, 0, degrees_to_radians(360));
    ctx.fill();

    // create texture
    const poleTexture = new THREE.CanvasTexture(canvas);
    poleTexture.wrapS = THREE.RepeatWrapping;
    poleTexture.wrapT = THREE.RepeatWrapping;
    poleTexture.repeat.set(1, 1);

    // main pole materials
    const poleMaterial = new THREE.MeshStandardMaterial({
        map: poleTexture,
        roughness: 0.7,
        metalness: 0.3
    });

    // metallic materials for the support structure
    const metallicMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777,
        roughness: 0.3,
        metalness: 0.8
    });

    // dims for the base
    const baseWidth = poleRadius * 7;
    const baseDepth = poleRadius * 7;
    const baseHeight = 0.4;

    const courtEdgeX = direction > 0 ? -courtHeight : courtHeight; // the court edge X position
    // position the base so its edge is touching the court edge
    const basePositionX = courtEdgeX - direction * (baseWidth / 2 + 0.3);

    const baseGroup = new THREE.Group();

    // add base for the support pole
    const baseGeometry = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.castShadow = true;
    base.receiveShadow = true;
    baseGroup.add(base);

    // add bolts to the base (for more realistic look)
    const boltRadius = 0.08;
    const boltHeight = 0.1;
    const boltPositions = [
        { x: baseWidth / 2 - boltRadius * 2, z: baseDepth / 2 - boltRadius * 2 },
        { x: -(baseWidth / 2 - boltRadius * 2), z: baseDepth / 2 - boltRadius * 2 },
        { x: baseWidth / 2 - boltRadius * 2, z: -(baseDepth / 2 - boltRadius * 2) },
        { x: -(baseWidth / 2 - boltRadius * 2), z: -(baseDepth / 2 - boltRadius * 2) }
    ];

    boltPositions.forEach(pos => {
        const boltGeometry = new THREE.CylinderGeometry(boltRadius, boltRadius, boltHeight, 8);
        const bolt = new THREE.Mesh(boltGeometry, metallicMaterial);
        bolt.position.set(pos.x, baseHeight / 2, pos.z);
        baseGroup.add(bolt);

        // add bolt head
        const boltHeadGeometry = new THREE.CylinderGeometry(boltRadius * 1.5, boltRadius * 1.5, boltHeight * 0.3, 6);
        const boltHead = new THREE.Mesh(boltHeadGeometry, metallicMaterial);
        boltHead.position.set(pos.x, baseHeight / 2 + boltHeight / 2 + boltHeight * 0.15, pos.z);
        baseGroup.add(boltHead);
    });

    // position the base at the bottom of the main pole
    baseGroup.position.set(
        basePositionX,
        baseHeight / 2,
        z
    );
    supportGroup.add(baseGroup);

    // calculate pole dims
    const poleHeight = rimHeight + backboardHeight / 2 + 0.8;

    // create main pole with segments for more realistic appearance
    const poleSegments = 4;
    const segmentHeight = poleHeight / poleSegments;

    for (let i = 0; i < poleSegments; i++) {
        const bottomRadius = poleRadius * (1.0 - (0.1 * i / poleSegments));
        const topRadius = poleRadius * (1.0 - (0.1 * (i + 1) / poleSegments));

        const segmentGeometry = new THREE.CylinderGeometry(
            topRadius,
            bottomRadius,
            segmentHeight,
            16
        );

        const segment = new THREE.Mesh(segmentGeometry, poleMaterial);
        segment.position.set(
            basePositionX,
            segmentHeight * (i + 0.5),
            z
        );
        segment.castShadow = true;
        supportGroup.add(segment);

        // add connecting rings between segments (except for the first segment)
        if (i > 0) {
            const ringGeometry = new THREE.TorusGeometry(bottomRadius * 1.2, bottomRadius * 0.1, 12, 24);
            const ring = new THREE.Mesh(ringGeometry, metallicMaterial);
            ring.position.set(basePositionX, segmentHeight * i, z);
            ring.rotation.x = degrees_to_radians(90);
            supportGroup.add(ring);
        }
    }

    // calculate distances
    const poleToBackboardDistance = Math.abs(basePositionX - x);
    const armThickness = 0.15;
    const fullArmLength = poleToBackboardDistance;

    // create arm assembly group
    const armAssembly = new THREE.Group();

    // position the arm to connect from pole to top of backboard
    const armGeometry = new THREE.BoxGeometry(fullArmLength, armThickness, armThickness * 1.5);
    const arm = new THREE.Mesh(armGeometry, metallicMaterial);
    arm.position.set(
        direction * (fullArmLength / 2),
        0,
        0
    );
    arm.castShadow = true;
    armAssembly.add(arm);

    // diagonal support arm - connects from pole to mid-height of backboard
    const targetY = rimHeight;
    const verticalDiff = (rimHeight + backboardHeight / 2) - targetY;

    // calculate the angle for the arm
    const angle = Math.atan2(-verticalDiff, poleToBackboardDistance);
    // calculate the length needed for the arm
    const braceLength = Math.sqrt(Math.pow(poleToBackboardDistance, 2) + Math.pow(verticalDiff, 2));

    // create the diagonal support arm
    const braceGeometry = new THREE.BoxGeometry(braceLength, armThickness, armThickness);
    const brace = new THREE.Mesh(braceGeometry, metallicMaterial);
    brace.position.set(
        direction * (poleToBackboardDistance / 2),
        -verticalDiff / 2,
        0
    );
    brace.rotation.z = direction > 0 ? angle : -angle;
    brace.castShadow = true;
    armAssembly.add(brace);

    // position the extension to connect from the backboard toward the original arm
    const extensionLength = poleToBackboardDistance * 0.15;
    const extensionGeometry = new THREE.BoxGeometry(extensionLength, armThickness * 2, armThickness * 3);
    const extension = new THREE.Mesh(extensionGeometry, metallicMaterial);
    extension.position.set(
        direction * (fullArmLength - extensionLength / 2),
        0,
        0
    );
    extension.castShadow = true;
    armAssembly.add(extension);

    // position the entire arm structure
    armAssembly.position.set(
        basePositionX,
        rimHeight + backboardHeight / 2,
        z
    );
    supportGroup.add(armAssembly);

    scene.add(supportGroup);
}

// =================
// STATIC BASKETBALL
// =================

function createBasketball() {
    /*
    create a static basketball at the center of the court
    */

    const basketballRadius = 0.35;

    // group to hold the basketball and its seams
    const basketballGroup = new THREE.Group();
    // create a canvas for the basketball texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const baseColor = '#ff6600'; // orange
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // add realistic texture
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 1.5 + 0.5;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, degrees_to_radians(360));

        // vary the shade and opacity for realism
        const shade = Math.random() * 25 - 10;
        const opacity = Math.random() * 0.3 + 0.1;
        ctx.fillStyle = `rgba(${255 + shade}, ${102 + shade}, ${0 + Math.max(0, shade)}, ${opacity})`;
        ctx.fill();
    }

    // add darker patches
    for (let i = 0; i < 8; i++) {
        const patchX = Math.random() * canvas.width;
        const patchY = Math.random() * canvas.height;
        const patchSize = Math.random() * 80 + 40;

        ctx.beginPath();
        ctx.arc(patchX, patchY, patchSize, 0, degrees_to_radians(360));
        ctx.fillStyle = `rgba(230, 85, 13, ${Math.random() * 0.15 + 0.05})`;
        ctx.fill();
    }

    // add subtle highlights
    for (let i = 0; i < 6; i++) {
        const highlightX = Math.random() * canvas.width;
        const highlightY = Math.random() * canvas.height;
        const highlightSize = Math.random() * 60 + 30;

        ctx.beginPath();
        ctx.arc(highlightX, highlightY, highlightSize, 0, degrees_to_radians(360));
        ctx.fillStyle = `rgba(255, 220, 180, ${Math.random() * 0.12 + 0.08})`;
        ctx.fill();
    }

    const basketballTexture = new THREE.CanvasTexture(canvas);
    const basketballGeometry = new THREE.SphereGeometry(basketballRadius, 32, 16);
    const normalMap = basketballTexture.clone();

    const basketballMaterial = new THREE.MeshStandardMaterial({
        map: basketballTexture,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(0.04, 0.04),
        roughness: 0.7,
        metalness: 0.02,
        bumpMap: basketballTexture,
        bumpScale: 0.015,
        emissive: new THREE.Color(0x331100),
        emissiveIntensity: 0.05
    });

    const basketball = new THREE.Mesh(basketballGeometry, basketballMaterial);
    basketball.castShadow = true;
    basketball.receiveShadow = true;
    basketballGroup.add(basketball);

    // create the black seams on the basketball and add them to the group
    createBasketballSeams(basketballGroup, basketballRadius);

    // position the entire group at center court
    basketballGroup.position.set(0, basketballRadius + courtDepth, 0);
    scene.add(basketballGroup);

    // store reference to the basketball group (for mechanics later)
    window.basketballGroup = basketballGroup;

    return basketballGroup;
}

function createBasketballSeams(basketballGroup, radius) {
    /*
    create the seams on the basketball (to give a realistic appearance)
    */

    const seamRadius = radius * 1.001;
    const seamWidth = radius * 0.02;
    const seamColor = 0x222222; // black seams

    // seam material
    const seamMaterial = new THREE.MeshStandardMaterial({
        color: seamColor,
        roughness: 0.6,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: true
    });

    // horizontal seam
    const horizontalSeamGeometry = new THREE.TorusGeometry(seamRadius, seamWidth, 8, 64);
    const horizontalSeam = new THREE.Mesh(horizontalSeamGeometry, seamMaterial);
    horizontalSeam.rotation.x = degrees_to_radians(90);
    basketballGroup.add(horizontalSeam);

    // create two perpendicular vertical seams (complete circles)
    // first vertical seam (front to back)
    const verticalSeam1 = new THREE.Mesh(horizontalSeamGeometry.clone(), seamMaterial);
    basketballGroup.add(verticalSeam1);

    // second vertical seam (side to side)
    const verticalSeam2 = new THREE.Mesh(horizontalSeamGeometry.clone(), seamMaterial);
    verticalSeam2.rotation.z = degrees_to_radians(90); // rotate 90 degrees around Z
    basketballGroup.add(verticalSeam2);
    // create curved seams
    const createCurvedSeam = (rotationX, rotationZ) => {
        const curvedSeamGeometry = new THREE.TorusGeometry(
            seamRadius,
            seamWidth,
            8,
            48,
            degrees_to_radians(360) // full circle (360 degrees)
        );

        const curvedSeam = new THREE.Mesh(curvedSeamGeometry, seamMaterial);
        curvedSeam.rotation.x = rotationX;
        curvedSeam.rotation.z = rotationZ;
        basketballGroup.add(curvedSeam);
    };  // create 4 curved seams to form basketball pattern
    // each is a full circle rotated at a different angle
    const seamAngles = [
        [degrees_to_radians(30), 0],      // 30 degrees around X
        [0, degrees_to_radians(30)],      // 30 degrees around Z
        [degrees_to_radians(-30), 0],     // -30 degrees around X
        [0, degrees_to_radians(-30)],     // -30 degrees around Z
        [degrees_to_radians(60), 0],      // 60 degrees around X
        [0, degrees_to_radians(60)],      // 60 degrees around Z
        [degrees_to_radians(-60), 0],     // -60 degrees around X
        [0, degrees_to_radians(-60)]      // -60 degrees around Z
    ];

    seamAngles.forEach(([rotationX, rotationZ]) => {
        createCurvedSeam(rotationX, rotationZ);
    });
}

// ======
// BONOUS
// ======

function createBleachers() {
    /*
    create the bleachers on both long sides of the basketball court
    */

    // bleacher dims
    const bleacherWidth = courtWidth;
    const bleacherDepth = 5;
    const rowCount = 6;
    const rowHeight = 0.4;
    const rowDepth = 0.6;
    const sectionCount = 6;
    const seatPadding = 0.05;

    // seat material
    const seatCanvas = document.createElement('canvas');
    seatCanvas.width = 256;
    seatCanvas.height = 256;
    const seatCtx = seatCanvas.getContext('2d');

    // blue seats for home team side
    const blueSeatColor = '#0044cc';
    seatCtx.fillStyle = blueSeatColor;
    seatCtx.fillRect(0, 0, seatCanvas.width, seatCanvas.height);

    // add some texture for plastic look
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * seatCanvas.width;
        const y = Math.random() * seatCanvas.height;
        const size = Math.random() * 4 + 1;

        seatCtx.fillStyle = `rgba(30, 30, 220, ${Math.random() * 0.3})`;
        seatCtx.fillRect(x, y, size, size);
    }

    const blueSeatTexture = new THREE.CanvasTexture(seatCanvas);
    const blueSeatMaterial = new THREE.MeshPhongMaterial({
        map: blueSeatTexture,
        shininess: 40
    });

    // red seats for away team side
    const redSeatCanvas = document.createElement('canvas');
    redSeatCanvas.width = 256;
    redSeatCanvas.height = 256;
    const redSeatCtx = redSeatCanvas.getContext('2d');

    const redSeatColor = '#cc2200';
    redSeatCtx.fillStyle = redSeatColor;
    redSeatCtx.fillRect(0, 0, redSeatCanvas.width, redSeatCanvas.height);

    // add some texture for plastic look
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * redSeatCanvas.width;
        const y = Math.random() * redSeatCanvas.height;
        const size = Math.random() * 4 + 1;

        redSeatCtx.fillStyle = `rgba(220, 30, 30, ${Math.random() * 0.3})`;
        redSeatCtx.fillRect(x, y, size, size);
    }

    const redSeatTexture = new THREE.CanvasTexture(redSeatCanvas);
    const redSeatMaterial = new THREE.MeshPhongMaterial({
        map: redSeatTexture,
        shininess: 40
    });

    // create bleacher groups
    const northBleacherGroup = new THREE.Group();
    const southBleacherGroup = new THREE.Group();

    function createBleacherSection(width, isNorthSide, useBlueSeats) {
        /*
        create a single bleacher section with multiple rows of seats
        */

        const sectionGroup = new THREE.Group();
        const seatMaterial = useBlueSeats ? blueSeatMaterial : redSeatMaterial;

        // create each row of seats
        for (let row = 0; row < rowCount; row++) {
            // calculate y position based on row (each row is higher)
            const rowY = row * rowHeight;

            // calculate z offset based on row and side (each row further back)
            const rowZ = row * rowDepth * (isNorthSide ? -1 : 1);

            // create row platform
            const rowStructureGeo = new THREE.BoxGeometry(width, rowHeight * 0.2, rowDepth);
            const rowStructure = new THREE.Mesh(
                rowStructureGeo,
                new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 10 })
            );

            // position row structure
            rowStructure.position.set(
                0,
                rowY + rowHeight * 0.1,
                rowZ
            );

            rowStructure.castShadow = true;
            rowStructure.receiveShadow = true;
            sectionGroup.add(rowStructure);

            // calculate seats per row based on width and size of a seat
            const seatWidth = 0.5;
            const seatsPerRow = Math.floor(width / (seatWidth + seatPadding)) - 2;

            // create seats across the row
            for (let seat = 0; seat < seatsPerRow; seat++) {
                const seatX = -width / 2 + seatWidth + seat * (seatWidth + seatPadding) + seatPadding;

                // create seat geometry
                const seatGeometry = new THREE.BoxGeometry(seatWidth, rowHeight * 0.4, rowDepth * 0.6);
                const seatMesh = new THREE.Mesh(seatGeometry, seatMaterial);

                // position seat on top of row structure
                seatMesh.position.set(
                    seatX,
                    rowY + rowHeight * 0.4,
                    rowZ
                );

                seatMesh.castShadow = true;
                seatMesh.receiveShadow = true;
                sectionGroup.add(seatMesh);
            }
        }

        return sectionGroup;
    }

    // create bleacher sections on the further side (blue seats)
    for (let i = 0; i < sectionCount; i++) {
        const sectionWidth = bleacherWidth / sectionCount;
        const x = -bleacherWidth / 2 + i * sectionWidth + sectionWidth / 2;
        const section = createBleacherSection(sectionWidth * 0.95, true, true);
        section.position.set(x, 0, -7.5 - bleacherDepth / 2);
        northBleacherGroup.add(section);
    }

    // create bleacher sections on the closer side (red seats)
    for (let i = 0; i < sectionCount; i++) {
        const sectionWidth = bleacherWidth / sectionCount;
        const x = -bleacherWidth / 2 + i * sectionWidth + sectionWidth / 2;
        const section = createBleacherSection(sectionWidth * 0.95, false, false);
        section.position.set(x, 0, 7.5 + bleacherDepth / 2);
        southBleacherGroup.add(section);
    }

    scene.add(northBleacherGroup);
    scene.add(southBleacherGroup);
}

function createScoreboard() {
    /*
    create a digital scoreboard above the basketball court
    */

    const scoreboardWidth = 6;
    const scoreboardHeight = 3;
    const scoreboardDepth = 0.5;
    const scoreboardY = 11;

    const scoreboardGroup = new THREE.Group();

    // create scoreboard base
    const baseGeometry = new THREE.BoxGeometry(scoreboardWidth, scoreboardHeight, scoreboardDepth);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x222222,
        shininess: 30
    });

    const baseBox = new THREE.Mesh(baseGeometry, baseMaterial);
    baseBox.castShadow = true;
    scoreboardGroup.add(baseBox);

    // create scoreboard screen
    const screenWidth = scoreboardWidth * 0.95;
    const screenHeight = scoreboardHeight * 0.9;

    // create a canvas for the scoreboard display
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // draw scoreboard content
    function updateScoreboardDisplay(homeScore = 0, awayScore = 0) {
        // background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // team names and scores
        ctx.font = 'bold 80px Arial';
        ctx.fillStyle = '#0000FF'; // home = blue
        ctx.textAlign = 'left';
        ctx.fillText('HOME', 100, 120);

        ctx.fillStyle = '#FF0000'; // away = red
        ctx.textAlign = 'right';
        ctx.fillText('AWAY', canvas.width - 100, 120);

        // scores
        ctx.font = 'bold 120px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(homeScore.toString(), 150, 250);

        ctx.textAlign = 'right';
        ctx.fillText(awayScore.toString(), canvas.width - 150, 250);

        // game time
        ctx.font = 'bold 70px Arial';
        ctx.fillStyle = '#FFFF00';
        ctx.textAlign = 'center';
        ctx.fillText('LIVE', canvas.width / 2, 180);
        ctx.font = 'bold 50px Arial';
        ctx.fillText('BASKETBALL', canvas.width / 2, 350);
    }

    updateScoreboardDisplay();
    // create scoreboard screen texture
    const screenTexture = new THREE.CanvasTexture(canvas);
    const screenMaterial = new THREE.MeshStandardMaterial({
        map: screenTexture,
        emissive: 0x444444,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.0
    });

    // create screen mesh
    const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = scoreboardDepth / 2 + 0.01;
    scoreboardGroup.add(screen);

    // global reference for updating (for later game logic)
    window.scoreboardCanvas = canvas;
    window.scoreboardContext = ctx;
    window.scoreboardTexture = screenTexture;
    window.updateScoreboardDisplay = updateScoreboardDisplay;

    // create hanging wires
    const wireMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.7,
        roughness: 0.2
    });

    // create two wires to hang the scoreboard
    const wireRadius = 0.03;
    const wireHeight = 6;

    for (let i = -1; i <= 1; i += 2) {
        const wireGeometry = new THREE.CylinderGeometry(wireRadius, wireRadius, wireHeight);
        const wire = new THREE.Mesh(wireGeometry, wireMaterial);
        wire.position.set(i * (scoreboardWidth / 3), wireHeight / 2, 0);
        wire.castShadow = true;
        scoreboardGroup.add(wire);
    }

    // position the entire scoreboard
    scoreboardGroup.position.set(0, scoreboardY, 0);
    scene.add(scoreboardGroup);
}

// set camera position
updateCameraStatusDisplay();

// camera position presets
setTimeout(() => {
    setCameraPreset('default');
}, 100);

const cameraPresets = {
    default: { position: new THREE.Vector3(0, 12, 20), lookAt: new THREE.Vector3(0, 2, 0) },
    sideView: { position: new THREE.Vector3(35, 10, 0), lookAt: new THREE.Vector3(0, 5, 0) },
    topDown: { position: new THREE.Vector3(0, 25, 0), lookAt: new THREE.Vector3(0, 0, 0) },
    focusedCourt: { position: new THREE.Vector3(0, 8, 14), lookAt: new THREE.Vector3(0, 3, 0) },
    rightHoop: { position: new THREE.Vector3(20, 6, 0), lookAt: new THREE.Vector3(15, 4, 0) },
    leftHoop: { position: new THREE.Vector3(-20, 6, 0), lookAt: new THREE.Vector3(-15, 4, 0) },
    rightBasketView: { position: new THREE.Vector3(9, 6, 0), lookAt: new THREE.Vector3(15, 3.5, 0) },
    leftBasketView: { position: new THREE.Vector3(-9, 6, 0), lookAt: new THREE.Vector3(-15, 3.5, 0) },
    bleachersView: { position: new THREE.Vector3(-20, 12, 20), lookAt: new THREE.Vector3(0, 4, 0) },
    scoreboardView: { position: new THREE.Vector3(0, 6, 15), lookAt: new THREE.Vector3(0, 11, 0) }
};

let currentCameraPreset = 'default';

// set initial camera position
const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(
    cameraPresets.default.position.x,
    cameraPresets.default.position.y,
    cameraPresets.default.position.z
);
camera.applyMatrix4(cameraTranslate);
camera.lookAt(cameraPresets.default.lookAt);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(cameraPresets.default.lookAt);
let isOrbitEnabled = true;
let isUiVisible = true;

function setCameraPreset(presetName) {
    /*
    set the camera to a specific preset position
    */

    if (cameraPresets[presetName]) {
        currentCameraPreset = presetName;

        const wasOrbitEnabled = controls.enabled;
        controls.enabled = false;

        // animate to the new position
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        const endPosition = cameraPresets[presetName].position.clone();
        const endTarget = cameraPresets[presetName].lookAt.clone();

        const duration = 1000; // in milliseconds
        const startTime = Date.now();

        function animateCamera() {
            /*
            animate the camera to the new position
            */

            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const easeT = t * t * (3 - 2 * t); // smoothing

            camera.position.lerpVectors(startPosition, endPosition, easeT);
            controls.target.lerpVectors(startTarget, endTarget, easeT);

            camera.lookAt(controls.target);
            controls.update();

            if (t < 1) {
                requestAnimationFrame(animateCamera);
            } else {
                controls.enabled = wasOrbitEnabled;

                // update the camera status display
                updateCameraStatusDisplay();
            }
        }

        animateCamera();
    }
}

function updateCameraStatusDisplay() {
    /*
    update the camera status display with the current preset and orbit mode
    */

    const cameraStatus = document.getElementById('camera-status');
    if (cameraStatus) {
        const presetName = currentCameraPreset.charAt(0).toUpperCase() + currentCameraPreset.slice(1);
        cameraStatus.textContent = `Camera Mode: ${presetName} | Orbit: ${isOrbitEnabled ? 'Enabled' : 'Disabled'}`;

        // highlight the status for a moment
        cameraStatus.style.color = '#8aff8a';
        setTimeout(() => {
            cameraStatus.style.color = '#CCC';
        }, 1000);
    }
}

// Create all elements
createBasketballCourt();
createBasketballHoops();
createBasketball();
createBleachers();
createScoreboard();

// ========================
// UI FRAMEWORK PREPARATION
// ========================

// create CSS style element
const styleElement = document.createElement('style');
styleElement.textContent = `
  .ui-container {
    position: absolute;
    font-family: 'Arial', sans-serif;
    color: white;
    padding: 15px;
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    z-index: 1000;
  }
  
  .ui-container:hover {
    background-color: rgba(0, 0, 0, 0.7);
  }
    .controls-container {
    bottom: 20px;
    left: 20px;
    max-width: 300px;
    max-height: 80vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  }
  
  .controls-container::-webkit-scrollbar {
    width: 6px;
  }
  
  .controls-container::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }
  
  .scoreboard-container {
    top: 15px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    min-width: 260px;
    background-color: rgba(0, 0, 0, 0.7);
    border: 2px solid rgba(255, 204, 0, 0.8);
    border-radius: 8px;
    box-shadow: 0 0 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 204, 0, 0.1);
    padding: 8px 15px;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }
  
  .scoreboard-title {
    font-size: 16px;
    color: #FFCC00;
    letter-spacing: 1px;
    margin-bottom: 6px;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(255, 204, 0, 0.7);
    padding-bottom: 4px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  }
  
  .team-score {
    display: flex;
    justify-content: space-around;
    margin: 8px 0 5px;
    padding: 8px 10px;
    background-color: rgba(20, 20, 30, 0.75);
    border-radius: 6px;
    border: 1px solid rgba(255, 204, 0, 0.4);
    font-weight: bold;
    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 1px rgba(0, 0, 0, 1);
    color: white;
    font-size: 14px;
  }
  
  .score-value {
    font-size: 18px;
    margin-left: 6px;
    color: #FFCC00;
    text-shadow: 0 0 3px rgba(255, 204, 0, 0.5), 1px 1px 1px rgba(0, 0, 0, 0.9);
    background-color: rgba(0, 0, 0, 0.4);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #FFA500;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }
  
  h4 {
    margin-top: 12px;
    margin-bottom: 6px;
    color: #FFC857;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    font-size: 16px;
  }
  
  .key-command {
    background-color: #333;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    margin: 0 3px;
  }
    .camera-status {
    font-style: italic;
    margin-top: 5px;
    font-size: 14px;
    color: #CCC;
  }
  
  .key-feedback {
    padding: 10px 16px;
    font-size: 18px;
    background-color: rgba(0, 0, 0, 0.7);
    border: 2px solid #ffcc00;
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.5s ease;
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    text-align: center;
    min-width: 320px;
    color: #ffcc00;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  .power-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.7);
    border: 2px solid #ffcc00;
    border-radius: 6px;
    padding: 10px;
    width: 200px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .power-label {
    color: #ffcc00;
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 5px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
  }
  
  .power-bar-container {
    width: 180px;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 5px;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
  }
  
  .power-bar {
    height: 100%;
    width: 50%;
    background: linear-gradient(to right, #00ff00, #ffff00, #ff0000);
    transition: width 0.2s ease;
    border-radius: 10px;
  }
  
  .power-value {
    color: white;
    font-weight: bold;
    font-size: 14px;
  }
  
  @media (max-width: 768px) {
    .ui-container {
      padding: 10px;
    }
    .scoreboard-container {
      max-width: 90%;
    }
  }
`;
document.head.appendChild(styleElement);

// create scoreboard container
const scoreboardContainer = document.createElement('div');
scoreboardContainer.className = 'ui-container scoreboard-container';
scoreboardContainer.innerHTML = `
  <h3 class="scoreboard-title">SCOREBOARD</h3>
  <div class="team-score">
    <div>HOME <span class="score-value" id="home-score">0</span></div>
    <div>AWAY <span class="score-value" id="away-score">0</span></div>
  </div>
`;
document.body.appendChild(scoreboardContainer);

// instructions display
const instructionsContainer = document.createElement('div');
instructionsContainer.className = 'ui-container controls-container';
instructionsContainer.innerHTML = `
  <h3>CONTROLS</h3>
  <p><span class="key-command">O</span> Toggle orbit camera</p>
  <p><span class="key-command">H</span> Toggle UI visibility</p>
  <p><span class="key-command">R</span> Reset ball position & power</p>
  
  <h4>Camera Presets</h4>
  <p><span class="key-command">1</span> Default view</p>
  <p><span class="key-command">2</span> Side view</p>
  <p><span class="key-command">3</span> Top-down view</p>
  <p><span class="key-command">4</span> Centered view</p>
  <p><span class="key-command">5</span> Right hoop view</p>
  <p><span class="key-command">6</span> Left hoop view</p>
  <p><span class="key-command">7</span> In front of right basket</p>
  <p><span class="key-command">8</span> In front of left basket</p>
  <p><span class="key-command">9</span> Bleachers view</p>
  <p><span class="key-command">0</span> Scoreboard view</p>
  
  <h4>Ball Movement</h4>
  <p><span class="key-command">A</span>/<span class="key-command">D</span> Move ball left/right</p>
  <p><span class="key-command">←→</span> Move ball left/right</p>
  <p><span class="key-command">↑↓</span> Move ball forward/backward</p>
  
  <h4>Shot Controls</h4>
  <p><span class="key-command">W</span> Increase shot power</p>
  <p><span class="key-command">S</span> Decrease shot power</p>
  <p><span class="key-command">SPACE</span> Shoot ball</p>
  <p><span class="key-command">R</span> Reset ball position & power</p>
  
  <div class="camera-status" id="camera-status">Camera Mode: Default | Orbit: Enabled</div>
`;
document.body.appendChild(instructionsContainer);

// create feedback for all key presses (placeholder for future functionality) 
const keyFeedbackElement = document.createElement('div');
keyFeedbackElement.id = 'key-feedback';
keyFeedbackElement.className = 'key-feedback';
document.body.appendChild(keyFeedbackElement);

// create power indicator
const powerContainer = document.createElement('div');
powerContainer.className = 'power-container ui-container';
powerContainer.innerHTML = `
  <div class="power-label">SHOT POWER</div>
  <div class="power-bar-container">
    <div class="power-bar" id="power-bar"></div>
  </div>
  <div class="power-value" id="power-value">50%</div>
`;
document.body.appendChild(powerContainer);

function handleKeyDown(e) {
    /*
    handle keydown events for camera controls and game mechanics
    */

    // get the feedback element
    const keyFeedback = document.getElementById('key-feedback');

    let feedbackMessage = '';

    // Register key press for movement controls
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) {
        basketballMovement.keysPressed[e.key] = true;
    }

    // W/S for power adjustment
    if (e.key === "w" || e.key === "W") {
        adjustShotPower(basketballMovement.shotPower.step);
        feedbackMessage = `Shot power increased: ${basketballMovement.shotPower.current}%`;
    } else if (e.key === "s" || e.key === "S") {
        adjustShotPower(-basketballMovement.shotPower.step);
        feedbackMessage = `Shot power decreased: ${basketballMovement.shotPower.current}%`;
    }

    // Orbit camera toggle with O key
    if (e.key === "o" || e.key === "O") { // case insensitive
        isOrbitEnabled = !isOrbitEnabled;
        updateCameraStatusDisplay();
        feedbackMessage = `Camera Orbit Mode: ${isOrbitEnabled ? 'Enabled' : 'Disabled'}`;
    }

    // camera preset keys (1-6)
    else if (e.key === "1") {
        setCameraPreset('default');
        feedbackMessage = `Camera Preset: Default View`;
    }
    else if (e.key === "2") {
        setCameraPreset('sideView');
        feedbackMessage = `Camera Preset: Side View`;
    }
    else if (e.key === "3") {
        setCameraPreset('topDown');
        feedbackMessage = `Camera Preset: Top-Down View`;
    }
    else if (e.key === "4") {
        setCameraPreset('focusedCourt');
        feedbackMessage = `Camera Preset: Focused Court View`;
    }
    else if (e.key === "5") {
        setCameraPreset('rightHoop');
        feedbackMessage = `Camera Preset: Right Hoop View`;
    }
    else if (e.key === "6") {
        setCameraPreset('leftHoop');
        feedbackMessage = `Camera Preset: Left Hoop View`;
    }
    else if (e.key === "7") {
        setCameraPreset('rightBasketView');
        feedbackMessage = `Camera Preset: In Front of Right Basket`;
    }
    else if (e.key === "8") {
        setCameraPreset('leftBasketView');
        feedbackMessage = `Camera Preset: In Front of Left Basket`;
    }
    else if (e.key === "9") {
        setCameraPreset('bleachersView');
        feedbackMessage = `Camera Preset: Bleachers View`;
    }
    else if (e.key === "0") {
        setCameraPreset('scoreboardView');
        feedbackMessage = `Camera Preset: Scoreboard View`;
    }
    // W/S keys for power adjustment already handled above
    else if (e.key === "a" || e.key === "A") {
        feedbackMessage = `Key pressed: ${e.key.toUpperCase()} (move ball left)`;
    }
    else if (e.key === "d" || e.key === "D") {
        feedbackMessage = `Key pressed: ${e.key.toUpperCase()} (move ball right)`;
    }
    // arrow keys
    else if (e.key === "ArrowUp") {
        feedbackMessage = `Key pressed: ↑ (move ball forward)`;
    }
    else if (e.key === "ArrowDown") {
        feedbackMessage = `Key pressed: ↓ (move ball backward)`;
    }
    else if (e.key === "ArrowLeft") {
        feedbackMessage = `Key pressed: ← (move ball left)`;
    }
    else if (e.key === "ArrowRight") {
        feedbackMessage = `Key pressed: → (move ball right)`;
    }
    // space and R keys
    else if (e.key === " ") {
        // (allow shooting if the ball is not already in air)
        if (!basketballMovement.shooting.active) {
            shootBasketball();
            feedbackMessage = `Shot taken with power: ${basketballMovement.shotPower.current}%`;
        } else {
            feedbackMessage = `Ball is already in air!`;
        }
    } else if (e.key === "r" || e.key === "R") {
        resetBasketballPosition();
        feedbackMessage = `Key pressed: ${e.key.toUpperCase()} (ball position and shot power reset)`;
    }
    // toggle UI visibility with H/h key
    else if (e.key === "h" || e.key === "H") {
        toggleUIVisibility();
        feedbackMessage = `UI controls: ${isUiVisible ? 'Shown' : 'Hidden'}`;
    }

    // display the feedback message
    if (feedbackMessage) {
        keyFeedback.textContent = feedbackMessage;
        keyFeedback.style.opacity = '1';

        // hide the feedback after some time
        setTimeout(() => {
            keyFeedback.style.opacity = '0';
        }, 2500);
    }
}

function toggleUIVisibility() {
    /*
    toggle the visibility of UI elements (scoreboard, controls, power indicator)
    */

    isUiVisible = !isUiVisible;

    // get UI elements
    const scoreboardContainer = document.querySelector('.scoreboard-container');
    const controlsContainer = document.querySelector('.controls-container');
    const powerContainer = document.querySelector('.power-container');

    // set visibility
    if (isUiVisible) {
        scoreboardContainer.style.opacity = '1';
        scoreboardContainer.style.visibility = 'visible';
        controlsContainer.style.opacity = '1';
        controlsContainer.style.visibility = 'visible';
    } else {
        scoreboardContainer.style.opacity = '0';
        scoreboardContainer.style.visibility = 'hidden';
        controlsContainer.style.opacity = '0';
        controlsContainer.style.visibility = 'hidden';
    }

    const keyFeedback = document.getElementById('key-feedback');
    if (keyFeedback) {
        keyFeedback.style.visibility = 'visible';
    }
}

// add keyboard event listener
document.addEventListener('keydown', handleKeyDown);

// add keyup listener to track when keys are released
function handleKeyUp(e) {
    // remove key from pressed keys when released
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) {
        delete basketballMovement.keysPressed[e.key];
    }
}

document.addEventListener('keyup', handleKeyUp);

function updatePowerUI() {
    /*
    update the power bar UI based on current shot power
    */

    const powerBar = document.getElementById('power-bar');
    const powerValue = document.getElementById('power-value');

    if (powerBar && powerValue) {
        const percentage = basketballMovement.shotPower.current;
        powerBar.style.width = `${percentage}%`;

        // update the displayed power value
        powerValue.textContent = `${percentage}%`;
    }
}

function adjustShotPower(amount) {
    /*
    adjust the shot power by the specified amount
    */

    // update power level with limits
    basketballMovement.shotPower.current = Math.min(
        Math.max(basketballMovement.shotPower.current + amount, basketballMovement.shotPower.min),
        basketballMovement.shotPower.max
    );

    // update UI
    updatePowerUI();
}

function resetBasketballPosition() {
    /*
    reset the basketball position to its original state
    */

    if (window.basketballGroup) {
        const basketball = window.basketballGroup;
        const originalY = basketball.originalY !== undefined ? basketball.originalY : basketball.position.y;
        basketball.position.set(0, originalY, 0);

        // reset movement speed
        basketballMovement.currentSpeed.x = 0;
        basketballMovement.currentSpeed.z = 0;
        basketball.bouncePhase = 0;

        // reset shot power to default
        basketballMovement.shotPower.current = basketballMovement.shotPower.default;
        updatePowerUI();
    }
}

// UI update function for future game mechanics
function updateUI() {
    // this function will be expanded in HW06
    // (currently a placeholder for the future)

}

// window resize for responsive UI
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize, false);

function updateBasketballPosition() {
    /*
    update the basketball position based on user input
    */

    if (!window.basketballGroup) return;

    const basketball = window.basketballGroup;

    if (basketball.originalY === undefined) {
        basketball.originalY = basketball.position.y;
        basketball.bouncePhase = 0;
        basketball.bounceHeight = 0.05;
        basketball.bounceSpeed = 0.05;
    }

    // calculate target velocity based on which keys are currently pressed
    let targetSpeedX = 0;
    let targetSpeedZ = 0;

    // check for horizontal movement (left/right)
    if (basketballMovement.keysPressed["ArrowLeft"] || basketballMovement.keysPressed["a"] || basketballMovement.keysPressed["A"]) {
        targetSpeedX = -basketballMovement.speed;
    }
    else if (basketballMovement.keysPressed["ArrowRight"] || basketballMovement.keysPressed["d"] || basketballMovement.keysPressed["D"]) {
        targetSpeedX = basketballMovement.speed;
    }

    // check for vertical movement (forward/backward)
    if (basketballMovement.keysPressed["ArrowUp"] || basketballMovement.keysPressed["w"] || basketballMovement.keysPressed["W"]) {
        targetSpeedZ = -basketballMovement.speed;
    }
    else if (basketballMovement.keysPressed["ArrowDown"] || basketballMovement.keysPressed["s"] || basketballMovement.keysPressed["S"]) {
        targetSpeedZ = basketballMovement.speed;
    }

    // apply smooth acceleration/deceleration
    if (targetSpeedX !== 0) {
        // accelerate towards target speed
        if (Math.abs(basketballMovement.currentSpeed.x) < basketballMovement.maxSpeed) {
            basketballMovement.currentSpeed.x += (targetSpeedX > 0 ? 1 : -1) * basketballMovement.acceleration;
        }
    } else {
        // decelerate when key is not pressed
        if (basketballMovement.currentSpeed.x > 0) {
            basketballMovement.currentSpeed.x = Math.max(0, basketballMovement.currentSpeed.x - basketballMovement.deceleration);
        } else if (basketballMovement.currentSpeed.x < 0) {
            basketballMovement.currentSpeed.x = Math.min(0, basketballMovement.currentSpeed.x + basketballMovement.deceleration);
        }
    }

    // Z direction
    if (targetSpeedZ !== 0) {
        if (Math.abs(basketballMovement.currentSpeed.z) < basketballMovement.maxSpeed) {
            basketballMovement.currentSpeed.z += (targetSpeedZ > 0 ? 1 : -1) * basketballMovement.acceleration;
        }
    } else {
        if (basketballMovement.currentSpeed.z > 0) {
            basketballMovement.currentSpeed.z = Math.max(0, basketballMovement.currentSpeed.z - basketballMovement.deceleration);
        } else if (basketballMovement.currentSpeed.z < 0) {
            basketballMovement.currentSpeed.z = Math.min(0, basketballMovement.currentSpeed.z + basketballMovement.deceleration);
        }
    }

    basketballMovement.currentSpeed.x = Math.max(Math.min(basketballMovement.currentSpeed.x, basketballMovement.maxSpeed), -basketballMovement.maxSpeed);
    basketballMovement.currentSpeed.z = Math.max(Math.min(basketballMovement.currentSpeed.z, basketballMovement.maxSpeed), -basketballMovement.maxSpeed);

    // apply movement to the basketball
    basketball.position.x += basketballMovement.currentSpeed.x;
    basketball.position.z += basketballMovement.currentSpeed.z;

    // add realistic rotation to the basketball based on movement
    if (basketballMovement.currentSpeed.x !== 0 || basketballMovement.currentSpeed.z !== 0) {
        // calculate rotation axis perpendicular to movement direction
        // for x movement (left/right), rotate around z-axis
        // for z movement (forward/backward), rotate around x-axis

        const rotationFactor = basketballMovement.rotationFactor;
        const minRotation = basketballMovement.minRotation;

        // apply rotations

        // For x-axis movement (left/right)
        if (basketballMovement.currentSpeed.x !== 0) {
            // (negative for right movement)
            const directionX = basketballMovement.currentSpeed.x > 0 ? -1 : 1;

            const rotationX = Math.max(
                Math.abs(basketballMovement.currentSpeed.x * rotationFactor),
                minRotation
            ) * directionX;

            basketball.rotation.z += rotationX;
        }

        // for z-axis movement (forward/backward)
        if (basketballMovement.currentSpeed.z !== 0) {
            // (positive for forward movement)
            const directionZ = basketballMovement.currentSpeed.z > 0 ? 1 : -1;

            const rotationZ = Math.max(
                Math.abs(basketballMovement.currentSpeed.z * rotationFactor),
                minRotation
            ) * directionZ;

            basketball.rotation.x += rotationZ;
        }

        // for more natural movement
        basketball.rotation.y += (Math.random() - 0.5) * 0.03;
    }

    // court boundaries - keep the ball on the court
    if (basketball.position.x < basketballMovement.courtBounds.minX) {
        basketball.position.x = basketballMovement.courtBounds.minX;
        basketballMovement.currentSpeed.x = 0;
    } else if (basketball.position.x > basketballMovement.courtBounds.maxX) {
        basketball.position.x = basketballMovement.courtBounds.maxX;
        basketballMovement.currentSpeed.x = 0;
    }
    if (basketball.position.z < basketballMovement.courtBounds.minZ) {
        basketball.position.z = basketballMovement.courtBounds.minZ;
        basketballMovement.currentSpeed.z = 0;
    } else if (basketball.position.z > basketballMovement.courtBounds.maxZ) {
        basketball.position.z = basketballMovement.courtBounds.maxZ;
        basketballMovement.currentSpeed.z = 0;
    }

    const isMoving = Math.abs(basketballMovement.currentSpeed.x) > 0.01 ||
        Math.abs(basketballMovement.currentSpeed.z) > 0.01;

    if (isMoving) {
        const speed = Math.sqrt(
            basketballMovement.currentSpeed.x * basketballMovement.currentSpeed.x +
            basketballMovement.currentSpeed.z * basketballMovement.currentSpeed.z
        );

        basketball.bouncePhase += basketball.bounceSpeed * (speed / basketballMovement.maxSpeed) * 2;
        const bounceOffset = Math.abs(Math.sin(basketball.bouncePhase)) * basketball.bounceHeight;
        basketball.position.y = basketball.originalY + bounceOffset;
    } else {
        basketball.position.y = basketball.originalY;
        basketball.bouncePhase = 0;
    }
}

function shootBasketball() {
    /*
    shoot the basketball based on the current power level
    */

    if (!window.basketballGroup) return;

    const basketball = window.basketballGroup;
    basketballMovement.shooting.active = true;

    // calculate shooting direction - aim towards the closest basket
    const ballPosition = basketball.position;
    const leftBasketPosition = new THREE.Vector3(-courtWidth/2, 6, 0);  // left basket
    const rightBasketPosition = new THREE.Vector3(courtWidth/2, 6, 0);  // right basket

    // determine which basket is closer
    const distanceToLeft = ballPosition.distanceTo(leftBasketPosition);
    const distanceToRight = ballPosition.distanceTo(rightBasketPosition);
    const targetBasket = distanceToLeft < distanceToRight ? leftBasketPosition : rightBasketPosition;

    // calculate direction vector to the target basket
    const direction = new THREE.Vector3();
    direction.subVectors(targetBasket, ballPosition).normalize();

    // calculate power factor based on current power level (0-1)
    const powerFactor = 0.45 + (basketballMovement.shotPower.current / 100) * 0.5;

    // set velocity based on direction and power
    const velocity = basketballMovement.shooting.baseVelocity * powerFactor;

    // calculate optimal angle for the shot based on distance
    const distance = ballPosition.distanceTo(targetBasket);

    // height diff between ball and basket
    const heightDiff = 6 - ballPosition.y;

    // adjust angle based on distance and height difference
    // (further shots need a higher arc to reach the basket)
    let verticalAngle = Math.PI / 4 + (distance / 30) * 0.4;

    // max angle (to prevent extremely high arcs)
    verticalAngle = Math.min(verticalAngle, Math.PI / 2.8);

    // for very close shots, use a higher arc
    if (distance < 3) {
        verticalAngle = Math.PI / 2.5;
    }

    // set initial velocities
    basketballMovement.shooting.velocity.x = direction.x * velocity * Math.cos(verticalAngle);
    basketballMovement.shooting.velocity.z = direction.z * velocity * Math.cos(verticalAngle);
    basketballMovement.shooting.velocity.y = velocity * Math.sin(verticalAngle);

    basketballMovement.shooting.velocity.y += heightDiff * 0.35;
    // store the last position for collision detection
    basketballMovement.shooting.lastPosition = basketball.position.clone();
}

function updateShootingPhysics(deltaTime) {
    /*
    update the physics of a basketball in air
    */

    if (!window.basketballGroup || !basketballMovement.shooting.active) return;

    const basketball = window.basketballGroup;

    // store last position for collision detection
    basketballMovement.shooting.lastPosition = basketball.position.clone();

    basketballMovement.shooting.velocity.y += GRAVITY * deltaTime;

    // apply air resistance (slowing the ball down slightly)
    basketballMovement.shooting.velocity.x *= (1 - AIR_RESISTANCE * deltaTime);
    basketballMovement.shooting.velocity.y *= (1 - AIR_RESISTANCE * deltaTime);
    basketballMovement.shooting.velocity.z *= (1 - AIR_RESISTANCE * deltaTime);

    // move the ball based on velocity
    basketball.position.x += basketballMovement.shooting.velocity.x * deltaTime;
    basketball.position.y += basketballMovement.shooting.velocity.y * deltaTime;
    basketball.position.z += basketballMovement.shooting.velocity.z * deltaTime;

    // rotate the ball for visual effect (more spin with higher velocity)
    const speed = Math.sqrt(
        basketballMovement.shooting.velocity.x * basketballMovement.shooting.velocity.x +
        basketballMovement.shooting.velocity.y * basketballMovement.shooting.velocity.y +
        basketballMovement.shooting.velocity.z * basketballMovement.shooting.velocity.z
    );

    // spin around axis perpendicular to movement direction
    const spinFactor = basketballMovement.shooting.spinFactor;
    basketball.rotation.x += basketballMovement.shooting.velocity.z * spinFactor;
    basketball.rotation.z -= basketballMovement.shooting.velocity.x * spinFactor;

    // random rotation for realism
    basketball.rotation.y += (Math.random() - 0.5) * 0.02 * speed;

    // detect collisions with the floor
    if (basketball.position.y < basketballMovement.shooting.floorY) {
        // ball hit the floor
        basketball.position.y = basketballMovement.shooting.floorY;

        // bounce with energy loss
        const bounceFactor = 0.6;
        basketballMovement.shooting.velocity.y = -basketballMovement.shooting.velocity.y * bounceFactor;

        // reduce horizontal velocity due to friction with floor
        const frictionFactor = 0.9;
        basketballMovement.shooting.velocity.x *= frictionFactor;
        basketballMovement.shooting.velocity.z *= frictionFactor;

        // if the ball is moving very slowly after a bounce, end the shot
        if (Math.abs(basketballMovement.shooting.velocity.y) < 0.5) {
            if (speed < 0.5) {
                basketballMovement.shooting.active = false;
                basketballMovement.currentSpeed.x = 0;
                basketballMovement.currentSpeed.z = 0;
            }
        }
    }

    // detect collision with court boundaries
    if (basketball.position.x < basketballMovement.courtBounds.minX) {
        basketball.position.x = basketballMovement.courtBounds.minX;
        basketballMovement.shooting.velocity.x = -basketballMovement.shooting.velocity.x * 0.8;
    } else if (basketball.position.x > basketballMovement.courtBounds.maxX) {
        basketball.position.x = basketballMovement.courtBounds.maxX;
        basketballMovement.shooting.velocity.x = -basketballMovement.shooting.velocity.x * 0.8;
    }

    if (basketball.position.z < basketballMovement.courtBounds.minZ) {
        basketball.position.z = basketballMovement.courtBounds.minZ;
        basketballMovement.shooting.velocity.z = -basketballMovement.shooting.velocity.z * 0.8;
    } else if (basketball.position.z > basketballMovement.courtBounds.maxZ) {
        basketball.position.z = basketballMovement.courtBounds.maxZ;
        basketballMovement.shooting.velocity.z = -basketballMovement.shooting.velocity.z * 0.8;
    }

    // Simple detection for basket scoring (could be enhanced further)
    checkForScoring(basketball.position);
}
// init UI components
function initUI() {
    updatePowerUI();
}

// track time for physics calculations
let lastTime = Date.now();

// Animation function
function animate() {
    requestAnimationFrame(animate);

    // calculate time diff for physics updates
    const currentTime = Date.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    controls.enabled = isOrbitEnabled;

    // only update controls if orbit is enabled
    if (isOrbitEnabled) {
        controls.update();
    }

    if (basketballMovement.shooting.active) {
        // if the ball is in air use shooting physics
        updateShootingPhysics(deltaTime);
    } else {
        // otherwise use normal movement controls
        updateBasketballPosition();
    }

    updateUI();
    renderer.render(scene, camera);
}

initUI();

animate();
