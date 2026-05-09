import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class StatBox extends StatelessWidget {
  final String label;
  final String value;

  const StatBox({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: ink,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class ProfileInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool compactValue;
  final Color? valueColor;

  const ProfileInfoRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.compactValue = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: green, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: compactValue ? 1 : 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: valueColor ?? ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
