import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:convert/convert.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:web3dart/web3dart.dart' as web3;

import '../core/config.dart';

class IdentityService {
  static const walletKey = 'ssi_voting_burner_private_key';
  final storage = const FlutterSecureStorage();
  web3.EthPrivateKey? _cached;

  Future<web3.EthPrivateKey> getOrCreateWallet() async {
    if (_cached != null) return _cached!;
    final stored = await storage.read(key: walletKey);
    if (stored != null && stored.isNotEmpty) {
      _cached = web3.EthPrivateKey.fromHex(stored);
      return _cached!;
    }
    final wallet = web3.EthPrivateKey.createRandom(Random.secure());
    await storage.write(
      key: walletKey,
      value: web3.bytesToHex(wallet.privateKey),
    );
    _cached = wallet;
    return wallet;
  }

  Future<String> address() async {
    final wallet = await getOrCreateWallet();
    return wallet.address.eip55With0x;
  }

  Future<void> reset() async {
    _cached = null;
    await storage.delete(key: walletKey);
  }

  void lock() {
    _cached = null;
  }

  Future<Map<String, dynamic>> signVote({
    required int candidateId,
    required int electionId,
  }) async {
    final wallet = await getOrCreateWallet();
    final timestamp = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final digest = _eip712Digest(candidateId, electionId, timestamp);
    final signature = web3.sign(digest, wallet.privateKey);

    final r = _pad32(web3.intToBytes(signature.r));
    final s = _pad32(web3.intToBytes(signature.s));
    final v = Uint8List.fromList([signature.v]);
    final signatureHex = '0x${hex.encode([...r, ...s, ...v])}';

    return {
      'burnerAddress': wallet.address.eip55With0x,
      'burnerSignature': signatureHex,
      'timestamp': timestamp,
    };
  }

  Uint8List _eip712Digest(int candidateId, int electionId, int timestamp) {
    final domainTypeHash = _hashText(
      'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
    );
    final voteTypeHash = _hashText(
      'Vote(uint256 candidateID,uint256 electionID,uint256 timestamp)',
    );

    final domainSeparator = web3.keccak256(
      Uint8List.fromList([
        ...domainTypeHash,
        ..._hashText('VotingSSI'),
        ..._hashText('1.0'),
        ..._uint256(BigInt.from(chainId)),
        ..._address(contractAddress),
      ]),
    );

    final structHash = web3.keccak256(
      Uint8List.fromList([
        ...voteTypeHash,
        ..._uint256(BigInt.from(candidateId)),
        ..._uint256(BigInt.from(electionId)),
        ..._uint256(BigInt.from(timestamp)),
      ]),
    );

    return web3.keccak256(
      Uint8List.fromList([0x19, 0x01, ...domainSeparator, ...structHash]),
    );
  }

  Uint8List _hashText(String value) =>
      web3.keccak256(Uint8List.fromList(utf8.encode(value)));

  Uint8List _uint256(BigInt value) => _pad32(web3.intToBytes(value));

  Uint8List _address(String value) {
    final normalized = value.startsWith('0x') || value.startsWith('0X')
        ? value.substring(2)
        : value;
    final address = Uint8List.fromList(hex.decode(normalized));
    return Uint8List.fromList([...List<int>.filled(12, 0), ...address]);
  }

  Uint8List _pad32(Uint8List bytes) {
    if (bytes.length == 32) return bytes;
    if (bytes.length > 32) {
      return Uint8List.fromList(bytes.sublist(bytes.length - 32));
    }
    return Uint8List.fromList([
      ...List<int>.filled(32 - bytes.length, 0),
      ...bytes,
    ]);
  }
}
