0.1.11 / 2014-11-20
-------------------
* Allow to set explicit sorting for public keys in multisig (#13)

0.1.10 / 2014-05-13
------------------
Bugfix - clone script in .toASM()

0.1.9 / 2014-04-10
------------------
Bugfix - detect zero byte pubkeys in a nonstandard multisig

0.1.8 / 2014-04-10
-----------------
* ASM support

0.1.7 / 2014-04-09
-----------------
* Multisig Escrows Addresses Support

0.1.4 / 2014-04-05
-----------------
* Support OPRETURN

0.1.3 / 2014-02-19
------------------
* Bugfix - Add script validation rules; exclude scripts over 10,000 bytes

0.1.2 / 2014-0218
-----------------
* Bugfix - better validation for standard output script types
* Bugfix - optional field to indicate to not parse BIP34 coinbase input scripts

0.1.1 / 2014-03-13
------------------
* Made script type setting an explicit parameter passed to `createOutputScript()` rather than guessing based on version
* removed method `simpleInHash()`. Closes #1
* removed method `simpleInPubkeyHash()`
* fixed correct output type in `getOutType()` Closes #6
* added `defaultNetworkType`, implicitly sets `Address.defaultNetworkType`
* replaced `convert-hex` for `binstring`
* (straight to 0.1.1, bug in NPM: https://github.com/npm/npm/issues/4653)


0.0.2 / 2014-02-04
------------------
* added fromChunks method to produce a script object from chunks array

0.0.1 / 2014-01-12
------------------
* initial release


