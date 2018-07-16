/* ================ Setting up the 3D scene ================ */
//                                                           //
//   DO NOT CHANGE THE VARIABLE NAMES IF USING addToState(0.)  //
//                                                           //
/* ========================================================= */
var scene = new THREE.Scene(),
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 20000)

renderer.setPixelRatio(window.devicePixelRatio)
renderer.setClearColor(0x000000, 0)

function onSlideResize(width, height) {
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

/* ========================================================== */
/* ============== Done Setting up the 3D scene ============== */
/* ========================================================== */

// Add canvas to slide.
// Uncomment the line below if your slide name is "3D"

document.getElementById("3D").appendChild(renderer.domElement)


/* ===================================== */
/* ============== Lights! ============== */
/* ===================================== */

var lights = []
lights[0] = new THREE.SpotLight(0xffffff, .15, 0)
lights[1] = new THREE.SpotLight(0xffffff, .05, 0)
lights[2] = new THREE.SpotLight(0xffffff, .25, 0)

lights[0].position.set(0, 1000, 0)
lights[1].position.set(100, 1000, 150)
lights[2].position.set(-50, -200, -100)

for (var i=0; i<lights.length; i++) {
  lights[i].castShadow = true
  scene.add(lights[i])
}


/* ===================================== */
/* ============== Shapes! ============== */
/* ===================================== */

var water = new THREE.Group()

scene.add(water)

var hydrogenGeometry = new THREE.SphereGeometry(.75, 32, 32),
    hydrogenMaterial = new THREE.MeshLambertMaterial({
      emissive: 0xf9ae65,
  		side: THREE.DoubleSide
    }),
    hydrogenAtom0 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial),
    hydrogenAtom1 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial)

var hydrogen0 = new THREE.Group(),
    hydrogen1 = new THREE.Group()

hydrogen0.add(hydrogenAtom0)
hydrogen1.add(hydrogenAtom1)

water.add(hydrogen0)
water.add(hydrogen1)

var oxygenGeometry = new THREE.SphereGeometry(1.15, 32, 32),
    oxygenMaterial = new THREE.MeshLambertMaterial({
      emissive: 0xac88e6,
  		side: THREE.DoubleSide
    }),
    oxygen = new THREE.Mesh(oxygenGeometry, oxygenMaterial)

water.add(oxygen)


var dipoleDirection0 = new THREE.Vector3(-1,0,0),
    dipoleDirection1 = new THREE.Vector3(1,0,0),
       origin = new THREE.Vector3(0,0,0),
       dipoleArrow0 = new THREE.ArrowHelper(dipoleDirection0, origin, 3.5, 0xFFFFFF, .35, .15),
       dipoleArrow1 = new THREE.ArrowHelper(dipoleDirection1, origin, 3.5, 0xFFFFFF, .35, .15),
       dipole0 = new THREE.Group(),
       dipole1 = new THREE.Group()

dipole0.add(dipoleArrow0)
dipole1.add(dipoleArrow1)

water.add(dipole0)
water.add(dipole1)

var boxGeometry = new THREE.BoxGeometry(10, 0.25, 10),
    boxMaterial0 = new THREE.MeshLambertMaterial({
      emissive: 0x7fbee0,
      transparent: true
    }),
    boxMaterial1 = new THREE.MeshLambertMaterial({
      emissive: 0xdd7a7a,
      transparent: true
    }),
    box0 = new THREE.Mesh(boxGeometry, boxMaterial0),
    box1 = new THREE.Mesh(boxGeometry, boxMaterial1)

scene.add(box0)
scene.add(box1)


/* ===================================== */
/* ============== States! ============== */
/* ===================================== */

function vibrate0(t) {
  return (45 + 7*Math.cos(t/50))/180*Math.PI
}
function vibrate1(t) {
  return -(45 + 7*Math.cos(t/50))/180*Math.PI
}

function dipoleLength(t) {
  return 1 + 0.05*Math.cos(t/50)
}

addToState("default", camera.position, "z", 200)

addToState("default", hydrogenAtom0.position, "x", -1.25)
addToState("default", hydrogenAtom1.position, "x", 1.25)
addToState("default", hydrogen0.rotation, "z", vibrate0)
addToState("default", hydrogen1.rotation, "z", vibrate1)

addToState("default", dipole0.rotation, "z", vibrate0)
addToState("default", dipole1.rotation, "z", vibrate1)

addToState("default", dipoleArrow0.scale, "y", .25)
addToState("default", dipoleArrow1.scale, "y", .25)

addToState("default", water.position, "x", function(t) {
  return 0.5*Math.cos(t/2000)
})
addToState("default", water.position, "y", function(t) {
  return -0.25 + 0.5*Math.sin(t/1500)
})
addToState("default", water.rotation, "x", function(t) {
  return (t/1000)%(2*Math.PI)
})
addToState("default", water.rotation, "y", function(t) {
  return (t/500)%(2*Math.PI)
})
addToState("default", water.rotation, "z", Math.PI)

addToState("default", box0.position, "y", -10)
addToState("default", boxMaterial0, "opacity", 0)
addToState("default", box1.position, "y", 10)
addToState("default", boxMaterial1, "opacity", 0)

addToState(3001, camera.position, "z", 15)

addToState(3002, boxMaterial0, "opacity", 1)
addToState(3002, boxMaterial1, "opacity", 1)

addToState(3002, dipoleArrow0.scale, "y", .75)
addToState(3002, dipoleArrow1.scale, "y", .75)

addToState(3003, dipole0.rotation, "z", Math.PI/2)
addToState(3003, dipole1.rotation, "z", -Math.PI/2)
addToState(3003, dipoleArrow0.scale, "y", dipoleLength)
addToState(3003, dipoleArrow1.scale, "y", dipoleLength)


addToState(3004, water.rotation, "x", function(t) {
  return (180-120*Math.cos(t/1000))/180*Math.PI
}, 2000)
addToState(3004, water.rotation, "y", function(t) {
  return (45*Math.cos(t/1000))/180*Math.PI
}, 2000)

addToState(3004, box0.position, "y", -5, 1000)
addToState(3004, box1.position, "y", 5, 1000)
addToState(3004, camera.position, "z", 25)
addToState(3004, camera.position, "x", 4)
