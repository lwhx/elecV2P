const fs = require('fs')
const path = require('path')
const formidable = require('formidable')

const { logger, downloadfile, errStack } = require('../utils')
const clog = new logger({ head: 'wbjsfile' })

const { runJSFile, JSLISTS, CONFIG_RUNJS } = require('../runjs')

const CONFIG_JSFILE = {
  path: path.join(__dirname, "../runjs/JSFile"),
}

module.exports = (app, CONFIG) => {
  app.get("/jsfile", (req, res)=>{
    let jsfn = req.query.jsfn
    clog.info((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "get js file", jsfn)
    if (jsfn) {
      if (fs.existsSync(path.join(CONFIG_JSFILE.path, jsfn))) {
        res.end(fs.readFileSync(path.join(CONFIG_JSFILE.path, jsfn), "utf8"))
        clog.notify((req.headers['x-forwarded-for'] || req.connection.remoteAddress) + " read file: " + jsfn)
      } else {
        res.end(jsfn + ' 文件不存在')
      }
    } else {
      res.end("404")
    }
  })

  app.get("/jsmanage", (req, res)=>{
    clog.info((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "get js manage data")
    res.end(JSON.stringify({
      storemanage: CONFIG.storemanage,
      jslists: JSLISTS,
    }))
  })

  app.put("/runjsconfig", (req, res)=>{
    clog.info((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "put runjsconfig")
    try {
      Object.assign(CONFIG_RUNJS, req.body.data)
      res.end(`RUNJS 相关设置修改成功`)
    } catch {
      res.end('RUNJS 相关设置修改失败')
    }
  })

  app.put("/jsfile", (req, res)=>{
    clog.info((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "put js file")
    let op = req.body.op
    switch(op){
      case 'jsdownload':
        downloadfile(req.body.url, path.join(CONFIG_JSFILE.path, req.body.name)).then(jsl=>{
          res.end('文件已下载至：' + jsl)
          if (JSLISTS.indexOf(req.body.name) === -1) JSLISTS.push(req.body.name)
        }).catch(e=>{
          res.end(req.body.name + ' 下载错误!' + e)
        })
        break
      default: {
        res.end("jsfile put error")
        break
      }
    }
  })

  app.post("/jsfile", (req, res)=>{
    clog.info((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "post js file")
    if (!req.body.jscontent) {
      res.end("have no content")
      return
    }
    if (req.body.jsname === 'totest') {
      let jsres = runJSFile(req.body.jscontent, { type: 'jstest' })
      res.end(typeof(jsres) !== 'string' ? JSON.stringify(jsres) : jsres)
    } else {
      fs.writeFileSync(path.join(CONFIG_JSFILE.path, req.body.jsname), req.body.jscontent)
      clog.notify(`${req.body.jsname} 文件保存成功`)
      res.end(`${req.body.jsname} 文件保存成功`)
      if (JSLISTS.indexOf(req.body.jsname) === -1) JSLISTS.push(req.body.jsname)
    }
  })

  app.delete("/jsfile", (req, res)=>{
    clog.notify((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "delete js file " + req.body.jsfn)
    let jsfn = req.body.jsfn
    if (jsfn) {
      fs.unlinkSync(path.join(CONFIG_JSFILE.path, jsfn))
      JSLISTS.splice(JSLISTS.indexOf(jsfn), 1)
    } else {
      clog.error("delete js file error")
    }
    res.end(jsfn + ' is deleted!')
  })

  app.post('/uploadjs', (req, res) => {
    clog.info((req.headers['x-forwarded-for'] || req.connection.remoteAddress), "正在上传 JS 文件")
    // js文件上传
    var jsfile = new formidable.IncomingForm()
    jsfile.maxFieldsSize = 2 * 1024 * 1024 //限制为最大2M
    jsfile.keepExtensions = true
    jsfile.multiples = true
    jsfile.parse(req, (err, fields, files) => {
      if (err) {
        clog.error('Error', errStack(err))
        // throw err
      }

      if (!files.js) return
      if (files.js.length) {
        files.js.forEach(file=>{
          clog.notify('上传文件：', file.name)
          fs.copyFileSync(file.path, path.join(CONFIG_JSFILE.path, file.name))
          if (JSLISTS.indexOf(file.name) === -1) JSLISTS.push(file.name)
        })
      } else {
        clog.notify('上传文件：', files.js.name)
        fs.copyFileSync(files.js.path, path.join(CONFIG_JSFILE.path, files.js.name))
        if (JSLISTS.indexOf(files.js.name) === -1) JSLISTS.push(files.js.name)
      }
    })
    res.end('js uploaded success!')
  })
}