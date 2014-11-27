var Opcode = require('btc-opcode');
var conv = require('binstring');
var Address = require('btc-address');
var cryptoHash = require('crypto-hashing')
var BigInteger = require('bigi')

var _defaultNetwork = 'mainnet';
Address.defaultNetwork = _defaultNetwork;

module.exports = Script;
Object.defineProperty(Script, 'defaultNetwork', {
  set: function(val) {
    _defaultNetwork = val;
    Address.defaultNetwork = val;
  },
  get: function() {
    return _defaultNetwork;
  }
})

function Script(data, isCoinbase) {
  if (!data) {
    this.buffer = [];
  } else if ("string" == typeof data) {
    this.buffer = conv(data, { in : 'hex',
      out: 'bytes'
    });
  } else if (Array.isArray(data)) {
    this.buffer = data;
  } else if (data instanceof Script) {
    this.buffer = data.buffer;
  } else {
    throw new Error("Invalid script");
  }

  if (isCoinbase) {
    /*
      This only applies to coinbase scripts
      For more information:
      BIP34:
      https://github.com/bitcoin/bips/blob/master/bip-0034.mediawiki

      Stackoverflow:
      http://bitcoin.stackexchange.com/questions/20721/what-is-the-format-of-coinbase-transaction
    */

    // if coinbase do not parse
    this.isCoinbase = true
    this.chunks = this.buffer;
    return
  }

  if (!Script.isValid(this.buffer)) {
    this.chunks = this.buffer
    return
  }

  this.parse();
}

Script.isValid = function(buffer) {
  if (Array.isArray(buffer)) {
    // todo: add more validation rules
    if (buffer.length <= 10000) {
      return true
    }
  }
  return false
}

Script.fromPubKey = function(str) {
  var script = new Script();
  var s = str.split(" ");
  for (var i in s) {
    if (Opcode.map.hasOwnProperty(s[i])) {
      script.writeOp(Opcode.map[s[i]]);
    } else {
      script.writeBytes(conv(s[i], { in : 'hex',
        out: 'bytes'
      }));
    }
  }
  return script;
};

Script.fromScriptSig = function(str) {
  var script = new Script();
  var s = str.split(" ");
  for (var i in s) {
    if (Opcode.map.hasOwnProperty(s[i])) {
      script.writeOp(Opcode.map[s[i]]);
    } else {
      script.writeBytes(conv(s[i], { in : 'hex',
        out: 'bytes'
      }));
    }
  }
  return script;
};

Script.fromChunks = function(chunks) {
  var script = new Script();

  for (var i = 0, l = chunks.length; i < l; i++) {
    var data = chunks[i];
    script.writeBytes(data)
  }

  return script;
};

/**
 * Update the parsed script representation.
 *
 * Each Script object stores the script in two formats. First as a raw byte
 * array and second as an array of "chunks", such as opcodes and pieces of
 * data.
 *
 * This method updates the chunks cache. Normally this is called by the
 * constructor and you don't need to worry about it. However, if you change
 * the script buffer manually, you should update the chunks using this method.
 */
Script.prototype.parse = function() {
  var self = this;

  this.chunks = [];

  // Cursor
  var i = 0;

  // Read n bytes and store result as a chunk
  function readChunk(n) {
    self.chunks.push(self.buffer.slice(i, i + n));
    i += n;
  };

  while (i < this.buffer.length && i >= 0) {
    var opcode = this.buffer[i++];
    if (opcode >= 0xF0) {
      // Two byte opcode
      opcode = (opcode << 8) | this.buffer[i++];
    }

    var len;
    if (opcode > 0 && opcode < Opcode.map.OP_PUSHDATA1) {
      // Read some bytes of data, opcode value is the length of data
      readChunk(opcode);
    } else if (opcode == Opcode.map.OP_PUSHDATA1) {
      len = this.buffer[i++];
      readChunk(len);
    } else if (opcode == Opcode.map.OP_PUSHDATA2) {
      len = (this.buffer[i++] << 8) | this.buffer[i++];
      readChunk(len);
    } else if (opcode == Opcode.map.OP_PUSHDATA4) {
      len = (this.buffer[i++] << 24) |
        (this.buffer[i++] << 16) |
        (this.buffer[i++] << 8) |
        this.buffer[i++];
      readChunk(len);
    } else {
      this.chunks.push(opcode);
    }
  }
};

