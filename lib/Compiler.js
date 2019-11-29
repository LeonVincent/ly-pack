let path = require('path')
let fs = require('fs')
let babylon = require('babylon')
let traverse = require('@babel/traverse').default
let generator = require('@babel/generator').default
let types = require('@babel/types')
let ejs = require('ejs')
class Compiler {
  constructor(config) {
    this.config = config
    //需要保存入口文件的路径
    this.entryId = '' //./src/index.js
    //需要保存所有的模块依赖
    this.modules = {}
    this.entry = config.entry// ./src/index.js
    // console.dir(config)
    //执行npx ly-pack的路径 -->工作路径
    this.root = process.cwd() // /Users/leon/Leon/webpack_learn/lydev
  }
  emitFile(){
    // 用数据，渲染我们的
    let main = path.join(this.config.output.path, this.config.output.filename)
    let templateStr = this.getSource(path.join(__dirname, 'main.ejs'))
    let code = ejs.render(templateStr, { entryId: this.entryId, modules: this.modules })
    this.assets = {}
    this.assets[main] = code
    fs.writeFileSync(main, this.assets[main])
  }
  parse(source, parentPath) {// AST解析语法树 
    let ast = babylon.parse(source)
    let dependencies = []
    traverse(ast, {
      CallExpression(p) { 
        let node = p.node
        if (node.callee.name === 'require') {
          node.callee.name = '__webpack_require__'
          let moduleName = node.arguments[0].value  // 取到的就是模块的引用名字
          moduleName+= (path.extname(moduleName) ? '': '.js')
          moduleName= './' + path.join(parentPath, moduleName)
          dependencies.push(moduleName)
          node.arguments = [types.stringLiteral(moduleName)]
        }
      }
    })
    let sourceCode = generator(ast).code
    return { sourceCode, dependencies }
  }
  getSource(modulePath) {
    return  fs.readFileSync(modulePath, 'utf8')
  }
  // 构建模块
  buildModule(modulePath, isEntry) { 
    //modulePath: /Users/leon/Leon/webpack_learn/lydev/src/index.js
    //拿到模块的内容
    let source = this.getSource(modulePath)
    // 拿到模块的id modulePath(总路径) - this.root（相对路径）
    let moduleName = './' + path.relative(this.root, modulePath) //./src/index.js
    // console.log('source------->', source)
    let { sourceCode, dependencies } = this.parse(source, path.dirname(moduleName))
    if (isEntry) {
      this.entryId = moduleName // 保存路口的名字
    }
    //把相对路径和模块中的内容 对应起来
    this.modules[moduleName] = sourceCode
    dependencies.forEach(dep => {
      this.buildModule(path.join(this.root, dep), false)
    })
  }
  run() {
    //执行 并且创建模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true)
    //发射一个文件 打包后的文件
    this.emitFile()
  }
}

module.exports = Compiler