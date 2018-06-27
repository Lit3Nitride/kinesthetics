const fs = require("fs"),
      path = require("path"),
      {parse} = require("./grammar"),
      handledKeys = [
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
      customStyles = require("./styles.json"),
      handledSweeps = {
        "left": "width",
        "right": "width",
        "top": "height",
        "bottom": "height"
      }

if (require.main === module) {
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
              }
              readline.close()
            }
          )
        }
      })
    }
    
    if (kstFileDat.ext == ".kst")
      render(kstFile, (err, html) => {
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
  a = Number(a)
  b = Number(b)

  let aP = a.toString().replace(/./, "").replace(/e-[0-9]*$/i, "").length,
      bP = b.toString().replace(/./, "").replace(/e-[0-9]*$/i, "").length,
      c = (a+b).toPrecision(Math.max(aP, bP, 1))

  if (c.match(/^0\./) != null)
    c = c.replace(/0*$/, "")

  if (!returnStr)
    return Number(c)

  let cSub = c.indexOf("e")

  if (cSub != -1)
    c = Number(c).toFixed(Math.max(-parseInt(c.substr(cSub+1)), 0))

  return c
}

function slidesObjToHTML(slides, callback, jstr = "j-", depth=0, offset=0) {
  var slidesHTMLobj = {
        body: [],
        style: "",
        t: new Set()
      },
      slideType = {},
      finishedSlides = 0,
      padding = " ".repeat(2*depth)
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
      if (handledKeys.indexOf(key) == -1)
        slidesHTMLobj.body[j] += ` ${key}="${slides[j][key]}"`

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
    Object.keys(tmpStyle).sort().forEach((key) => {
      slidesHTMLobj.style += tmpStyle[key]
    })

    if (typeof slides[j].slides == "object") {
      slidesObjToHTML(slides[j].slides, (err, childSlidesHTMLobj) => {
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
      }, jstr+j+"-", depth+1, add(offset, slides[j].offset || 0))
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

function render(slides, callback) {

  let slidesObj = {
        aspect: 16/9,
        slides: "",
        title: "",
        templateFile: "resources/template.html",
        background: "#f0f0f0",
        head: "",
        body: ""
      },
      slidesObjRendered = null

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
    slidesObj.head += `<script>var tMap=${JSON.stringify(tMap)}, aspect=${slidesObj.aspect || 4/3}</script>`
    slidesObj.body += slidesHTMLobj.body

    if (slidesObj.scripts) {
      slidesObj.scripts = Array.isArray(slidesObj.scripts) ? slidesObj.scripts:[slidesObj.scripts]
      if (slidesObj.scripts.indexOf("three.js") != -1)
        slidesObj.scripts.splice(slidesObj.scripts.indexOf("three.js")+1, 0, "slidesThree.js")
      slidesObj.scripts.forEach((script) => {

        if (["three.js", "slidesThree.js"].indexOf(script) != -1)
          script = path.join("/resources", script)

        slidesObj.body += `\n<script src="${script}"></script>`

      })
    }
    for (let key in slidesObj)
      slidesObjRendered = slidesObjRendered.replace(new RegExp(`\\\${ *${key} *}`, "g"), slidesObj[key])

    callback(null, slidesObjRendered)
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
  }
  fs.readFile(slidesObj.templateFile, "utf8", (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        callback(new Error("Template file '" + slidesObj.templateFile + "' does not exist"))
      } else {
        callback(err)
      }
      return
    }
    slidesObjRendered = data

    if (typeof slidesObj.slides == "string") {
      fs.readFile(slidesObj.slides, "utf8", (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            callback(new Error("Slides file '" + slidesObj.slides + "' does not exist"))
          } else {
            callback(err)
          }
          return
        }

        parse(data, {dir: path.dirname(slidesObj.slides)}, (err, obj) => {
            if (err) {
              callback(err)
              return
            }
            for (let key in obj)
              if (typeof slides != "object" || Object.keys(slides).indexOf(key) == -1)
                slidesObj[key] = obj[key]
            slidesObjToHTML(slidesObj.slides, slidesInjectHTML)
          }
        )
      })
    } else {
      slidesObjToHTML(slidesObj.slides, slidesInjectHTML)
    }
  })
}
module.exports = {render}
