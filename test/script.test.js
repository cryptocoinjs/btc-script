var Script = require('../')

require('terst')

describe('Script', function() {
  describe(' - fromChunks()', function() {
    it(' > generates a Script object from chunks', function() {
      var script = new Script('76a914652c453e3f8768d6d6e1f2985cb8939db91a4e0588ac')
      var tmp = script.clone()
      var scriptFromChunks = Script.fromChunks(tmp.chunks)

      // check buffers are the same
      T(script.buffer.length === scriptFromChunks.buffer.length)
      for (var i in scriptFromChunks.buffer) {
        T(script.buffer[i] === scriptFromChunks.buffer[i])
      }

      // check chunks are the same
      T(script.chunks.length === scriptFromChunks.chunks.length)
      for (var i in scriptFromChunks.chunks) {
        // chunks contain nested arrays
        if (!Array.isArray(scriptFromChunks.chunks[i])) {
          T(script.chunks[i] === scriptFromChunks.chunks[i])
        } else {
          T(script.chunks[i].length === scriptFromChunks.chunks[i].length)
          var scriptFromChunkArray = scriptFromChunks.chunks[i]
          var scriptArray = script.chunks[i]
          for (var y in scriptFromChunkArray[y]) {
            T(scriptArray[i] === scriptFromChunkArray[i])
          }
        }
      }
    })
  })
})
