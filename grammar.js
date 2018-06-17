const fs = require("fs"),
      path = require("path")

// RegExp shortcuts
const VAL = `(?:"[^"\\r\\n]*"|'[^'\\r\\n]*'|\\S*)`, // "Quoted String", 'Quoted String', or unquotedString
      KEY = `[a-zA-Z0-9\\-_]*`, // Keys: Allows for letters, underscores and hyphens
      NUMKEY = `[a-zA-Z0-9\\-_\\.]*`, // Allows decimal point, for state keys.
      NUM = `\\-?[0-9]*\\.?[0-9]+`, // Numbers: 1, 1.3, .3
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
        if (objectified == content.length) {
          // Child bug workaround. I'm not sure why it happens
          for (let k=0; k<slides.length; k++)
            delete slides[k].children

          object.slides = slides
          callback(null, object)
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

  content.forEach(
    (row,i) => {
      // Check if current row is still a child row
      if (row.substr(0,(level+1)*4) == " ".repeat((level+1)*4)) {
        j[i] = j[i-1]
        if (!Array.isArray(slides[j[i]].children))
          slides[j[i]].children = []
        slides[j[i]].children.push(row)
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
            objectified += slides[j[i-1]].children.length
            delete slides[j[i-1]].children

            doCallback()
          }, level+1)
        }
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

      // If it is an import file thing then we handle it
      if (slides[j[i]].type == "import") {
        fs.readFile(path.join(dir, slides[j[i]].src), "utf8", (err, data) => {
          if (err && err.code === 'ENOENT') {
            // If we can't find the file, we just place a flag and move along
            slides[j[i]].comment = "File not found"
            objectified++
            doCallback()
          } else {
            if (err) {
              callback(err)
              return
            }

            parse(data, (err, obj) => {
              if (err) {
                callback(err)
                return
              }

              if (!slides[j[i]].slides)
                slides[j[i]].slides = []

              slides[j[i]].slides = [...slides[j[i]].slides, ...obj.slides]

              delete obj.slides
              delete slides[j[i]].src
              slides[j[i]].type = "slide"
              object = {...obj, ...object}
              objectified++
              doCallback()
            })
          }
        })
      } else {
        objectified++
        doCallback()
      }
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

  let {valuedTypes} = options
  valuedTypes = valuedTypes || []

  // ======================================================
  //   First, we remove the redundant spaces and comments
  // ======================================================
  content = content
    // Removes empty lines: matches all line breaks that end with nothing but spaces
    .replace(/[\n\r]^\s*$/gm, "")

    // Removes comments. Matches a "//", an arbitrary number of characters that are not line breaks, until the end of line
    .replace(/\/\/[^\n\r]*$/gm,"")

    // Parses arrays into a single line: matches the pattern "[", "things that are not [ or ]", "]",
    // then removes all the spaces found
    .replace(
      /\[([^\]]*)\]/gm,
      (str, val) => {
        val = val.replace(/\s/gm, "").split(",")
        val.forEach(
          (str,i) => {
            val[i] = str.match(new RegExp(NUM))[0] == str ? str:`"${unquote(str)}"`
          }
        )
        return `[${val.join(",")}]`
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
    // \}[^:]+\}    Include the lookaheads for good measure
    .replace(
      // /(?<!:)\s+\{([\s\S](?!\}[^:]+\}))+[\s\S]\}[^:]+\}/gm,
      /([^:]|^)\s+(\{(?:[\s\S](?!\}[^:]+\}))+[\s\S]\}[^:]+\})/g,
      (a, start, str) => start + " \"state\":" +
                // Now each matched string should be a state object "{1:{...}, 2:{...}}"
                // Return it with "state":, and parse the inside to make it JSON compatible
                str
                  // This just removes the whitespace
                  .replace(/\s/g, "")

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
                  .replace(new RegExp(`([\\{,]) *(${NUMKEY}) *(?=:)`, "g"), (str, start, key) => `${start}"${unquote(key)}"`)
    )

    // This parses all the key=value strings.
    // \"?([^\s\"]+)\"?   matches a spaceless key/value possibly surrounded by quotation marks
    // =    matches it such that it is of the format key=value
    .replace(
      new RegExp(`([\\r\\n]? *)(${KEY}|'${KEY}'|"${KEY}") *(${CLASS})(${ID})?(${CLASS}) *= *(${VAL})( *)`, "g"),
      (a, prev, key, c1, id, c2, val, next, offset) => {
        key = unquote(key)
        if (prev.match(/[\r\n]/) != null || offset == 0) // Means it's a type
          key = `"type":"${key.toLowerCase()}","${valuedTypes[key.toLowerCase()] || "src"}":"${unquote(val)}"`
        else
          key = `"${key}":"${unquote(val)}"`
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
                      new RegExp(` *(${KEY}) *: *(${VAL}|\\[[^\\]]*\\]) *`),
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

  if (typeof options == "function"){
    callback = options
    options = {}
  }

  let dir = options.dir || ""
  delete options.dir

  let {globals, content: parsedContent} = preParse(content, options, callback)

  objectify(globals, parsedContent, (err, obj) => callback(err, obj), 0, dir)
}

module.exports = {
  parse
}