/**
 * Compare the script to known templates of scriptPubKey.
 *
 * This method will compare the script to a small number of standard script
 * templates and return a string naming the detected type.
 *
 * Currently supported are:
 * Pubkeyhash
 *   Paying to a Bitcoin address which is the hash of a pubkey.
 *   OP_DUP OP_HASH160 [pubKeyHash] OP_EQUALVERIFY OP_CHECKSIG
 *   Example:
 *
 * Pubkey:
 *   Paying to a public key directly.
 *   [pubKey] OP_CHECKSIG
 *   Example: txid 0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098
 *
 * Scripthash (P2SH)
 *    Paying to an address which is the hash of a script
 *    OP_HASH160 [Scripthash] OP_EQUAL
 *    Example:
 *
 * Multisig
 *    Paying to multiple pubkeys and require a number of the signatures
 *    m [pubkey] [pubkey] [pubkey] n OP_CHECKMULTISIG
 *    Example:
 *
 * Strange:
 *   Any other script (no template matched).
 */

// Below is the current standard set of out types
/* const char* GetTxnOutputType(txnouttype t)
{
    switch (t)
    {
    case TX_NONSTANDARD: return "nonstandard";
    case TX_PUBKEY: return "pubkey";
    case TX_PUBKEYHASH: return "pubkeyhash";
    case TX_SCRIPTHASH: return "scripthash";
    case TX_MULTISIG: return "multisig";
    case TX_NULL_DATA: return "nulldata";
    }
    return NULL;
}*/

// https://github.com/bitcoin/bitcoin/blob/19e5b9d2dfcac4efadba636745485d9660fb1abe/src/script.cpp#L75

// supporting tx_null_data https://github.com/bitcoin/bitcoin/pull/3128
// https://helloblock.io/mainnet/transactions/ebc9fa1196a59e192352d76c0f6e73167046b9d37b8302b6bb6968dfd279b767
Script.prototype.getOutType = function() {
  if (this.chunks.length == 5 &&
    this.chunks[0] == Opcode.map.OP_DUP &&
    this.chunks[1] == Opcode.map.OP_HASH160 &&
    Array.isArray(this.chunks[2]) &&
    this.chunks[2].length === 20 &&
    this.chunks[3] == Opcode.map.OP_EQUALVERIFY &&
    this.chunks[4] == Opcode.map.OP_CHECKSIG) {
    // Transfer to Bitcoin address
    return 'pubkeyhash';
  } else if (this.chunks.length === 2 &&
    Array.isArray(this.chunks[0]) &&
    this.chunks[1] === Opcode.map.OP_CHECKSIG) {
    // [pubkey] OP_CHECKSIG
    return 'pubkey';
  } else if (this.chunks[this.chunks.length - 1] == Opcode.map.OP_EQUAL &&
    this.chunks[0] == Opcode.map.OP_HASH160 &&
    Array.isArray(this.chunks[1]) &&
    this.chunks[1].length === 20 &&
    this.chunks.length == 3) {
    // Transfer to M-OF-N
    return 'scripthash';
  } else if (this.chunks.length > 3 &&
    // m is a smallint
    isSmallIntOp(this.chunks[0]) &&
    // n is a smallint
    isSmallIntOp(this.chunks[this.chunks.length - 2]) &&
    // n greater or equal to m
    this.chunks[0] <= this.chunks[this.chunks.length - 2] &&
    // n cannot be 0
    this.chunks[this.chunks.length - 2] !== Opcode.map.OP_0 &&
    // n is the size of chunk length minus 3 (m, n, OP_CHECKMULTISIG)
    this.chunks.length - 3 === this.chunks[this.chunks.length - 2] - Opcode.map.OP_RESERVED &&
    // the middle chunks are all pubkeys
    arePubkeys(this.chunks.slice(1, this.chunks.length - 2)) &&
    // last chunk is OP_CHECKMULTISIG
    this.chunks[this.chunks.length - 1] == Opcode.map.OP_CHECKMULTISIG) {
    return 'multisig'
  } else if (this.chunks[0] === Opcode.map.OP_RETURN) {
    return 'nulldata'
  } else {
    return 'nonstandard';
  }
}

function arePubkeys(pubkeys) {
  for (var i = 0; i < pubkeys.length; i++) {
    if (!Array.isArray(pubkeys[i])) {
      return false
    }
  }
  return true
}

function isSmallIntOp(opcode) {
  return ((opcode == Opcode.map.OP_0) ||
    ((opcode >= Opcode.map.OP_1) && (opcode <= Opcode.map.OP_16)));
};

/**
 * Returns the address corresponding to this output in hash160 form.
 * Assumes strange scripts are P2SH
 */
/*Script.prototype.toScriptHash = function () {
    var outType = this.getOutType();

    return outType == 'Pubkey'       ? this.chunks[2]
         : outType == 'P2SH'         ? util.sha256ripe160(this.buffer)
         :                             util.sha256ripe160(this.buffer)
};*/

