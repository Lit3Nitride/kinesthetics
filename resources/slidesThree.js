// Function to convert number into string
function toString(a) {
  if (typeof a != "string" && a != null) {
    a = a.toString()

    var aSub = a.indexOf("e")

    if (aSub != -1)
      a = Number(a).toFixed(Math.max(-parseInt(a.substr(aSub+1)), 0))
  }
  return a
}

var ease = {
  cubic: function(t, x0, x1) {
    return (x1-x0)*(t < .5 ? 2*t*t:4*t-2*t*t-1)+x0
  },
  linear: function(t, x0, x1) {
    return (x1-x0)*t + x0
  }
}

function doEase(t, x0, x1, easeFunc) {
  easeFunc = easeFunc || ease.cubic
  return t <= 0 ? x0:
         t >= 1 ? x1:
         easeFunc(t, x0, x1)
}

function validateEase(easeFunc) {
  var isValid= [true, true]
  for (var i=0; i<5; i++) {
    var x = [
              1E2*(Math.random()-.5),
              1E2*(Math.random()-.5)
            ]
    for (var j=0; j<2; j++)
      isValid[j] = isValid[j] && easeFunc(j, x[0], x[1]) == x[j]
  }
  return isValid
}

var states = {default: []},
    slidesReady = false

window.disableSlideChange = true

var controls, prev = {position: {}, rotation: {}}
function triggerCamera() {
  if (!enableCamera)
    for (var i=0; i<2; i++) {
      for (var j=0; j<3; j++) {
        prev[["position", "rotation"][i]][["x", "y", "z"][j]] = camera[["position", "rotation"][i]][["x", "y", "z"][j]]
      }
    }
  else
    for (var i=0; i<2; i++) {
      for (var j=0; j<3; j++) {
        camera[["position", "rotation"][i]][["x", "y", "z"][j]] = prev[["position", "rotation"][i]][["x", "y", "z"][j]]
      }
    }
  window.enableCamera =
  controls.enabled = !window.enableCamera
}

var slideUnreadyCount = 0
function onSlideReady() {
  if (typeof scene == "undefined")
    if (slideUnreadyCount++ < 5)
      return setTimeout(onSlideReady, 500)
    else
      return window.disableSlideChange = false
  if (typeof THREE.OrbitControls != "undefined") {
    window.enableCamera = false
    controls = new THREE.OrbitControls(camera)
    controls.enabled = false
    controls.rotateSpeed = 5.0
    controls.zoomSpeed = 3.2
    controls.panSpeed = 0.8
    controls.enableZoom = true
    controls.update()
  }
  setTimeout(function() {
    if (window.preload3D !== false) {
      scene.visible = false
      revisibleScene = setTimeout(function() {
        scene.visible = true
        window.disableSlideChange = false
      }, 2500)
    } else {
      window.disableSlideChange = false
    }
  }, 20)
  for (var i=0; i<tMapped.length; i++)
    states[tMapped[i]] = []
  slidesReady = true
}

var anim = {
          t0: null,
          to: false,
          arrived: true
        },
    priorObjs = {}

