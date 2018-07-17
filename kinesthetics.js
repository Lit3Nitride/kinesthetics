if (typeof module !== "undefined")
  var {parse} = require("./grammar"),
      fs = require("fs"),
      path = require("path")

var customStyles = require("./styles.json", "customStyles"),
    mimes = require("./server/mime.json", "mimes")

const handledKeys = [
        "class",
        "slides",
        "type",
        "state",
        "sweep"
      ],
      handledTransforms = {
        "T": {
          name: "translate",
          parse: (value) => {
            switch (typeof value) {
              case "number":
                return `${value*100}%`
              default:
                return value
            }
          }
        },
        "R": {
          name: "rotate",
          parse: (value) => {
            switch (typeof value) {
              case "number":
                return `${value/Math.PI*180}deg`
              default:
                return value
            }
          }
        },
        "S": {
          name: "scale",
          parse: (value) => {
            return value
          }
        }
      },
      handledSweeps = {
        "left": "width",
        "right": "width",
        "top": "height",
        "bottom": "height"
      }


if (typeof module !== "undefined" && require.main === module) {
  const args = process.argv.splice(2),
      READLINE = require("readline"),
      readlineOpt = {
        input: process.stdin,
        output: process.stdout
      }
  args.forEach((kstFile) => {
    const kstFileDat = path.parse(kstFile),
          filePath = path.join(kstFileDat.root, kstFileDat.dir)
    let fileName = kstFileDat.name + ".html"

    function saveFile(html) {
      fs.writeFile(path.join(filePath, fileName), html, {flag: "wx"}, (err) => {
        if (err && err.code == "EEXIST") {
          let readline = READLINE.createInterface(readlineOpt)
          readline.question(
            `${fileName} already exists in ${filePath}. Please enter another name: `,
            (newName) => {
              newName = newName.trim()
              if (newName) {
                fileName = newName
                saveFile(html)
              } else {
                console.log("Operation cancelled.")
              }
              readline.close()
            }
          )
        }
      })
    }

    if (kstFileDat.ext == ".kst")
      render(kstFile, {renderSingle: true}, (err, html) => {
        if (err)
          throw err
        else
          saveFile(html)
      })
    else
      console.log(`${kstFileDat.base} does not seem to be a kst file.`)

  })
}

/*
  Fix for rounding error. Convert to number, then
  back to string in order to get the actual written
  number (since they are all defined)
*/

function add(a, b, returnStr = false) {
  let numP = (num) => num.toString()
                                 .replace(/^-/,"")
                                 .replace(/\./, "")
                                 .replace(/e-[0-9]*$/i, "").length

  a = Number(a)
  b = Number(b)

  let aP = numP(a),
      bP = numP(b),
      abP = numP(a+b),
      c = (a+b).toPrecision(Math.max(aP, bP, abP, 1))

  if (c.match(/^0\./) != null)
    c = c.replace(/0*$/, "")

  if (!returnStr)
    return Number(c)

  let cSub = c.indexOf("e")

  if (cSub != -1)
    c = Number(c).toFixed(Math.max(-parseInt(c.substr(cSub+1)), 0))

  return c
}

