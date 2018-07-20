// Pretty standard things here, we usually do not need
// to change any of these

/* ================ Setting up the 3D scene ================ */
//                                                           //
//   DO NOT CHANGE THE VARIABLE NAMES IF USING addToState()  //
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
// Note that we refrence "3D", and it should be consistent as
// the above.

document.getElementById("3D").appendChild(renderer.domElement)


/* ===================================== */
/* ============== Lights! ============== */
/* ===================================== */

// While these can be tweaked, generally the following
// setting works for most cases

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
/* ============= 0. Shapes! ============ */
/* ===================================== */

/* ================================== */
/* =========== 0.0 Water ============ */
/* ================================== */

// We create an empty group in which to place
// oxygen and hydrogen into. This allows us to
// first define the motions of the atoms
// within the molecules then animate the
// molecule as a whole
var water = new THREE.Group()

// Add water into the 3D scene so that it actually appears
scene.add(water)

// All 3D objects have a geometry and a material.
// The geometry defines the shape of the object,
// while the material defines how it looks and
// reacts to light.
//
// Most geometries are intuitively named, like
// SphereGeometry, BoxGeometry, CylinderGeometry.
//
// Materials are named after their method of calculating
// light behaviour, though I have found MeshPhongMaterial
// to work for pretty much all the cases (Something like
// MeshStandardMaterial is supposed to be more physically
// correct, but slower).
//
// More information can be found in the documentation
// of three.js: https://threejs.org/docs/
//


/* ================================== */
/* ========== 0.1 Hydrogen ========== */
/* ================================== */

// Define a sphere of radius one
var hydrogenGeometry = new THREE.SphereGeometry(1, 32, 32),
    // Make a blue material
    hydrogenMaterial = new THREE.MeshPhongMaterial({
        emissive: 0x1f65c1
    }),
    // Create a 3D object with the above geometry and material
    hydrogenAtom0 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial),
    hydrogenAtom1 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial),
    // Create two empty group to contain the hydrogen atoms.
    // This allows us to offset hydrogen _atom_ from the _hydrogen_'s
    // origin, so when we rotation hydrogen, the _hydrogen atom_
    // makes an angle like a water molecule
    hydrogen0 = new THREE.Group(),
    hydrogen1 = new THREE.Group()

// Add hydrogen atom into the hydrogen group
hydrogen0.add(hydrogenAtom0)
hydrogen1.add(hydrogenAtom1)

// Add hydrogen group into water
water.add(hydrogen0)
water.add(hydrogen1)


/* ================================== */
/* =========== 0.2 Oxygen =========== */
/* ================================== */

// We do something similar to above, but just one sphere,
// and make it slightly larger
var oxygenGeometry = new THREE.SphereGeometry(2, 32, 32),
    // Make a blue material
    oxygenMaterial = new THREE.MeshPhongMaterial({
        emissive: 0xe2831d
    }),
    oxygen = new THREE.Mesh(oxygenGeometry, oxygenMaterial)

water.add(oxygen)


/* ===================================== */
/* ============ 1. States! ============= */
/* ===================================== */

/*

                      Usage
____________________________________________________________________

  addToState(slide, object, property, value)
  addToState(slide, object, property, value, dt)

    1. slide

      The "t-value" of the slide, which should
      correspond to the slides above. Can be
      "default" (in quotes), or a number


    2. object

       The object whose property we wish to
       set. Commonly, these are things like

         camera.position
         oxygen.rotation
         hydrogen.scale
         oxygenMaterial.emissive

       Note that if we wanted to change the
       _look_ of an object, we have to
       change its material - which means
       that the look of all objects that
       share a material will *also* change


    3. property

       The specific property of the object
       we wish to set. Almost always

        "x"
        "y"
        "z"

       While for colours (emissive),

        "r"
        "g"
        "b"

       where each takes a value between
       0 and 1: so we have to convert
       the hex colour into r, g, b
       and change each accordingly


    4. value

       The value we want to set.
       Note: Rotations are in radians
       Accepts numbers or functions.

       If they are functions, they
       should be functions that take
       in time variable t, which is
       an internal clock that begins
       once the presentation starts,
       and returns a value.


    5. dt (optional, defaults to 750ms)

       Time taken to transition between
       the previous property and the
       current one.

       Accepts numbers (interpreted as
       milliseconds) or strings e.g.
       "1000ms", "2s"


____________________________________________________________________

  addToState([slide1, slide2, ...], object, property, value[, dt])

    is shorthand for

  addToState(slide1, object, property, value)
  addToState(slide2, object, property, value)
                  ...
____________________________________________________________________

  addToState(slide, [object1, object2, ...], property, value[, dt])

    is shorthand for

  addToState(slide, object1, property, value[, dt])
  addToState(slide, object2, property, value[, dt])
                 ...
____________________________________________________________________

  addToState(slide, object, {
    property1: value1,
    property2: value2,
    ...
  }[, dt])

    is shorthand for

  addToState(slide, object, property1, value1[, dt])
  addToState(slide, object, property2, value2[, dt])
                  ...

*/

