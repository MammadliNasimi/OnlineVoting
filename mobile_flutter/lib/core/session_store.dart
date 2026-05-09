import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const key = 'ssi_voting_session';

  Future<void> save(Map<String, dynamic> user, String sessionId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      key,
      jsonEncode({'user': user, 'sessionId': sessionId}),
    );
  }

  Future<Map<String, dynamic>?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    return raw == null ? null : Map<String, dynamic>.from(jsonDecode(raw));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}
