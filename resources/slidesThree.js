
function toString(a) {
  if (typeof a != "string" && a != null) {
    a = a.toString()

    var aSub = a.indexOf("e")

    if (aSub != -1)
      a = Number(a).toFixed(Math.max(-parseInt(a.substr(aSub+1)), 0))
  }
  return a
}

function ease(t, dt, t0, arrived) {
  t = (t-t0)/dt
  var e = t < 0 ? 0:
          t > 1 ? 1:
          t < .5 ? 2*t*t:4*t-2*t*t-1
  return arrived !== false ? e:1-e
}


var states = {default: []},
    slidesReady = false

window.disableSlideChange = true

function onSlideReady() {
  if (typeof scene == "undefined")
    return setTimeout(onSlideReady, 500)
  scene.visible = false
  revisibleScene = setTimeout(function() {
    scene.visible = true
    window.disableSlideChange = false
  }, 2500)
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

  if (tMapped.indexOf(toString(slide)) == -1 && tMapped.indexOf(slide) == -1 && slide != "default")
    return

  clearTimeout(reloadStatesTimeout)

  dt = (typeof dt != "undefined") ? dt:750

  if (typeof dt == "string")
    dt = parseInt(
          dt
          .replace("ms", "")
          .replace("s", 1000)
          .replace("min", 60*1000)
        )

  if (typeof key == "number") {
    for (var i=0; i<Object.keys(obj).length; i++) {
      states[slide].push({obj: obj, key: Object.keys(obj)[i], value: key, dt: dt})
    }
  } else if (Array.isArray(key)) {
    for (var i=0; i<key.length; i++) {
      states[slide].push({obj: obj, key: ["x", "y", "z"][i], value: key[i], dt: dt})
    }
  } else {
    states[slide].push({obj: obj, key: key, value: value, dt: dt})
  }

  if (priorObjs[tMapped.indexOf(slide)-1] === true)
    priorObjs[tMapped.indexOf(slide)-1] = false
  if (priorObjs[tMapped.indexOf(slide)+1] === true)
    priorObjs[tMapped.indexOf(slide)+1] = false

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

    if (states[anim.to])
      for (var i=0; i<states[anim.to].length; i++) {
        var stateObj = states[anim.to][i],
            valFrom = stateObj.from[anim.arrived],
            valTo = stateObj.value

        if (typeof valTo == "function" && (typeof stateObj.obj["$" + stateObj.key] == "undefined" || (stateObj.obj["$" + stateObj.key].toString() != valTo.toString()))) {
          stateObj.obj["$" + stateObj.key] = valTo
        }

        valFrom = typeof valFrom == "function" ? valFrom(t):valFrom
        valTo = typeof valTo == "function" ? valTo(t):valTo


        if (valFrom === false)
          stateObj.obj[stateObj.key] = valTo
        else
          stateObj.obj[stateObj.key] = valTo*ease(t, stateObj.dt, anim.t0) + valFrom*ease(t, stateObj.dt, anim.t0, false)

        if ((anim.t0 + stateObj.dt) < t)
          stateObj.from[anim.arrived] = false
      }

  }
  if (typeof renderer != "undefined")
    renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
animate()