function onSlideChange(i, slide, arrived, isReload) {

  var prior = arrived ? (tMapped[i-2] || "default"):slide,
      subsequent = arrived ? slide:(tMapped[i-2] || "default")

  // Goes through states of prior
  // Goes through states of current. If prior does not have a value assigned to
  // its key, manually add it.

  if (states[prior] && !priorObjs[prior]) {
    priorObjs[prior] = []
    for (var i=0; i<states[prior].length; i++) {
      var stateObj = states[prior][i]
      if (typeof stateObj.value != "function") {
        stateObj.obj[stateObj.key] = stateObj.value
        delete stateObj.obj["$" + stateObj.key]
        if (!stateObj.obj["_$" + stateObj.key])
          stateObj.obj["_$" + stateObj.key] = []
        if (stateObj.obj["_$" + stateObj.key].indexOf(prior) == -1)
          stateObj.obj["_$" + stateObj.key].push(prior)
      } else {
        stateObj.obj["$" + stateObj.key] = stateObj.value
      }
      if (priorObjs[prior] !== true) {
        if (!stateObj.obj["$done"])
          stateObj.obj["$done"] = {}
        if (!stateObj.obj["$done"][stateObj.key])
          stateObj.obj["$done"][stateObj.key] = []
        if (stateObj.obj["$done"][stateObj.key].indexOf(prior) == -1)
          stateObj.obj["$done"][stateObj.key].push(prior)
      }
    }
  }

  if (states[subsequent]) {
    for (var i=0; i<states[subsequent].length; i++) {
      var stateObj = states[subsequent][i]
      if (typeof stateObj.from == "undefined")
        stateObj.from = []

      var notFunc = (stateObj.obj["_$" + stateObj.key] && stateObj.obj["_$" + stateObj.key].indexOf(prior) != -1) || !stateObj.obj["$" + stateObj.key]

      stateObj.from[arrived] = notFunc ? stateObj.obj[stateObj.key]:stateObj.obj["$" + stateObj.key]

      if (typeof stateObj.value == "undefined" || typeof stateObj.value != "function") {
        if (!stateObj.obj["_$" + stateObj.key])
          stateObj.obj["_$" + stateObj.key] = []
        if (stateObj.obj["_$" + stateObj.key].indexOf(subsequent) == -1)
          stateObj.obj["_$" + stateObj.key].push(subsequent)
      }

      if (priorObjs[prior] !== true)
        if (
            !priorObjs[prior] ||
            !stateObj.obj["$done"] ||
            !stateObj.obj["$done"][stateObj.key] ||
            stateObj.obj["$done"][stateObj.key].indexOf(prior) == -1
          ) {
            addToState(prior, stateObj.obj, stateObj.key, stateObj.from[arrived], stateObj.dt)

            if (!stateObj.obj["$done"])
              stateObj.obj["$done"] = {}
            if (!stateObj.obj["$done"][stateObj.key])
              stateObj.obj["$done"][stateObj.key] = []
            if (stateObj.obj["$done"][stateObj.key].indexOf(prior) == -1)
              stateObj.obj["$done"][stateObj.key].push(prior)

            if (isReload && arrived && prior != "default" &&
                (
                  !stateObj.obj["$done"] ||
                  !stateObj.obj["$done"][stateObj.key] ||
                  stateObj.obj["$done"][stateObj.key].indexOf("default") == -1
                )
              )
                addToState("default", stateObj.obj, stateObj.key, stateObj.from[arrived], stateObj.dt)

          }

    }

    if (priorObjs[prior] !== true)
      priorObjs[prior] = true
  }

  anim.t0 = null
  anim.arrived = arrived

  if (!isReload)
    anim.to = subsequent

}

