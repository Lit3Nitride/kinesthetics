// RegExp shortcuts
const VAL = `(?:"[^"\\r\\n]*"|'[^'\\r\\n]*'|\\S*)`, // "Quoted String", 'Quoted String', or unquotedString
      KEY = `[a-zA-Z0-9\\-_]*`, // Keys: Allows for letters, underscores and hyphens
      NUMKEY = `[a-zA-Z0-9\\-_\\.]*`, // Allows decimal point, for state keys.
      NUM = `\\-?[0-9]*\\.?[0-9]+`, // Numbers: 1, 1.3, .3
      WS2 = /(?: {2,}|[\r\n])/gm,
      ID =  `#${KEY}`,
      CLASS = `(?:\\.${KEY})*`

// Checks for and removes quotation marks if the string is surrounded by it.
function unquote(str) {
  str = str.trim()
  if (str[0].match(/['"]/) != null)
    str = str.substr(1,str.length-1)
  if (str[str.length-1].match(/['"]/) != null)
    str = str.substr(0,str.length-1)
  return str.trim()
}

// Parses css-styled class and id e.g. ".class0#id.class1"
function classify(c1, c2, id) {
  let c = (c1+c2)
  c = c ? c.replace(/\./g, " ").trim():false
  id = id ? id.replace("#", "").trim():false
  return (c ? `,"class":"${c}"`:"") + (id ? `,"id":"${id}"`:"")
}

// Turns a pre-parsed format into a javascript object
function objectify(globals, content, callback, level=0, dir="") {
  let object = {},
      slides = [],
      j = [],
      jNum = 0,
      objectified = 0,
      currContent,
      doCallback = () => {
        if (objectified >= content.length) {
          // Child bug workaround. I'm not sure why it happens
          object.slides = slides
          callback(null, object)
          return
        }
      }
  globals.forEach(
    (val) => {
      try {
        val = JSON.parse(`{${val}}`)
      } catch (err) {
        callback(new Error(`Unable to parse JSON "${val}"`))
        return
      }
      object = {...object, ...val}
    }
  )

  content.push("")
  content.forEach(
    (row,i) => {
      // Check if current row is still a child row
      if (row.substr(0,(level+1)*4) == " ".repeat((level+1)*4)) {
        j[i] = j[i-1]
        if (!Array.isArray(slides[j[i]].children))
          slides[j[i]].children = []
        slides[j[i]].children.push(row)
        return
      } else {
        // Handle children from the preceding slide
        if (i > 0 && Array.isArray(slides[j[i-1]].children) && slides[j[i-1]].children.length > 0) {
          if (!slides[j[i-1]].slides)
            slides[j[i-1]].slides = []
          objectify([], slides[j[i-1]].children, (err, childObject) => {
            if (err) {
              callback(err)
              return
            }
            slides[j[i-1]].slides = [...slides[j[i-1]].slides, ...childObject.slides]
            delete childObject.slides
            object = {...childObject, ...object}
            objectified += slides[j[i-1]].children.length - 1
            delete slides[j[i-1]].children

            doCallback()
          }, level+1)
        }
      }

      // If we are at an empty element, it means we're done with the last element
      if (!row) {
        objectified++
        doCallback()
        return
      }

      j[i] = i==0 ? 0:j[i-1]+1

      // Handle the actual current slide
      try {
        currContent = JSON.parse(row)
      } catch (err) {
        callback(new Error(`Unable to parse JSON "${row}"`))
        return
      }

      slides[j[i]] = currContent

      // If it is an import file thing then we don't handle it
      if (slides[j[i]].type == "import")
        slides[j[i]].comment = "Import not yet supported"
      objectified++
      doCallback()
    }
  )
}

// TODO: Math?
// TODO: Auto-quote bracketed values e.g. rgba(...) -> "rgba(...)"
function preParse(content, options = {}, callback) {

  if (typeof options == "function") {
    callback = options
    options = {}
  }

  let {valuedTypes, rootDir} = options
  valuedTypes = valuedTypes || []
  rootDir = rootDir || ""

  // ======================================================
  //   First, we remove the redundant spaces and comments
  // ======================================================
  content = content
    // Removes empty lines: matches all line breaks that end with nothing but spaces
    .replace(/[\n\r]^\s*$/gm, "")

    // Removes end of line whitespaces
    .replace(/ *$/gm, "")

    // Remove comments
    // Matches "/*", followed by anything that isn't followed by "*/", then the "*/"
    .replace(/\/\*([\s\S](?!\*(?!\/)))*\*\//gm,"")
    // Matches a "//", an arbitrary number of characters that are not line breaks, until the end of line
    .replace(/\/\/[^\n\r]*$/gm,"")

    // Parses arrays into a single line: matches the pattern "[", "things that are not [ or ]", "]",
    // then removes all the spaces found
    .replace(
      /\[([^\]]*)\]\s*([\,\}]?)/gm,
      (str, val, next) => {
        val = val.replace(/\s/gm, "").split(",")
        val.forEach(
          (str, i) => {
            let matchedStr = str.match(new RegExp(NUM))
            val[i] = (matchedStr && matchedStr[0] == str)?
              str.replace(new RegExp(`(${NUM})`, "g"), (a, num) => num.replace(/^(-?)\./, "$10."))
              : `"${unquote(str)}"`
          }
        )
        // If there isn't a comma or an end brace, then it's a global array
        // So we reintroduce a line break
        next = next || "\n"
        return `[${val.join(",")}]${next}`
      }
    )

    // Removes spaces and linebreaks between closing curly brackets and commas.
    // Matches spaces that succeed a closing curly bracket, and the comma, and the spaces that succeed the comma.
    .replace(/\}\s*,\s*/gm, "},")


    // ==============================================
    //   Then, we work on the state objects, since
    //   it is already more or less in object form.
    //   We'll also conform it into a JSON format.
    // ==============================================

    // Matches and parses all the state variables.
    // (?<!:\s+)\{    matches a "{" that doesn't follow a colon
    // ([\s\S](?!\}[^:]+\}))+   matches everything that doesn't precede a "} that has a bunch of things that are not colons followed by another }"
    // [\s\S]   Since there was a thing purposely not matched previously, match that
    // \}[^:]*\}    Include the lookaheads for good measure
    .replace(
      // /([^:]|^)\s*(\{(?:[\s\S](?!\}\s*\}))+[\s\S]\}\s*\})/g
      /([^:]|^)\s*(\{(?:[\s\S](?!\}\s*\}))+[\s\S]\}\s*\})/g,
      (a, start, str) => {
        str =
                // Now each matched string should be a state object "{1:{...}, 2:{...}}"
                // Return it with "state":, and parse the inside to make it JSON compatible
                str
                  // This matches for whitespace between property values
                  // :\s*   colon followed by possible spaces
                  // [^\}\{\s,] Things that are not "{", "}", "\s", ",",
                  // (?!\}|,)   and not succeeded by "," or "}"
                  .replace(
                    /:\s*(((?:[^\}\{\s,](?!\}|,))*[^\}\{\s,]?\s*)*)/gm,
                    (a, val) => {
                      val = val.trim().replace(new RegExp(`(${NUM})`, "g"), (a, num) => (num[0] == "." ? "0":"") + num)
                      if (val.match(/\[/) == null && val.replace(new RegExp(`(?:${NUM}| )`), "") != "")
                        val = `"${unquote(val)}"`
                      return `:${val}`
                    }
                  )
                  .replace(WS2, " ")
                  .replace(WS2, " ")
                  .replace(
//                    new RegExp(`(\\,|\\{)\\s*(\\{|(?:(?:(?:${NUMKEY}|'${NUMKEY}'|"${NUMKEY}"|default)\\s*,?\\s*)+:))`, "gmi"),
                    new RegExp(`(\\,|\\{)\\s*(\\{|(?:(?:(?:${NUM}|default)\\s*,?\\s*)+:))`, "gmi"),
                    (a, brace, key) => brace + key.replace(/\s/g, "")
                  )
                  .replace(/\}\s*\}/gm, "}}")
                  // This parses the multi-key shortcut.
                  // Essentially, we have something like { ...1:{...}, 1.23, 2.1, 3: {...}, ...}
                  // If we have numbers preceding a colon, then we would want to assign the property
                  // of the last to the keys for each of the numbers.
                  //
                  // E.g. {... 1.23, 2.1, 3: {a:1} ...} => { ... 1.23: {a:1}, 2.1: {a:1}, 3: {a:1} ...}
                  //
                  // We perform the matching as follows
                  // ([\{|,])   matches either a "{" or a "," - indicates start of next key
                  // (([0-9]*\.?[0-9]+,)+)    matches a sequence of numbers that ends with a comma -
                  //                          by having this, we match only groups of numbers
                  // ([0-9]*\.?[0-9]+)    matches the last number in the sequence
                  // :(\{([^\}])*\})    matches the colon, two brackets, and everything in between
                  .replace(
                    new RegExp("([\\{|,])" + `((?:(?:${NUM}|default),)+)` + `(${NUM}|default):(\\{(?:[^\\}])*\\})`, "ig"),
                    (a,str,n0,n1,rule) => {
                      // From the above matching, n0 should be all but the last number
                      // sepearated by a comma, while n1 should be the last number.
                      // We replace each comma with an object containing the rule,
                      // achieve what we had sought to above.
                      str += (n0+n1+",").replace(/,/g, ":" + rule + ",")
                      return str.substr(0,str.length-1)
                    }
                  )

                  // This encapsulates all the keys with quotes.
                  // (?<=[\{,]) ... (?=:)   matches something that starts with a "{" and ends with a ":": so, a key
                  // ([^:,\[\]]+)   matches the key itself
                  //.replace(/(?<=[\{,])([^:,\[\]]+)(?=:)/g, "\"$1\"")
                  .replace(
                    new RegExp(`([\\{,]) *(${NUMKEY}) *(?=:)`, "g"),
                    (str, start, key) => `${start}"${unquote(key)}"`
                  )
            str = str.substr(1, str.length-2)

            // Here we check for and merge duplicate keys
            let t = true,
                ts = {},
                // We should have the previous few RegExes do our work for us,
                // so we just match each "t: {k0:v0, k1:v1...}" and parse it
                // to recreate an object of t-values
                ///(?:^|,)([^\:\{\}]*):\{([^\{\}]*)\}/g
                re = new RegExp(`(?:^|,)("${NUMKEY}"):\\{([^\\{\\}]*)\\}`, "g"),
                tStr = ""

            while (t != null) {
              if (t[1])
                ts[t[1]] = (ts[t[1]] ? ts[t[1]] + ",":"") + t[2]
              t = re.exec(str)
            }

            // Recombine and return the values
            for (key in ts)
              tStr += `${key}:{${ts[key]}},`

            return `${start} "state":{${tStr.substr(0, tStr.length-1)}}`
        }
    )

    // This parses all the key=value strings.
    // \"?([^\s\"]+)\"?   matches a spaceless key/value possibly surrounded by quotation marks
    // =    matches it such that it is of the format key=value
    .replace(
      new RegExp(`([\\r\\n]? *)(${KEY}|'${KEY}'|"${KEY}") *(${CLASS})(${ID})?(${CLASS}) *= *(${VAL})( *)`, "g"),
      (a, prev, key, c1, id, c2, val, next, offset) => {
        key = unquote(key)
        val = unquote(val)
        if (prev.match(/[\r\n]/) != null || offset == 0) { // Means it's a type
          prev += `"type":"${key.toLowerCase()}",`
          key = valuedTypes[key.toLowerCase()] || "src"
          //key = `"${valuedTypes[key.toLowerCase()] || "src"}":"${unquote(val)}"`
        }
        if (key == "src")
          val = (rootDir != "" ? (rootDir.replace(/\/?/, "") + "/"):"") + val
        key = `"${key}":"${val}"`
        return prev + key + classify(c1, c2, id) + (next ? ",":"")
      }
    )

    // This parses all the (inherent) valueless types by matching the start of
    // the line, then finding the first non-space charcter, then continuing
    // until we either reach the end, or the start of a curly bracket, or a
    // comma. Ignore those with colons as they are global values.
    //
    // ^(\s*)   leading spaces
    // \S(?![,\{\r\n])    any non-space character that does not precede
    //                    a comma, an opening bracket, or line break
    .replace(
      /^(\s*)((?:\S(?![,\{\r\n]))*.)/gm,
      (str, spaces, keygroup) => {
        if (keygroup.indexOf(":") != -1) {
          return str
        } else {
          keygroup = keygroup.replace(
            new RegExp(`^([^#\\. ]*)(${CLASS})(${ID})?(${CLASS})([ \\{\\=]?)`),
            (str, key, c1, id, c2, next) => `"type":"${unquote(key)}"` + classify(c1, c2, id) + (next ? ",":"")
          )
          return spaces + keygroup
        }
      }
    )

  content = content.replace("\t", "    ").split(/[\r\n]/)

  let globals=[], i=0
  while (typeof content[i] != "undefined") {
    if (content[i].indexOf(`"type":`) == -1 && content[i].indexOf(`"state":`) == -1) {
      globals = [
                  ...globals,
                  content
                    .splice(i, 1)[0]
                    .replace(
                      //(` *(${KEY}) *: *(${VAL}|\\[[^\\]]*\\]) *`)
                      new RegExp(` *(${KEY}) *:(.*)$`),
                      (str, key, val) => `"${unquote(key)}":` + ((val.indexOf("[") == -1) ? `"${unquote(val)}"`:val)
                    )
                ]
    } else {
      content[i] = content[i++].replace(/( *)([\s\S]*)/, "$1{$2}")
    }
  }

  return {globals, content}
}

