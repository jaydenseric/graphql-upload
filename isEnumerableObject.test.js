'use strict'

const t = require('tap')
const isEnumerableObject = require('./isEnumerableObject')

t.test('`isEnumerableObject` with various values.', t => {
  t.equal(isEnumerableObject({}), true, 'Plain object.')
  t.equal(isEnumerableObject(new Date()), true, 'Instance.')

  t.equal(isEnumerableObject(null), false, 'Null.')
  t.equal(isEnumerableObject([]), false, 'Array.')
  t.equal(isEnumerableObject(''), false, 'String.')
  t.equal(isEnumerableObject(true), false, 'Boolean.')
  t.equal(isEnumerableObject(undefined), false, 'Undefined.')

  t.end()
})