function invertColour(colour) {
  colour = colour.replace(/^#/, "")

  if (colour.length == 3)
    colour = colour.split("").map(x => x+x).join("")
  else if (colour.length != 6)
    throw new Error(`#${colour} is an invalid colour`)

  colour = (0xFFFFFF-parseInt(colour, 16)).toString(16)
  return `#${"0".repeat(6-colour.length)}${colour}`
}

function slidesObjToHTML(slides, options={jstr: "j-"}, callback) {
  if (typeof options == "function") {
    callback = options
    options = {jstr: "j-"}
  }
  var slidesHTMLobj = {
        body: [],
        style: "",
        t: new Set()
      },
      slideType = {},
      finishedSlides = 0,
      padding = " ".repeat(2*depth),
      jstr = typeof options == "string" ? options:(options.jstr || "j-"),
      depth = options.depth || 0,
      offset = options.offset || 0,
      dir = options.dir || "",
      renderSingle = options.renderSingle || false

  for (let j=0; j<slides.length; j++) {

    if (!slides[j].type || slides[j].type == "slide")
      slides[j].type = "div"

    if (!slides[j].class)
      slides[j].class = ""

    slides[j].class += " " + jstr + j

    slidesHTMLobj.body[j] = ""

    // In the case we have sweep animations
    if (typeof handledSweeps[slides[j].sweep] != "undefined") {
      slideType[j] = handledSweeps[slides[j].sweep]
      slidesHTMLobj.body[j] += `<div class="sweep sweep-${slides[j].sweep}" data-j="${jstr + j}"><div class="sweep-c">`
    }

    slidesHTMLobj.body[j] += `<${slides[j].type} class="${slides[j].class.trim()}"`

    for (let key in slides[j])
      if (handledKeys.indexOf(key) == -1) {
        let val = slides[j][key]

        if (renderSingle && key == "src") {
          let mime, ext = path.extname(val).substr(1)
          for (let m in mimes)
            if (mimes[m].indexOf(ext) != -1)
              mime = m
          try {
            val = `data:${mime};base64,` + Buffer.from(fs.readFileSync(path.join(dir, val))).toString('base64')
          } catch (err) {
            if (err.code == "ENOENT") {
              console.log(`Source '${val}' for <${key}> does not exist.`)
            } else {
              callback(err)
              return
            }
          }
        }

        slidesHTMLobj.body[j] += ` ${key}="${val}"`
      }

    slidesHTMLobj.body[j] += ">\n"

    // Handling the styles here

    let tmpStyle = {}
    for (let t0Str in slides[j].state) {
      t0 = (t0Str.toLowerCase() == "default") ? -Infinity:add(t0Str, offset)
      if (isNaN(t0)) {
        callback(new Error(`State "${t0Str}" is not a number`))
        return
      }

      tmpStyle[t0] = ""
      let transformStyles = "",
          sweepStyle = ""
      if (isFinite(t0)) {
        slidesHTMLobj.t.add(add(t0, 0, true))
        tmpStyle[t0] += `.t${add(t0, 0, true).replace(".", "-")} `
        if (slideType[j])
          sweepStyle += tmpStyle[t0]
      }
      tmpStyle[t0] += `.${slides[j].class.trim().replace(/ +/g, ".")} {\n`
      if (slideType[j])
        sweepStyle += `.sweep[data-j="${jstr+j}"] {`

      for (let key in slides[j].state[t0Str]) {
        if (Object.keys(handledTransforms).indexOf(key) != -1) {
          if (typeof slides[j].state[t0Str][key] == "string" || typeof slides[j].state[t0Str][key] == "number") {
            let value = handledTransforms[key].parse(slides[j].state[t0Str][key])
            transformStyles += ` ${handledTransforms[key].name}(${value})`
          } else {
            slides[j].state[t0Str][key].forEach((value, dir) => {
              value = handledTransforms[key].parse(value)
              transformStyles += ` ${handledTransforms[key].name}${["X","Y","Z"][dir]}(${value})`
            })
          }
        } else if (key == "sweep" && slideType[j]) {
          let sweepPercent = slides[j].state[t0Str][key]

          if (typeof sweepPercent == "number")
            sweepPercent = sweepPercent*100 + "%"

          sweepStyle += `${slideType[j]}: ${sweepPercent};`
        } else {
          value = slides[j].state[t0Str][key]
          value = (key == "O" && typeof value == "number") ? `${value*100}%`:value
          if (customStyles.value && customStyles.value[key] && customStyles.value[key][value])
            value = customStyles.value[key][value]
          if (customStyles.key && customStyles.key[key])
            key = customStyles.key[key]
          if (slideType[j])
            sweepStyle += `  ${key}: ${value};\n`
          else
            tmpStyle[t0] += `  ${key}: ${value};\n`
        }
      }
      if (transformStyles != "")
        tmpStyle[t0] += `  transform:${transformStyles};\n`
      tmpStyle[t0] += "}\n"
      if (slideType[j])
        tmpStyle[t0] += sweepStyle + "}\n"
    }
    Object.keys(tmpStyle).sort((a,b) => a-b).forEach((key) => slidesHTMLobj.style += tmpStyle[key])

    if (typeof slides[j].slides == "object") {
      slidesObjToHTML(
        slides[j].slides,
        {
          jstr: jstr+j+"-",
          depth: depth+1,
          offset: add(offset, slides[j].offset || 0),
          dir: dir,
          renderSingle: renderSingle
        },
        (err, childSlidesHTMLobj) => {
          if (err) {
            callback(err)
            return
          }
          // Deconstructs and merges the two sets, or, "a union b"
          slidesHTMLobj.t = new Set([...slidesHTMLobj.t, ...childSlidesHTMLobj.t])
          slidesHTMLobj.style += childSlidesHTMLobj.style
          slidesHTMLobj.body[j] += childSlidesHTMLobj.body
          slidesHTMLobj.body[j] += "\n" + padding + `</${slides[j].type }>`
          if (typeof slideType[j] != "undefined")
            slidesHTMLobj.body[j] += "</div></div>"
          if (++finishedSlides == slides.length) {
            slidesHTMLobj.body = padding + slidesHTMLobj.body.join("\n" + padding)
            callback(null, slidesHTMLobj)
          }
        }
      )
    } else {
      slidesHTMLobj.body[j] += padding + `</${slides[j].type }>`
      if (typeof slideType[j] != "undefined")
        slidesHTMLobj.body[j] += "</div></div>"
      if (++finishedSlides == slides.length) {
        slidesHTMLobj.body = padding + slidesHTMLobj.body.join("\n" + padding)
        callback(null, slidesHTMLobj)
      }
    }
  }
}

function render(slides, options = {}, callback) {
  if (typeof options == "function") {
    callback = options
    options = {}
  }
  renderSingle = options.renderSingle || false
  options.resourceDir = options.resourceDir || "/resources"

  let slidesObj = {
        aspect: 16/9,
        slides: "",
        title: "",
        templateFile: path.join(__dirname, options.resourceDir, "template.html"),
        background: "#f0f0f0",
        head: "",
        body: "",
        bodyStyles: ""
      },
      slidesObjRendered = null,
      slidesPath

  let slidesInjectHTML = (err, slidesHTMLobj) => {
    if (err) {
      callback(err)
      return
    }
    let tMap = [...slidesHTMLobj.t].sort((a,b) => a-b)
    tMap.forEach((value, key) => {
      tMap[key] = value.toString().replace(".", "-")
    })
    slidesObj.head += `<style>${slidesHTMLobj.style}</style>`
    slidesObj.head += `<script>var tMap=${JSON.stringify(tMap)}, aspect=${slidesObj.aspect}${
                        typeof slidesObj.t == "number" ? (", t0 = " + slidesObj.t):""
                      }</script>`
    slidesObj.body += slidesHTMLobj.body

    if (slidesObj.scripts) {
      slidesObj.scripts = Array.isArray(slidesObj.scripts) ? slidesObj.scripts:[slidesObj.scripts]
      for (let i=0; i<slidesObj.scripts.length; i++) {
        let script = slidesObj.scripts[i]
        if (typeof options.scripts == "object" && options.scripts[script]) {
          slidesObj.body += `\n<script>${options.scripts[script]}</script>`
        } else {
          if (script.match(/^\/[^\/]/) != null)
            script = path.join((renderSingle ? __dirname:"") + options.resourceDir, script)
          else if (renderSingle)
            script = path.join(slidesPath, script)

          if (renderSingle) {
            try {
              slidesObj.body += `\n<script>${fs.readFileSync(script)}</script>`
            } catch (err) {
              if (err.code == "ENOENT") {
                console.log(`Script '${script}' does not exist.`)
              } else {
                callback(err)
                return
              }
            }
          } else {
            slidesObj.body += `\n<script src="${script}"></script>`
          }

          if (script.match(/three(?:\.min)?\.js$/) != null)
            slidesObj.scripts.splice(i+1, 0, "/slidesThree.js")
        }
      }
    }
    if (slidesObj.styles) {
      slidesObj.styles = Array.isArray(slidesObj.styles) ? slidesObj.styles:[slidesObj.styles]
      slidesObj.styles.forEach((style) => {

        if (style.match(/^\/[^\/]/) != null)
          style = path.join((renderSingle ? __dirname:"") + options.resourceDir, style)
        else if (renderSingle)
          style = path.join(slidesPath, style)

        if (renderSingle)
          try {
            slidesObj.head += `\n<style>${fs.readFileSync(style)}</style>`
          } catch (err) {
            if (err.code == "ENOENT") {
              console.log(`Stylesheet '${style}' does not exist.`)
            } else {
              callback(err)
              return
            }
          }
        else
          slidesObj.head += `\n<link rel="stylesheet" type="text/css" href="${style}"></link>`
      })
    }
    if (!slidesObj.backgroundInverted)
      slidesObj.backgroundInverted = invertColour(slidesObj.background)
    for (let key in slidesObj)
      slidesObjRendered = slidesObjRendered.replace(new RegExp(`\\\${ *${key} *}`, "g"), slidesObj[key])

    callback(null, slidesObjRendered, slidesObj)
  }

  if (
      typeof slides == "undefined" ||
      typeof slides == "object" && typeof slides.slides == "undefined"
    ) {
    callback(new Error("Slides not specified"))
    return
  } else if (typeof slides == "string") {
    slidesObj.slides = slides
  } else if (typeof slides == "object") {
    for (let key in slides)
      slidesObj[key] = slides[key]
    if (slides.slides)
      delete slides.slides
  }
  fs.readFile(slidesObj.templateFile, "utf8", (err, data) => {
    if (err) {
      if (err.code == "ENOENT") {
        callback(new Error(`Template file '${slidesObj.templateFile}' does not exist`))
      } else {
        callback(err)
      }
      return
    }
    slidesObjRendered = data

    if (typeof slidesObj.slides == "string") {
      let doParse = (data, parseOptions={}) => parse(data, parseOptions, (err, obj) => {
                      if (err) {
                        callback(err)
                        return
                      }
                      for (let key in obj)
                        if (typeof slides != "object" || Object.keys(slides).indexOf(key) == -1)
                          slidesObj[key] = obj[key]
                      slidesObjToHTML(slidesObj.slides, {dir: slidesPath, renderSingle: renderSingle}, slidesInjectHTML)
                    })

      if (options.isPath !== false)
        fs.readFile(slidesObj.slides, "utf8", (err, data) => {
          if (err) {
            if (err.code == "ENOENT") {
              callback(new Error(`Slides file '${slidesObj.slides}' does not exist`))
            } else {
              callback(err)
            }
            return
          }

          slidesPath = path.dirname(slidesObj.slides)
          doParse(data, {rootDir: slidesPath})
        })
      else
        doParse(slidesObj.slides)
    } else {
      slidesObjToHTML(slidesObj.slides, {renderSingle: renderSingle}, slidesInjectHTML)
    }
  })
}

if (typeof module !== "undefined")
  module.exports = {render}