Script.prototype.toAddress = function(network) {
  var outType = this.getOutType();
  if (outType == 'pubkeyhash') {
    return new Address(this.chunks[2], 'pubkeyhash', network || Script.defaultNetwork)
  } else if (outType == 'pubkey') {
    // convert pubkey into a pubkeyhash and do address
    return new Address(cryptoHash.sha256ripe160(this.chunks[0], {
        out: 'bytes'
      }),
      'pubkeyhash', network || Script.defaultNetwork)
  } else if (outType == 'scripthash') {
    return new Address(this.chunks[1], 'scripthash', network || Script.defaultNetwork)
  } else {
    return false
  }
}

/*
  returns an array of addresses
*/
Script.prototype.toAddresses = function(network) {
  var self = this;
  var outType = this.getOutType();
  var addresses = [];
  if (outType === 'multisig') {
    for (var i = 1, last = self.chunks.length - 2; i < last; i++) {
      addresses.push(new Address(cryptoHash.sha256ripe160(self.chunks[i], {
          out: 'bytes'
        }),
        'pubkeyhash', network || Script.defaultNetwork))
    }
    return addresses
  } else {
    var address = self.toAddress()
    if (address) {
      return [address]
    } else {
      return false
    }
  }
}

/**
 * Compare the script to known templates of scriptSig.
 *
 * This method will compare the script to a small number of standard script
 * templates and return a string naming the detected type.
 *
 * WARNING: Use this method with caution. It merely represents a heuristic
 * based on common transaction formats. A non-standard transaction could
 * very easily match one of these templates by accident.
 *
 * Currently supported are:
 * Address:
 *   Paying to a Bitcoin address which is the hash of a pubkey.
 *   [sig] [pubKey]
 *
 * Pubkey:
 *   Paying to a public key directly.
 *   [sig]
 *
 * Multisig:
 *   Paying to M-of-N public keys.
 *
 * Strange:
 *   Any other script (no template matched).
 */
Script.prototype.getInType = function() {
  if (this.chunks.length == 1 &&
    Array.isArray(this.chunks[0])) {
    // Direct IP to IP transactions only have the signature in their scriptSig.
    // TODO: We could also check that the length of the data is correct.
    return 'pubkey';
  } else if (this.chunks.length == 2 &&
    Array.isArray(this.chunks[0]) &&
    Array.isArray(this.chunks[1])) {
    return 'pubkeyhash';
  } else if (this.chunks[0] == Opcode.map.OP_0 &&
    this.chunks.slice(1).reduce(function(t, chunk, i) {
      return t && Array.isArray(chunk) && (chunk[0] == 48 || i == this.chunks.length - 1);
    }, true)) {
    return 'multisig';
  } else {
    return 'nonstandard';
  }
};

/**
 * Returns the affected public key for this input.
 *
 * This currently only works with payToPubKeyHash transactions. It will also
 * work in the future for standard payToScriptHash transactions that use a
 * single public key.
 *
 * However for multi-key and other complex transactions, this will only return
 * one of the keys or raise an error. Therefore, it is recommended for indexing
 * purposes to use Script#simpleInHash or Script#simpleOutHash instead.
 *
 * @deprecated
 */
Script.prototype.simpleInPubKey = function() {
  switch (this.getInType()) {
    case 'pubkeyhash':
      return this.chunks[1];
    case 'pubkey':
      // TODO: Theoretically, we could recover the pubkey from the sig here.
      //       See https://bitcointalk.org/?topic=6430.0
      throw new Error("Script does not contain pubkey.");
    default:
      throw new Error("Encountered non-standard scriptSig");
  }
};

/**
 * Add an op code to the script.
 */
Script.prototype.writeOp = function(opcode) {
  this.buffer.push(opcode);
  this.chunks.push(opcode);
};

/**
 * Add a data chunk to the script.
 */
Script.prototype.writeBytes = function(data) {
  // if it is not array then it is opcode
  if (!Array.isArray(data)) {
    this.buffer.push(data);
    this.chunks.push(data);
    return
  }

  if (data.length < Opcode.map.OP_PUSHDATA1) {
    this.buffer.push(data.length);
  } else if (data.length <= 0xff) {
    this.buffer.push(Opcode.map.OP_PUSHDATA1);
    this.buffer.push(data.length);
  } else if (data.length <= 0xffff) {
    this.buffer.push(Opcode.map.OP_PUSHDATA2);
    this.buffer.push(data.length & 0xff);
    this.buffer.push((data.length >>> 8) & 0xff);
  } else {
    this.buffer.push(Opcode.map.OP_PUSHDATA4);
    this.buffer.push(data.length & 0xff);
    this.buffer.push((data.length >>> 8) & 0xff);
    this.buffer.push((data.length >>> 16) & 0xff);
    this.buffer.push((data.length >>> 24) & 0xff);
  }
  this.buffer = this.buffer.concat(data);
  this.chunks.push(data);
};

