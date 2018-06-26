const {render} = require("../kinesthetics"),
      mimes = require("./mime.json"),
      http = require("http"),
      fs = require("fs"),
      args = process.argv.splice(2)

let port = 3000,
    tmpPort = parseInt(args[0])
if (!isNaN(tmpPort) && tmpPort == args[0])
  port = tmpPort

http
  .createServer(function(req, res) {
    let path = req.url,
        pathArr = path.split("/").splice(1)
    if (["resources", "examples", "slide", "slides"].indexOf(pathArr[0]) == -1) {
        res.writeHead(404)
        res.end()
    } else if (path.indexOf(".") == -1) {

      if (path.substr(-1) != "/") {
        res.writeHead(302, {
          "Location": path + "/"
        })
        res.end()
        return
      }
      let file = pathArr[pathArr.length - 2]
      render(`${pathArr.join("/")}${file}.kst`, (err, html) => {
        if (html) {
          res.writeHead(200, {
            "Content-Type": "text/html",
            "Content-Length": html.length
          })
          res.write(html)
        }
        res.end()
      })
    } else {
      fs.readFile(pathArr.join("/"), "utf8", (err, data) => {
        if (data) {
          let mime, ext = path.split(".").splice(-1)[0]
          for (let m in mimes)
            if (mimes[m].indexOf(ext) != -1)
              mime = m
          res.writeHead(200, {
              "Content-Type": mime || "text/html",
              "Content-Length": data.length
            })
          res.write(data)
        }
        res.end()
      })
    }
  })
  .listen(port, () => {
    console.log(`Listening on http://localhost:${port}`)
  })
