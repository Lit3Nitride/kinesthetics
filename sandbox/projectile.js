
/* ================ Setting up the 3D scene ================ */
//                                                           //
//  Standard things we don't need to change most of the time //
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

document.getElementById("3D").appendChild(renderer.domElement)

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

/* ================ Setting up the 3D scene ================ */
//                                                           //
//                 Standard things ends here                 //
//                                                           //
/* ========================================================= */


/* ===================================== */
/* ============== Shapes! ============== */
/* ===================================== */

// This defines the number of freeze frames
// we wish to see in the animation
var numberOfBalls = 9

// This creates the spherical geometry, and initialises
// the arrays that will contain all the objects
var ballGeometry = new THREE.SphereGeometry(1, 32, 32),

    // Instead of having material1, material2, material3...,
    // we create an array that will contain all the materials.
    ballMaterials = [],
    shadowMaterials = [],

    // Similarly, we create an array that will contain the balls,
    // and also the shadows. So the first shadow is shadows[0],
    // then the second shadow will be shadow[1] etc.
    balls = [],
    shadows = []

for (var i=0; i<numberOfBalls; i++) {

    // The materials of all the balls are the same,
    // _except_ its opacity, which gradually
    // increases from almost transparent to
    // completely opaque
    ballMaterials.push(
        new THREE.MeshPhongMaterial({
            emissive: 0xAA3300,

            // Here we define its opacity as 1,
            // but later on it will change
            // based on its index as a fraction
            // of the total number of balls.
            // Hence the earlier balls will be
            // more transparent
            opacity: 1,

            // Also we need to tell three.js that
            // the balls are going to be transparent
            transparent: true
        })
    )

    // Then we create and push the object into the object array
    balls.push(new THREE.Mesh(ballGeometry, ballMaterials[i]))

    // And add the object (in the array) into the scene
    scene.add(balls[i])

    // Same thing with the "shadows"
    shadowMaterials.push(
        new THREE.MeshPhongMaterial({
            emissive: 0x555555,
            opacity: 1,
            transparent: true
        })
    )
    shadows.push(new THREE.Mesh(ballGeometry, shadowMaterials[i]))
    scene.add(shadows[i])
}

// Add the ground. This is just a box that is really thin.
var groundGeometry = new THREE.BoxGeometry(25, 0.05, 20),
    groundMaterial = new THREE.MeshPhongMaterial({emissive: 0x999999}),
    ground = new THREE.Mesh(groundGeometry, groundMaterial)

scene.add(ground)

// Create an array to contain the velocity vectors v_x, v_y and v
var vectors = [],
    // and an array that contains the colour for each of them
    vectorColors = [0x2180d3, 0xe2362d, 0x815B80]

for (var i=0; i<3; i++) {
    vectors.push(
        // THREE.ArrowHelper is a helper function that
        // creates 3D arrows
        new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0), // Direction
            new THREE.Vector3(0, 0, 0), // Origin
            5, // Length
            vectorColors[i], // Colour
            .5, // Arrowhead length
            .35 // Arrowhead radius
        )
    )
    // Add all the vectors into the last ball,
    // the vectors will always have its origin
    // in relation to where the last ball is
    balls[balls.length-1].add(vectors[i])
}

// --------------------------------------------------- //
//                NOTE about easing
// --------------------------------------------------- //

/*
  addToState accepts an argument to define a custom
  ease function, where an ease function is a function
  that takes in values of t in [0, 1], x1, and x0,
  and gives a value x(t, x1, x0).

  It is, basically, interpolation.

  For example, linear interpolation would be given by

  function(t, x0, x1) {
    return (x1-x0)*t + x0
  }

  (here t not the discrete state variable we use to number the slides)
  t always gives the current time as a fraction of the transition time.
  So if dt = 300, this means that a property takes 300ms to go from x0 to x1,
  and t=1 is 300ms after t=0

  In this script, we take advantage of this by ignoring the actual x0 and x1
  being passed into the ease to carry out projectile motion.
*/

// We will be reusing these values and functions a lot,
// so to make things easier we'll define it here first

var y0 = -5, // The starting y-coordinate (y is vertical)
    y1 = 7.5, // The maximum y-coordinate
    y = function(t) {
        // y(t) = y0 + y'*t + 0.5*y''*t**2, solved
        // so that we get y(0) = y(1) = y0,
        // and y(0.5) = y1,
        // hence the maximum point shall be
        // reached at half of the total time.
        return y0 + 4*(y1 - y0)*(t-t**2)
    },
    yp = function(t) {
        // The derivative of the above function
        return 4*(y1 - y0)*(1-2*t)
    },

    // Same for x (x is horizontal)
    x0 = -10,
    x1 = 10,
    x = function(t) {
        return (x1 - x0)*t + x0
    },
    xp = x1-x0,

    // tau is the time taken to go from x0/y0 to x1/y1
    tau = 2500


/* ===================================== */
/* ============== States! ============== */
/* ===================================== */

