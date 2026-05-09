import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';

class ApiClient {
  final String baseUrl;
  ApiClient([String root = apiUrl]) : baseUrl = '${_trim(root)}/api';

  static String _trim(String value) => value.replaceFirst(RegExp(r'/$'), '');

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    String? sessionId,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (sessionId != null) headers['x-session-id'] = sessionId;

    final response = await switch (method) {
      'POST' => http.post(uri, headers: headers, body: jsonEncode(body ?? {})),
      _ => http.get(uri, headers: headers),
    };

    final payload = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = payload is Map
          ? (payload['message'] ?? payload['error'] ?? 'İstek başarısız oldu')
          : 'İstek başarısız oldu';
      throw Exception(message);
    }
    return payload;
  }
}