/**
 * Create an output for an address
 */
Script.createOutputScript = function(address, network) {
  var script = new Script();
  if ('string' === typeof address) {
    // null as we have a string address
    var address = new Address(address, null, network || Script.defaultNetwork);
  }

  var type = address.getType(network || Script.defaultNetwork);

  // Standard pay-to-pubkey-hash
  if (type === 'pubkeyhash') {
    script.writeOp(Opcode.map.OP_DUP);
    script.writeOp(Opcode.map.OP_HASH160);
    script.writeBytes(address.hash);
    script.writeOp(Opcode.map.OP_EQUALVERIFY);
    script.writeOp(Opcode.map.OP_CHECKSIG);
  }

  // Standard pay-to-script-hash
  else if (type === 'scripthash') {
    script.writeOp(Opcode.map.OP_HASH160);
    script.writeBytes(address.hash);
    script.writeOp(Opcode.map.OP_EQUAL);
  } else {
    // address can only be a pubkeyhash address or a scripthash address
    return false
  }

  return script;
};

/**
 * Extract pubkeys from a multisig script
 */

Script.prototype.extractPubkeys = function() {
  return this.chunks.filter(function(chunk) {
    return (chunk[0] == 4 && chunk.length == 65 || chunk[0] < 4 && chunk.length == 33)
  });
}

/**
 * Create an m-of-n output script
 */
Script.createMultiSigOutputScript = function(m, pubkeys, explicitSorting) {
  var script = new Script();

  explicitSorting || (pubkeys = pubkeys.slice().sort());

  script.writeOp(Opcode.map.OP_1 + m - 1);

  for (var i = 0; i < pubkeys.length; ++i) {
    script.writeBytes(pubkeys[i]);
  }

  script.writeOp(Opcode.map.OP_1 + pubkeys.length - 1);

  script.writeOp(Opcode.map.OP_CHECKMULTISIG);

  return script;
};

/**
 * Create a standard payToPubKeyHash input.
 */
Script.createInputScript = function(signature, pubKey) {
  var script = new Script();
  script.writeBytes(signature);
  script.writeBytes(pubKey);
  return script;
};

/**
 * Create a multisig input
 */
Script.createMultiSigInputScript = function(signatures, script) {
  script = new Script(script);
  var k = script.chunks[0][0];
  if (signatures.length < k) return false; //Not enough sigs
  var inScript = new Script();
  inScript.writeOp(Opcode.map.OP_0);
  signatures.map(function(sig) {
    inScript.writeBytes(sig)
  });
  inScript.writeBytes(script.buffer);
  return inScript;
}

Script.prototype.clone = function() {
  return new Script(this.buffer);
};

Script.prototype.getBlockHeight = function() {
  if (this.isCoinbase) {
    // This will never reach PUSHDATA1 so read first byte as length byte and read the rest
    // first byte should stay as 03 for the next 300 years
    var len = this.buffer[0]
    return parseInt(BigInteger.fromByteArrayUnsigned(this.buffer.slice(1, 1 + len).reverse()).toString(10))
  }
  return false
}

Script.prototype.toASM = function(truncate, maxEl) {
  var scriptTmp = this.clone()
  if (truncate === null) {
    truncate = true;
  }

  if ('undefined' === typeof maxEl) {
    maxEl = 20;
  }

  var type = scriptTmp.getOutType()
  var s = '';
  for (var i = 0, l = scriptTmp.chunks.length; i < l; i++) {
    var chunk = scriptTmp.chunks[i];

    if (i > 0) {
      s += ' ';
    }

    if (Array.isArray(chunk)) {
      if (truncate === true) {
        var maxLen = chunk.length
      } else {
        var maxLen = 100
      }
      s += new Buffer(chunk.splice(0, maxLen)).toString('hex');

      if (truncate) {
        s += '...'
      }
    } else {
      if (type === 'multisig') {
        switch (chunk) {
          case 80:
            s += 'OP_0'
            break
          case 81:
            s += 'OP_1'
            break
          default:
            s += Opcode.reverseMap[chunk]
        }
      } else {
        s += Opcode.reverseMap[chunk];
      }
    }

    if (maxEl && i > maxEl) {
      s += ' ...';
      break;
    }
  }
  return s;
};
