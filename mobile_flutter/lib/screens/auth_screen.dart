import 'package:flutter/material.dart';

import '../core/dependencies.dart';
import '../theme/app_theme.dart';
import '../widgets/auth_widgets.dart';
import '../widgets/common_widgets.dart';

class AuthScreen extends StatefulWidget {
  final void Function(Map<String, dynamic> user, String sessionId) onLogin;
  const AuthScreen({super.key, required this.onLogin});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  String mode = 'login';
  bool loading = false;
  bool otpStep = false;
  bool resetStep = false;
  String? error;
  String? info;

  final name = TextEditingController();
  final password = TextEditingController();
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final email = TextEditingController();
  final otp = TextEditingController();
  final resetEmail = TextEditingController();
  final resetOtp = TextEditingController();
  final resetPassword = TextEditingController();

  @override
  void dispose() {
    for (final controller in [
      name,
      password,
      firstName,
      lastName,
      email,
      otp,
      resetEmail,
      resetOtp,
      resetPassword,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      loading = true;
      error = null;
      info = null;
    });
    try {
      await action();
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _login() => _run(() async {
    final data = await api.request(
      '/login',
      method: 'POST',
      body: {'name': name.text.trim(), 'password': password.text},
    );
    final nextUser = Map<String, dynamic>.from(data['user']);
    final nextSessionId = data['sessionId'].toString();
    await sessions.save(nextUser, nextSessionId);
    widget.onLogin(nextUser, nextSessionId);
  });

  Future<void> _sendOtp() => _run(() async {
    final data = await api.request(
      '/register/send-otp',
      method: 'POST',
      body: {'email': email.text.trim()},
    );
    setState(() {
      otpStep = true;
      info = data['message']?.toString() ?? 'Doğrulama kodu gönderildi.';
      if (data['devOtp'] != null) otp.text = data['devOtp'].toString();
    });
  });

  Future<void> _register() => _run(() async {
    await api.request(
      '/register',
      method: 'POST',
      body: {
        'name': name.text.trim(),
        'firstName': firstName.text.trim(),
        'lastName': lastName.text.trim(),
        'email': email.text.trim(),
        'password': password.text,
        'otp': otp.text.trim(),
      },
    );
    setState(() {
      mode = 'login';
      otpStep = false;
      info = 'Kayıt başarılı. Şimdi giriş yapabilirsiniz.';
    });
  });

  Future<void> _forgot() => _run(() async {
    final data = await api.request(
      '/forgot-password',
      method: 'POST',
      body: {'email': resetEmail.text.trim()},
    );
    setState(() {
      resetStep = true;
      info = data['message']?.toString() ?? 'Şifre sıfırlama kodu gönderildi.';
    });
  });

  Future<void> _reset() => _run(() async {
    await api.request(
      '/reset-password',
      method: 'POST',
      body: {
        'email': resetEmail.text.trim(),
        'otp': resetOtp.text.trim(),
        'newPassword': resetPassword.text,
      },
    );
    setState(() {
      mode = 'login';
      resetStep = false;
      info = 'Şifre güncellendi. Yeni şifrenizle giriş yapabilirsiniz.';
    });
  });

  void _switchMode(String nextMode) {
    setState(() {
      mode = nextMode;
      otpStep = false;
      resetStep = false;
      error = null;
      info = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final formTitle = switch (mode) {
      'register' => 'Yeni hesap oluştur',
      'forgot' => resetStep ? 'Yeni şifre belirle' : 'Şifreni yenile',
      _ => 'Hesabına giriş yap',
    };
    final formSubtitle = switch (mode) {
      'register' =>
        otpStep
            ? 'E-postadaki kodla kaydı tamamla'
            : 'Bilgilerini gir ve e-postanı doğrula',
      'forgot' =>
        resetStep
            ? 'Kod ve yeni şifre ile devam et'
            : 'Hesabındaki e-postaya kod gönder',
      _ => 'Kullanıcı adın ve şifrenle devam et',
    };

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          children: [
            const AuthHero(),
            const SizedBox(height: 18),
            Notice(error: error, info: info),
            AuthCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    formTitle,
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formSubtitle,
                    style: const TextStyle(
                      color: muted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (mode == 'login') ...[
                    AppField(
                      label: 'Kullanıcı adı',
                      controller: name,
                      icon: Icons.person_outline,
                    ),
                    AppField(
                      label: 'Şifre',
                      controller: password,
                      obscure: true,
                      icon: Icons.lock_outline,
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => _switchMode('forgot'),
                        child: const Text('Şifremi unuttum'),
                      ),
                    ),
                    AppButton(
                      label: 'Giriş yap',
                      icon: Icons.login,
                      loading: loading,
                      onPressed: _login,
                    ),
                    const SizedBox(height: 14),
                    AuthSwitchRow(
                      text: 'Hesabınız yok mu?',
                      actionText: 'Hesap oluşturun',
                      onPressed: () => _switchMode('register'),
                    ),
                  ],
                  if (mode == 'register') ...[
                    AppField(
                      label: 'Kullanıcı adı',
                      controller: name,
                      icon: Icons.person_outline,
                    ),
                    AppField(
                      label: 'Ad',
                      controller: firstName,
                      icon: Icons.badge_outlined,
                    ),
                    AppField(
                      label: 'Soyad',
                      controller: lastName,
                      icon: Icons.badge_outlined,
                    ),
                    AppField(
                      label: 'E-posta',
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      icon: Icons.mail_outline,
                    ),
                    AppField(
                      label: 'Şifre',
                      controller: password,
                      obscure: true,
                      icon: Icons.lock_outline,
                    ),
                    if (otpStep)
                      AppField(
                        label: 'OTP kodu',
                        controller: otp,
                        keyboardType: TextInputType.number,
                        icon: Icons.pin_outlined,
                      ),
                    AppButton(
                      label: otpStep
                          ? 'Kaydı tamamla'
                          : 'Doğrulama kodu gönder',
                      icon: otpStep ? Icons.person_add_alt : Icons.mail_outline,
                      loading: loading,
                      onPressed: otpStep ? _register : _sendOtp,
                    ),
                    const SizedBox(height: 14),
                    AuthSwitchRow(
                      text: 'Zaten hesabınız var mı?',
                      actionText: 'Giriş yapın',
                      onPressed: () => _switchMode('login'),
                    ),
                  ],
                  if (mode == 'forgot') ...[
                    AppField(
                      label: 'E-posta',
                      controller: resetEmail,
                      keyboardType: TextInputType.emailAddress,
                      icon: Icons.mail_outline,
                    ),
                    if (resetStep) ...[
                      AppField(
                        label: 'OTP kodu',
                        controller: resetOtp,
                        keyboardType: TextInputType.number,
                        icon: Icons.pin_outlined,
                      ),
                      AppField(
                        label: 'Yeni şifre',
                        controller: resetPassword,
                        obscure: true,
                        icon: Icons.lock_reset,
                      ),
                    ],
                    AppButton(
                      label: resetStep ? 'Şifreyi güncelle' : 'Kod gönder',
                      icon: resetStep ? Icons.key : Icons.mail_outline,
                      loading: loading,
                      onPressed: resetStep ? _reset : _forgot,
                    ),
                    const SizedBox(height: 14),
                    AuthSwitchRow(
                      text: 'Şifreni hatırladın mı?',
                      actionText: 'Giriş yap',
                      onPressed: () => _switchMode('login'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
