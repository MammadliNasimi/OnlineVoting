import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AuthHero extends StatelessWidget {
  const AuthHero({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
      decoration: BoxDecoration(
        color: green,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: green.withValues(alpha: 0.18),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.shield_outlined, size: 46, color: green),
          ),
          const SizedBox(height: 16),
          const Text(
            'SSI Voting',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Mobil oy verme paneli',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.82),
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class AuthCard extends StatelessWidget {
  final Widget child;

  const AuthCard({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class AuthSwitchRow extends StatelessWidget {
  final String text;
  final String actionText;
  final VoidCallback onPressed;

  const AuthSwitchRow({
    super.key,
    required this.text,
    required this.actionText,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Flexible(
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontWeight: FontWeight.w600),
          ),
        ),
        TextButton(onPressed: onPressed, child: Text(actionText)),
      ],
    );
  }
}