var reloadStatesTimeout
function addToState(slide, obj, key, value, dt) {

  if (!slidesReady)
    return setTimeout(function() {
      addToState(slide, obj, key, value, dt)
    }, 500)

  if (Array.isArray(slide)) {
    for (var i=0; i<slide.length; i++)
      addToState(slide[i], obj, key, value, dt)
    return
  } else if (Array.isArray(obj)) {
    for (var i=0; i<obj.length; i++)
      addToState(slide, obj[i], key, value, dt)
    return
  }


  if (slide != "default" && typeof window.scriptOffset != "undefined")
    slide += window.scriptOffset

  if (tMapped.indexOf(toString(slide)) == -1 && tMapped.indexOf(slide) == -1 && slide != "default")
    return

  clearTimeout(reloadStatesTimeout)

  var easeFunc
  if (typeof dt == "object" && dt.ease) {
    easeFunc = dt.ease
    dt = dt.dt
  }
  if (typeof dt == "function") {
    easeFunc = dt
    dt = undefined
  }
  if (typeof dt == "undefined") {
    dt = 750
  } else if (typeof dt == "string") {
    dt = parseInt(
          dt
          .replace("ms", "")
          .replace("s", 1000)
          .replace("min", 60*1000)
        )
    }
  if (typeof easeFunc != "undefined") {
    var isValidEase = validateEase(easeFunc),
        isValidString = "The "
    if (!(isValidEase[0] && isValidEase[1])) {
      if (!isValidEase[0])
        isValidString += "start"
      if (!isValidEase[1])
        if (!isValidEase[0])
          isValidString += " and end points seem"
        else
          isValidString += "end point seems"
      else
        isValidString += " point seems"
      isValidString += " to be invalid for the ease function\n\n"
      isValidString += easeFunc.toString()
      console.warn(isValidString)
    }
  }

  if (typeof key == "number") {
    for (var i=0; i<Object.keys(obj).length; i++) {
      if (Object.keys(obj)[i].indexOf("$") == -1)
        states[slide].push({obj: obj, key: Object.keys(obj)[i], value: key, dt: value || dt, ease: easeFunc})
    }
  } else if (typeof key == "object") {
    if (Array.isArray(key)) {
      for (var i=0; i<Math.min(key.length, Object.keys(obj).length); i++) {
        states[slide].push({obj: obj, key: Object.keys(obj)[i], value: key[i], dt: value || dt, ease: easeFunc})
      }
    } else {
      keys = Object.keys(key)
      for (var i=0; i<keys.length; i++) {
        states[slide].push({obj: obj, key: keys[i], value: key[keys[i]], dt: value || dt, ease: easeFunc})
      }
    }
  } else {
    states[slide].push({obj: obj, key: key, value: value, dt: dt, ease: easeFunc})
  }

  if (priorObjs[tMapped.indexOf(slide)-1] === true)
    priorObjs[tMapped.indexOf(slide)-1] = false
  if (priorObjs[tMapped.indexOf(slide)+1] === true)
    priorObjs[tMapped.indexOf(slide)+1] = false

  if (window.preload3D !== false)
    reloadStatesTimeout = setTimeout(reloadStates, 250)
}

var revisibleScene
function reloadStates() {
  clearTimeout(revisibleScene)
  for (var i=0; i<=tMapped.length; i++) {
    onSlideChange(i, tMapped[i-1], true, true)
  }

  // Catch again because of default state propagation
  priorObjs = {}
  for (var i=0; i<=tMapped.length; i++) {
    onSlideChange(i, tMapped[i-1], true, true)
    onSlideChange(i, tMapped[i-1], false, true)
  }

  var dt = 100
  for (var i=0; i<states.default.length; i++) {
    dt = Math.max(states.default[i].dt, dt)
  }
  onSlideChange(null, null, false)
  revisibleScene = setTimeout(function() {
    scene.visible = true
    window.disableSlideChange = false
  }, dt + 250)
}

var t0 = null
function animate(t) {
  if (t0 == null)
    t0 = t

  if (anim.to) {

    if (anim.t0 == null)
      anim.t0 = t


    if (states[anim.to] && !window.enableCamera)
      for (var i=0; i<states[anim.to].length; i++) {
        var stateObj = states[anim.to][i]
        if (!stateObj.from)
          continue
        var valFrom = stateObj.from[anim.arrived],
            valTo = stateObj.value,
            easeFunc = stateObj.ease

        if (typeof valTo == "function" && (typeof stateObj.obj["$" + stateObj.key] == "undefined" || (stateObj.obj["$" + stateObj.key].toString() != valTo.toString()))) {
          stateObj.obj["$" + stateObj.key] = valTo
        }

        valFrom = typeof valFrom == "function" ? valFrom(t, anim.t0):valFrom
        valTo = typeof valTo == "function" ? valTo(t, anim.t0):valTo


        if (valFrom === false)
          stateObj.obj[stateObj.key] = valTo
        else
          stateObj.obj[stateObj.key] = doEase((t-anim.t0)/stateObj.dt, valFrom, valTo, easeFunc)

        if ((anim.t0 + stateObj.dt) < t)
          stateObj.from[anim.arrived] = false
      }

  }
  if (typeof renderer != "undefined")
    renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
animate()
