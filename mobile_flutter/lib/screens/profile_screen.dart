import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../widgets/profile_widgets.dart';

class ProfileScreen extends StatelessWidget {
  final Map<String, dynamic> user;
  final String sessionId;
  final String walletAddress;
  final bool socketLive;
  final int activeElectionCount;
  final int voteHistoryCount;
  final VoidCallback onShowHistory;
  final Future<void> Function() onResetWallet;
  final Future<void> Function() onLogout;

  const ProfileScreen({
    super.key,
    required this.user,
    required this.sessionId,
    required this.walletAddress,
    required this.socketLive,
    required this.activeElectionCount,
    required this.voteHistoryCount,
    required this.onShowHistory,
    required this.onResetWallet,
    required this.onLogout,
  });

  String _text(String key, [String fallback = '-']) {
    final value = user[key];
    if (value == null || value.toString().trim().isEmpty) return fallback;
    return value.toString();
  }

  String get _roleLabel => _text('role') == 'admin' ? 'Yönetici' : 'Seçmen';

  @override
  Widget build(BuildContext context) {
    final name = _text('name', 'Kullanıcı');
    final initial = name.trim().isEmpty
        ? 'K'
        : name.trim().characters.first.toUpperCase();
    final email = _text('email');
    final studentId = _text('student_id');
    final shortSession = sessionId.length <= 12
        ? sessionId
        : '${sessionId.substring(0, 6)}...${sessionId.substring(sessionId.length - 6)}';

    return Scaffold(
      appBar: AppBar(title: const Text('Profil'), centerTitle: false),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            CardPanel(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 38,
                    backgroundColor: const Color(0xFFDCFCE7),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        color: green,
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _roleLabel,
                    style: const TextStyle(
                      color: muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: StatBox(
                          label: 'Aktif seçim',
                          value: activeElectionCount.toString(),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: StatBox(
                          label: 'Oy geçmişi',
                          value: voteHistoryCount.toString(),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SectionTitle('Hesap bilgileri'),
            CardPanel(
              child: Column(
                children: [
                  ProfileInfoRow(
                    icon: Icons.badge_outlined,
                    label: 'Kullanıcı adı',
                    value: name,
                  ),
                  ProfileInfoRow(
                    icon: Icons.mail_outline,
                    label: 'E-posta',
                    value: email,
                  ),
                  ProfileInfoRow(
                    icon: Icons.school_outlined,
                    label: 'Öğrenci no',
                    value: studentId,
                  ),
                  ProfileInfoRow(
                    icon: Icons.admin_panel_settings_outlined,
                    label: 'Rol',
                    value: _roleLabel,
                  ),
                  ProfileInfoRow(
                    icon: Icons.key_outlined,
                    label: 'Oturum',
                    value: shortSession,
                  ),
                ],
              ),
            ),
            const SectionTitle('Cihaz kimliği'),
            CardPanel(
              child: Column(
                children: [
                  ProfileInfoRow(
                    icon: Icons.account_balance_wallet_outlined,
                    label: 'Burner wallet',
                    value: walletAddress.isEmpty
                        ? 'Hazırlanıyor'
                        : walletAddress,
                    compactValue: true,
                  ),
                  ProfileInfoRow(
                    icon: Icons.sensors_outlined,
                    label: 'Canlı bağlantı',
                    value: socketLive ? 'Bağlı' : 'Kapalı',
                    valueColor: socketLive ? green : muted,
                  ),
                ],
              ),
            ),
            const SectionTitle('Aksiyonlar'),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onShowHistory();
                    },
                    icon: const Icon(Icons.history),
                    label: const Text('Geçmiş'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await onResetWallet();
                    },
                    icon: const Icon(Icons.refresh),
                    label: const Text('Cüzdan'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 50,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFB91C1C),
                ),
                onPressed: () async {
                  Navigator.of(context).pop();
                  await onLogout();
                },
                icon: const Icon(Icons.logout),
                label: const Text('Çıkış yap'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
