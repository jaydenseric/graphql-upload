/**
 * A Babel plugin that adds `istanbul ignore next` comments before Babel
 * `_interopRequireDefault` function declarations, to allow 100% code coverage.
 * @kind function
 * @name babelPluginIstanbulIgnoreBabelInterop
 * @returns {Function} The Babel plugin.
 * @ignore
 */
const babelPluginIstanbulIgnoreBabelInterop = () => ({
  visitor: {
    FunctionDeclaration(path) {
      if (path.node.id.name === '_interopRequireDefault')
        path.addComment('leading', ' istanbul ignore next', true)
    }
  }
})

module.exports = {
  shouldPrintComment: comment =>
    // Preserve Istanbul ignore comments.
    /@license|@preserve|istanbul ignore/.test(comment),
  plugins: [babelPluginIstanbulIgnoreBabelInterop],
  presets: [
    [
      '@babel/env',
      {
        modules: process.env.BABEL_ESM ? false : 'commonjs',
        shippedProposals: true,
        loose: true
      }
    ]
  ]
}