function parse(content, options={}, callback) {

  if (typeof options == "function") {
    callback = options
    options = {}
  }

  let dir = options.dir || ""
  delete options.dir

  let {globals, content: parsedContent} = preParse(content, options, callback)
  objectify(globals, parsedContent, (err, obj) => callback(err, obj), 0, dir)
}

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
      customStyles = {
        "key": {
          "ease": "transition-timing-function",
          "dt": "transition-duration",
          "t0": "transition-delay",
          "O": "transform-origin"
        },
        "value": {
          "ease": {
            "cubic": "cubic-bezier(0.5560641, 0, 0.4324943, 1)"
          }
        }
      },
      handledSweeps = {
        "left": "width",
        "right": "width",
        "top": "height",
        "bottom": "height"
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

function render(slides, callback, script_js="", bodyStyles="", t) {

  let slidesObj = {
        aspect: 16/9,
        slides: "",
        title: "",
        background: "#f0f0f0",
        head: "",
        body: "",
        bodyStyles: bodyStyles
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
    slidesObj.head += `<script>var tMap=${JSON.stringify(tMap)}, aspect=${slidesObj.aspect || 4/3}${typeof t == "number" ? (", t0 = " + t):""}</script>`
    slidesObj.body += slidesHTMLobj.body

    if (slidesObj.scripts) {
      slidesObj.scripts = Array.isArray(slidesObj.scripts) ? slidesObj.scripts:[slidesObj.scripts]
      if (slidesObj.scripts.indexOf("three.js") != -1)
        slidesObj.scripts.splice(slidesObj.scripts.indexOf("three.js")+1, 0, "slidesThree.js")
      slidesObj.scripts.forEach((script) => {

        if (["three.js", "slidesThree.js"].indexOf(script) != -1)
          script = "https://lit3nitride.github.io/kinesthetics/resources/" + script

        if (script == "script.js")
          slidesObj.body += `\n<script>${script_js}</script>`
        else
          slidesObj.body += `\n<script src="${script}"></script>`

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
  }
  slidesObjRendered = templateFile

  if (typeof slidesObj.slides == "string") {
    parse(slidesObj.slides, (err, obj) => {
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
  } else {
    slidesObjToHTML(slidesObj.slides, slidesInjectHTML)
  }
}

// By @onury https://github.com/onury

function invertColour(hex) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    // invert color components
    var r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
        g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
        b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
    // pad each with zeros and return
    return '#' + padZero(r) + padZero(g) + padZero(b);
}

function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

const templateFile = `
<!doctype html>
<html class="no-js init" lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>\${title}</title>
  <meta name="description" content="">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html,
    body {
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      position: relative;
    }
    html {
      background-color: black;
    }
    body {
      background-color: \${background};
      \${bodyStyles}
    }
    * {
      margin: 0;
      padding: 0;
      transition: .75s cubic-bezier(0.5560641, 0, 0.4324943, 1);
    }
    body > *:not(#timeLine) {
      cursor: none;
    }
    [class*="j-"] {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
    }
    [class*="j-"] img,
    [class*="j-"] svg,
    [class*="j-"] .i,
    [class*="j-"] canvas {
      position: absolute;
      top: 0;
      left: 0;
    }
    [class*="j-"] img,
    [class*="j-"] svg,
    [class*="j-"] canvas {
      height: 100%;
    }
    [class*="j-"] svg,
    [class*="j-"] canvas {
      width: 100%;
    }
    .sweep {
      overflow: hidden;
      position: absolute;
    }
    .sweep .sweep-c {
      position: absolute;
    }
    .sweep.sweep-top .sweep-c,
    .sweep.sweep-left .sweep-c {
      top: 0;
      left: 0;
    }
    .sweep.sweep-top,
    .sweep.sweep-bottom {
      width: 100%;
      height: 0;
    }
    .sweep.sweep-top {
      top: 0;
    }
    .sweep.sweep-left {
      left: 0;
    }
    .sweep.sweep-bottom {
      bottom: 0;
    }
    .sweep.sweep-right {
      right: 0;
    }
    .sweep.sweep-left,
    .sweep.sweep-right {
      height: 100%;
      width: 0;
    }
    .sweep.sweep-bottom .sweep-c,
    .sweep.sweep-right .sweep-c {
      bottom: 0;
      right: 0;
    }
    .sweep.sweep-left .sweep-c,
    .sweep.sweep-right .sweep-c {
      width: 100vw;
      height: 100%;
    }
    .sweep.sweep-top .sweep-c,
    .sweep.sweep-bottom .sweep-c {
      width: 100%;
      height: 100vh;
    }
    .sweep.sweep-top .sweep-c,
    .sweep.sweep-bottom .sweep-c,
    .sweep.sweep-left .sweep-c,
    .sweep.sweep-right .sweep-c {
      position: absolute;
      \${bodyStyles}
      margin-top: 0;
      margin-left: 0;
    }

    #rulerContainer {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      opacity: .75;
    }

    #ruler {
      display: none;
    }
    #rulerLine {
      stroke-width: .5px;
    }
    #ruleTextInput {
      visibility: none;
      opacity: 0;
      position: fixed;
      top: -1000vh;
      left: -1000vw;
    }
    #ruleText,
    #timeLine #timeT {
      font-size:3.5px;
      font-family:Monospace;
      text-align:center;
      text-anchor:middle;
    }
    #ruleTextRect{
      transition: none;
      fill: \${backgroundInverted};
    }
    #ruleText {
      transition: none;
      fill: \${background};
    }
    #rulerLine {
      transition: none;
      stroke: \${backgroundInverted};
    }
    #timeLine {
      width: 100%;
      position: absolute;
      bottom: 0;
      transform: translateY(100%);
      background: \${background};
      opacity: .75;
      z-index: 10000;
      cursor: none;
    }
    body.timeActive #timeLine {
      transform: translateY(-50%);
    }
    #timeLine .timeDiv {
      cursor: none;
    }
    #timeLine .offsetColour {
      stop-color: \${backgroundInverted};
    }
    #timeLine #timeL {
      fill: \${backgroundInverted};
    }
    #timeLine #timeC {
      transition: .2s ease-in-out;
    }
    #timeLine #timeC,
    #timeLine #timeT,
    #timeLine #timeLBack {
      fill: \${backgroundInverted};
    }
  </style>
  \${head}
</head>
<body>
\${body}
<script>
document.oncontextmenu = function (e) {
  return false
}

var t=0,
    body = document.body,
    sweeps = document.getElementsByClassName("sweep-c"),
    w, h, mt, ml,
    resizeTimeout

function doResize() {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(function() {
    var w0 = window.innerWidth,
        h0 = window.innerHeight

    if (w0/aspect < h0) {
      w = w0
      h = w0/aspect
      ml = 0
      mt = (h0 - h)/2
    } else {
      w = h0*aspect
      h = h0
      ml = (w0 - w)/2
      mt = 0
    }

    body.style.width = w + "px"
    body.style.height = h + "px"
    body.style.marginLeft = ml + "px"
    body.style.marginTop = mt + "px"

    for (var i=0; i<sweeps.length; i++) {
      sweeps[i].style.width = w + "px"
      sweeps[i].style.height = h + "px"
    }

    if (typeof window.onSlideResize == "function")
      window.onSlideResize(w, h)
  }, 500)
}

window.onresize = doResize
doResize()

document.onmousedown = function(e) {
  e.preventDefault()
  if (rulerOn) {
    rulerOn = false
    document.onmousemove = null
    $ruler.style.display = "none"
    $ruleTextInput.select()
    document.execCommand("copy")
  } else {
    switch (e.which) {
      case 1:
        change()
        break
      case 2:
      case 3:
        change(false)
        break
    }
  }
}

body.onkeydown = function(e) {
  if (e.keyCode == 82) {
    initRule = false
    if (!rulerOn) {
      rulerOn = true
      $ruler.style.display = "block"
      document.onmousemove = ruleHandler
    }
  }
  if (e.keyCode == 27 && rulerOn) {
    rulerOn = false
    document.onmousemove = null
    $ruler.style.display = "none"
  }
  if (e.keyCode == 84) {
    if (body.classList.contains("timeActive"))
      body.classList.remove("timeActive")
    else
      body.classList.add("timeActive")
  }
  if (!rulerOn) {
    if (e.keyCode == 8 || e.keyCode == 37 || e.keyCode == 38) {
      change(false)
    }
    if (e.keyCode == 32 || e.keyCode == 39 || e.keyCode == 40) {
      change()
    }
  }
}

var tMapped = []
for (var i=0; i<tMap.length; i++) {
  tMapped[i] = tMap[i].replace(/(?!^)-([0-9]*)$/, ".$1")
}

function change(next, to) {
  if (window.disableSlideChange)
    return
  if (body.classList.contains("init")) {
    body.classList.remove("init")
  } else {
    if (typeof next == "number") {
      to = next
      if (t == to)
        return
      else
        next = to > t
    }
    if (next !== false) {
      if (t < tMap.length) {
        t++
        body.classList.add("t" + tMap[t-1])
        if (typeof window.onSlideChange == "function")
          window.onSlideChange(t, tMapped[t-1], next !== false)
      }
    } else if (t > 0) {
      if (typeof window.onSlideChange == "function")
        window.onSlideChange(t, tMapped[t-1], next !== false)
      body.classList.remove("t" + tMap[t-1])
      t--
    }

    if (typeof to == "number" && to != t)
      change(next, to)

    let x = ((135.875-24.5)*t/Math.max(tMap.length, 1) + 24.5) - 0.175
    if (typeof $timeT != "undefined") {
      $timeT.innerHTML = tMapped[t-1] || "default"
      $timeT.setAttribute("x", x)
      $timeC.setAttribute("cx", x)
    }
  }
}
</script>
<!-- ===================================
           Debug and tools start
     ===================================
       (Eventually I would want to set
       a flag to include/exclude these)
     =================================== -->
<div id="rulerContainer">
  <svg id="ruler">
    <path id="rulerLine" />
    <rect id="ruleTextRect" width="34" height="6" />
    <text id="ruleTextContainer"><tspan id="ruleText"></tspan></text>
  </svg>
  <input id="ruleTextInput" type="text"></input>
</div>
<script>
var $ruler = document.getElementById("ruler")
$rulerLine = document.getElementById("rulerLine"),
$ruleTextRect = document.getElementById("ruleTextRect"),
$ruleText = document.getElementById("ruleText"),
$ruleTextInput = document.getElementById("ruleTextInput"),
rulerOn = false,
initRule = false,
ruleHandler = function(e) {
  var left = (e.clientX-ml)/w,
      top = (e.clientY-mt)/h

  if (Math.abs(left - .5) < .01)
    left = .5
  if (Math.abs(top - .5) < .01)
    top = .5
  left *= 100*aspect
  top *= 100

  var relLeft = (left - initRule[0])/100/aspect,
      relTop = (top - initRule[1])/100


  if (!initRule)
    initRule = [left, top]
  $ruleTextRect.setAttribute("x", (left + initRule[0] - 34)/2)
  $ruleTextRect.setAttribute("y", (top + initRule[1] - 6)/2)
  $ruleText.setAttribute("x", (left + initRule[0])/2)
  $ruleText.setAttribute("y", (top + initRule[1])/2 + 1.1)
  $ruleText.innerHTML = "[" + relLeft.toFixed(3) + "," + relTop.toFixed(3) + "]"
  $ruleTextInput.value = "[" + relLeft.toFixed(6) + "," + relTop.toFixed(6) + "]"
  $rulerLine.setAttribute("d", "M " + initRule[0] + "," + initRule[1] + " " + left + "," + top)
}

$ruler.setAttribute("viewBox", "0 0 " + 100*aspect + " 100")
</script>

<svg id="timeLine" xmlns="http://www.w3.org/2000/svg" xmlns:osb="http://www.openswatchbook.org/uri/2009/osb" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 160 10">
  <defs>
    <linearGradient id="c" x1="40" x2="120" y1="262.339" y2="262.339" gradientTransform="matrix(1.75 0 0 1 -60 -179.219)" gradientUnits="userSpaceOnUse" xlink:href="#b"/>
    <linearGradient id="b">
      <stop class="offsetColour" offset="0" stop-opacity="0"/>
      <stop class="offsetColour" offset=".084"/>
      <stop class="offsetColour" offset=".908"/>
      <stop class="offsetColour" offset="1" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g id="timeL" transform="translate(0 -80)">
    <path id="timeLBack" fill="url(#c)" d="M10 82.87h140v.5H10z" />
    <text>
      <tspan id="timeT" x="24.325" y="87.75">default</tspan>
    </text>
    <circle id="timeC" cx="24.325" cy="83.12" r=".643" />
  </g>
</svg>
<script>

var $timeL = document.getElementById("timeL")

for (var i=0; i<=tMap.length; i++)
  $timeL.innerHTML += '<path class="timeDiv" id="timeDiv-' + (tMap[i-1] || "default") + '" d="M260.839-' + ((135.875-24.5)*i/Math.max(tMap.length, 1) + 24.5) + 'h3v.3h-3z" transform="rotate(90 89.61 -89.61)"/>'

$timeL = document.getElementById("timeL")
var $timeT = document.getElementById("timeT"),
$timeC = document.getElementById("timeC")


if (typeof window.onSlideReady == "function")
  window.onSlideReady()

if (typeof window.t0 == "number")
  change(t0)
</script>
<!-- ===================================
             Debug and tools end
     ===================================
       (Eventually I would want to set
       a flag to include/exclude these)
     =================================== -->
</body>
</html>
`
