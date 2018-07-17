var __dirname = "./",//"https://lit3nitride.github.io/kinesthetics/",
    path = {
      resolve: (p) => p
        .replace(/(\:?)\/\/+/g, (colon, str) => {
          return (colon && str) ? "://":"/"
        })
        .replace(/(^|\/)[^\/]*\/\.\.\/?/g, "$1"),
      extname: (p) => {
        p = p.match(/\..*$/)
        return p ? p[0]:""
      },
      dirname: p => path.resolve(p).replace(/(?:^|\/)[^\/]*\.[^\/]*$/, "") || ".",
      join: (...Ps) => {
        if (Ps.length == 0)
          return "."

        let pFinal = "",
            firstNoneEmpty = Infinity
        Ps.forEach((p, i) => {
          p = path.resolve(p)
          if (!p)
            return
          else if (firstNoneEmpty == Infinity)
            firstNoneEmpty = i
          if (p.match(/^\//) === null && i > firstNoneEmpty)
            p = "/" + p
          if (p.match(/\/$/) !== null && i < Ps.length-1)
            p = p.substr(0, p.length-1)
          pFinal += p
        })

        return path.resolve(pFinal) || "."
      }

    },
    files = {},
    fs = {
      readFile: (file, format, callback) => {
        if (typeof format == "function")
          callback = format
        if (typeof files[file] != "undefined") {
          callback(null, files[file])
        } else {
          let req = new XMLHttpRequest()
          req.overrideMimeType("text/plain")
          req.onreadystatechange = () => {
            if (req.readyState == 4)
              if (req.status == 200)
                callback(null, files[file] = req.responseText)
              else
                callback(`"${file}" cannot be read.`, "{}")
          }
          req.open("GET", file, true)
          req.send()
        }
      }
    },
    require = (json, varName) => {
      fs.readFile(json, (err, data) => {
        if (err)
          console.warn(err)
        window[varName] = JSON.parse(data)
      })
    }
