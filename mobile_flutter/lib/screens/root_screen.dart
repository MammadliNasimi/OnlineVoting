import 'package:flutter/material.dart';

import '../core/dependencies.dart';
import 'auth_screen.dart';
import 'voting_screen.dart';

class RootScreen extends StatefulWidget {
  const RootScreen({super.key});

  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  bool booting = true;
  Map<String, dynamic>? user;
  String? sessionId;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    try {
      final saved = await sessions.load();
      final savedSession = saved?['sessionId']?.toString();
      if (savedSession != null) {
        final me = await api.request('/me', sessionId: savedSession);
        user = Map<String, dynamic>.from(me['user']);
        sessionId = (me['sessionId'] ?? savedSession).toString();
        await sessions.save(user!, sessionId!);
      }
    } catch (_) {
      await sessions.clear();
    } finally {
      if (mounted) setState(() => booting = false);
    }
  }

  void _setSession(Map<String, dynamic> nextUser, String nextSessionId) {
    setState(() {
      user = nextUser;
      sessionId = nextSessionId;
    });
  }

  Future<void> _logout() async {
    if (sessionId != null) {
      try {
        await api.request('/logout', method: 'POST', sessionId: sessionId);
      } catch (_) {}
    }
    identity.lock();
    await sessions.clear();
    setState(() {
      user = null;
      sessionId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (booting) return const LoadingScreen();
    if (user == null || sessionId == null) {
      return AuthScreen(onLogin: _setSession);
    }
    return VotingScreen(user: user!, sessionId: sessionId!, onLogout: _logout);
  }
}

class LoadingScreen extends StatelessWidget {
  const LoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
