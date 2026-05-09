import 'package:flutter/material.dart';

const green = Color(0xFF047857);
const ink = Color(0xFF111827);
const muted = Color(0xFF64748B);
const line = Color(0xFFD7DEE8);
const background = Color(0xFFF5F7FB);

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: green),
    scaffoldBackgroundColor: background,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: line),
      ),
    ),
  );
}