/*

    Let's say we have an addToState like the following:
        addToState(..., "y", 50, 2000)
    so 2000ms is the time taken for the transition.

    To use a custom ease function easeFunc(), we replace it with
        addToState(..., "y", 50, {
          dt: 2000,
          ease: easeFunc
        })
    so if we wanted to do a linear interpolation, we would do
        addToState(..., "y", 50, {
          dt: 2000,
          ease: function (t, x0, x1) {
            return (x1-x0)*t + x0
          }
        })

-----------------------------------------------------------------

        addToState(["default", 2], ...)
    is shorthand for
        addToState("default", ...)
        addToState(2, ...)

-----------------------------------------------------------------

        addToState(..., camera.position, {x: -27, z: 27})
    is shorthand for
        addToState(..., camera.position, "x", -27)
        addToState(..., camera.position, "x", 27)

*/

// Set the camera position slightly to the side
addToState(["default", 2], camera.position, {x: -27, z: 27})
addToState(["default", 2], camera.rotation, "y", -Math.PI/4)

// Rotate the camera together with the projectile so we see the
// x-y plane straight on
addToState([1, 3], camera.position, {x: 0, z: 35}, tau)
addToState([1, 3], camera.rotation, "y", 0, tau)

// Place the ground to where the bottom of the ball is,
// which is -(position of ball)-(radius of ball)
addToState(["default", 2], ground.position, "y", -5-1)

for (var i=0; i<balls.length; i++) {
    // t1 is the time (remember, time in the ease function is from 0 to 1)
    // in which the ball "freezes".
    //
    // For example, if we have three balls, we want the first ball to freeze
    // at t=0, the second ball at t=0.5, and the last ball at t=1
    //
    // Since the index of the balls are {0,1,2}, this works out to be
    // (current index)/(last index)
    let t1 = i/(balls.length-1)

    // Set the initial position of the balls
    addToState(["default", 2], balls[i].position, "y", y0)
    // The shadows are actually just squashed balls: we make the
    // scale of the shadow objects os it's very thin.
    addToState(["default", 2], shadows[i].scale, "y", 0.1)
    // The initial position of the shadows, since they are flattened,
    // should be one radius of the ball lower than the ball
    addToState(["default", 2], shadows[i].position, "y", y0-1)

    // Since t1 gives the time in which the ball should "freeze",
    // and y(t) gives the y position at every t,
    // the end point of the ball should be at y(t1)
    addToState([1, 3], balls[i].position, "y", y(t1), {
        dt: tau,
        ease: function(t) {
            if (t < t1)
                // Give the y-coordinate when we're not at the freezing point
                return y(t)
            else
                // If we're past the freezing point, only give back the
                // y-coordinate of the freezing point
                return y(t1)
        }
    })

    // Same for the x coordinate
    addToState(["default", 2], [balls[i].position,shadows[i].position], "x", x0)
    addToState([1, 3], [balls[i].position,shadows[i].position], "x", x(t1), {
        dt: tau,
        ease: function(t) {
            if (t > t1)
                return x(t1)
            else
                return x(t)
        }
    })

    // Finally we change the opacity of the ball and shadow's
    // materials to be the fraction of its index in relation to
    // the total number of balls (so the first ball is the most
    // transparent, while the last ball is completely opaque)
    addToState([1, 3], [
        ballMaterials[i],
        shadowMaterials[i]
    ], "opacity", (i+1)/balls.length, tau)

    // And reset them both at slide 2
    addToState(2, [
        ballMaterials[i],
        shadowMaterials[i]
    ], "opacity", 1)
}

// vectors[0] gives the x-velocity vector, so we rotate it to +x
// (by default the vectors are pointing at +y)
addToState(["default", 2], vectors[0].rotation, "z", -Math.PI/2)
// Scale the scale of the vector according to the ratio between
// x-velocity magnitude and the total initial velocity magnitude
addToState(["default", 2], vectors[0].scale, "y", xp/Math.sqrt(yp(0)**2 + xp**2))

// Same for vectors[1], which is the y-velocity vector,
// except the velocity changes from yp(0) to yp(1),
// so we have the scale change accordingly
addToState(["default", 2], vectors[1].scale, "y", yp(0)/Math.sqrt(yp(0)**2 + xp**2))
addToState([1, 3], vectors[1].scale, "y", yp(1)/Math.sqrt(yp(0)**2 + xp**2), {
    dt: tau,
    ease: function(t) {
        return yp(t)/Math.sqrt(yp(0)**2 + xp**2)
    }
})

// Here we get the total velocity vector to rotate accoridngly
// Using the arctangent of the x and y vectors
addToState(["default", 2], vectors[2].rotation, "z", -Math.PI/2 + Math.atan2(yp(0), xp))
addToState([1, 3], vectors[2].rotation, "z", -Math.PI/2 + Math.atan2(yp(1), xp), {
    dt: tau,
    ease: function(t) {
        return -Math.PI/2 + Math.atan2(yp(t), xp)
    }
})
addToState([1, 3], vectors[2].scale, "y", Math.sqrt((yp(1)**2 + xp**2)/(yp(0)**2 + xp**2)), {
    dt: tau,
    ease: function(t) {
        return Math.sqrt((yp(t)**2 + xp**2)/(yp(0)**2 + xp**2))
    }
})
