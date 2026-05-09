import 'package:flutter/material.dart';

import 'screens/root_screen.dart';
import 'theme/app_theme.dart';

class VotingApp extends StatelessWidget {
  const VotingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSI Voting',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const RootScreen(),
    );
  }
}