// Since rotation occurs in radians and it's easier to
// work with degrees, we'll set the scaling factor here
var deg = Math.PI/180,
    // Define the angular frequency for the
    // molecular oscillation
    omega = (2*Math.PI)/750


/* ================================== */
/* ====== 1.0 Camera movements ====== */
/* ================================== */

// Move the camera very far away, then
// bring it closer at the first slide
addToState("default", camera.position, "z", 2000)
addToState(1, camera.position, "z", 20, 1500)


/* ================================== */
/* ======= 1.1 Default states ======= */
/* ================================== */

// Move the hydrogen atoms down to y = -2.5,
// so that it juts out a bit
addToState("default",
    [
        hydrogenAtom0.position,
        hydrogenAtom1.position
    ],
    "y", -2.5)

// Oscillation of hydrogen: the hydrogen atoms
// both begin along the -y axis. Since the
// angle between them is 104.5 degrees, they
// will each be ±104.5/2 degrees from -y
//
// Then, a cosine function is added (with
// angular frequency omega) for each
// to rotate about ±104.5/2 degrees by
// ±10 degrees
addToState("default", hydrogen0.rotation, "z", function(t) {
    return  ( 104.5/2 + 10*Math.cos(omega*t) )*deg
})
addToState("default", hydrogen1.rotation, "z", function(t) {
    return -( 104.5/2 + 10*Math.cos(omega*t) )*deg
})

// Oscillation of all the components of the
// water molecule moving up and down in
// tandem with the oscillation of hydrogen
// due to the shift of the centre of mass
addToState("default",
    [
        oxygen.position,
        hydrogen0.position,
        hydrogen1.position
    ],
    "y",  function(t) {
        return -0.25*Math.cos(omega*t)
    })

// "Random" oscillatory movement of the water's position
// and rotation: we just add a faster and lower amplitude,
// and a slower and larger amplitude oscillation
// to make it look like the water is floating around
// somewhat randomly
addToState("default", water.position, {
    x: function(t) {return 2*Math.sin(t/2500) + 0.25*Math.sin(t/750)},
    y: function(t) {return 2*Math.sin(t/3000) + 0.25*Math.sin(t/500)},
    z: function(t) {return 2*Math.cos(t/7000) + 0.25*Math.cos(t/600)}
})
addToState("default", water.rotation, {
    x: function(t) {return (180*Math.sin(t/2500) + 5*Math.sin(t/750))*deg},
    y: function(t) {return (180*Math.sin(t/3000) + 5*Math.sin(t/500))*deg},
    z: function(t) {return (180*Math.cos(t/7000) + 5*Math.cos(t/600))*deg}
})


/* ================================== */
/* = 1.2 Stopping random movements == */
/* ================================== */

// Set the positions and rotations to 0 to
// stop the "random" movements *slowly*,
// therefore a larger dt value.
addToState(2,
    [
        water.position,
        water.rotation
    ],
    {
        x: 0,
        y: 0,
        z: 0
    },
    2500)


/* ================================== */
/* == 1.3 Change vibrational mode === */
/* ================================== */

// In this vibrational mode, the molecular
// components are instead vibrating along
// the x-direction
addToState(3,
    [
        oxygen.position,
        hydrogen0.position,
        hydrogen1.position
    ],
    {
        x: function(t) {return -0.25*Math.sin(omega*t)},
        y: 0
    })

// Also, the hydrogen atoms are moving closer and
// further from water's origin, so change the z
// rotation of the *group* to 0, then set the y
// position of the *atom* to be the oscillation
addToState(3, hydrogen0.rotation, "z", (104.5/2)*deg)
addToState(3, hydrogenAtom0.position, "y", function(t) {
        return -2.25-0.25*Math.cos(omega*t)
    })

addToState(3, hydrogen1.rotation, "z", -(104.5/2)*deg)
addToState(3, hydrogenAtom1.position, "y", function(t) {
        return -2.25+0.25*Math.cos(omega*t)
    })
