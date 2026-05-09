import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/config.dart';
import '../core/dependencies.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../widgets/voting_widgets.dart';
import 'profile_screen.dart';

class VotingScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final String sessionId;
  final Future<void> Function() onLogout;

  const VotingScreen({
    super.key,
    required this.user,
    required this.sessionId,
    required this.onLogout,
  });

  @override
  State<VotingScreen> createState() => _VotingScreenState();
}

class _VotingScreenState extends State<VotingScreen> {
  bool loading = true;
  bool voting = false;
  bool refreshing = false;
  bool socketLive = false;
  String? error;
  String? info;
  String walletAddress = '';
  int? selectedElectionId;
  Map<String, dynamic>? selectedCandidate;
  Map<String, dynamic>? profileUser;
  List<Map<String, dynamic>> elections = [];
  List<Map<String, dynamic>> candidates = [];
  List<Map<String, dynamic>> history = [];
  io.Socket? socket;

  void _safeSetState(VoidCallback fn) {
    if (!mounted) return;
    setState(fn);
  }

  @override
  void initState() {
    super.initState();
    _load();
    _connectSocket();
  }

  @override
  void dispose() {
    final activeSocket = socket;
    socket = null;
    activeSocket?.clearListeners();
    activeSocket?.disconnect();
    activeSocket?.dispose();
    super.dispose();
  }

  void _connectSocket() {
    socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );
    socket!
      ..onConnect((_) {
        if (!mounted) return;
        _safeSetState(() => socketLive = true);
        socket?.emit('join', widget.user['id']);
      })
      ..onDisconnect((_) => _safeSetState(() => socketLive = false))
      ..on('voteProcessed', (data) {
        _safeSetState(
          () => info = data is Map
              ? data['message']?.toString()
              : 'Oyunuz blokzincire yazıldı.',
        );
        _load(silent: true);
      })
      ..on('voteFailed', (data) {
        _safeSetState(
          () => error = data is Map
              ? data['message']?.toString()
              : 'Oy işlemi başarısız oldu.',
        );
        _load(silent: true);
      })
      ..on('voteUpdated', (_) => _load(silent: true))
      ..connect();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) _safeSetState(() => loading = true);
    try {
      final loadedAddress = await identity.address();
      final me = await api.request('/me', sessionId: widget.sessionId);
      final rawElections =
          await api.request('/elections', sessionId: widget.sessionId) as List;
      final nextElections = rawElections
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      final nextSelected =
          selectedElectionId != null &&
              nextElections.any((e) => e['id'] == selectedElectionId)
          ? selectedElectionId
          : (nextElections.isNotEmpty
                ? nextElections.first['id'] as int
                : null);
      final rawHistory =
          await api.request('/voting-history', sessionId: widget.sessionId)
              as List;
      final rawCandidates = nextSelected == null
          ? <dynamic>[]
          : await api.request(
                  '/candidates/$nextSelected',
                  sessionId: widget.sessionId,
                )
                as List;
      _safeSetState(() {
        profileUser = Map<String, dynamic>.from(me['user'] ?? widget.user);
        walletAddress = loadedAddress;
        elections = nextElections;
        selectedElectionId = nextSelected;
        history = rawHistory.map((e) => Map<String, dynamic>.from(e)).toList();
        candidates = rawCandidates
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        selectedCandidate = null;
      });
    } catch (e) {
      _safeSetState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (!silent) _safeSetState(() => loading = false);
    }
  }

  Future<void> _refreshElections() async {
    _safeSetState(() {
      refreshing = true;
      error = null;
      info = null;
    });
    await _load(silent: true);
    _safeSetState(() {
      refreshing = false;
      info = 'Aktif seçimler yenilendi.';
    });
  }

  Future<void> _selectElection(int id) async {
    _safeSetState(() {
      selectedElectionId = id;
      selectedCandidate = null;
      candidates = [];
    });
    try {
      final raw =
          await api.request('/candidates/$id', sessionId: widget.sessionId)
              as List;
      _safeSetState(
        () =>
            candidates = raw.map((e) => Map<String, dynamic>.from(e)).toList(),
      );
    } catch (e) {
      _safeSetState(() => error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _vote() async {
    final election = elections.firstWhere((e) => e['id'] == selectedElectionId);
    final candidate = selectedCandidate;
    if (candidate == null) return;

    _safeSetState(() {
      voting = true;
      error = null;
      info = null;
    });
    try {
      final proof = await identity.signVote(
        candidateId: candidate['blockchain_candidate_id'] ?? candidate['id'],
        electionId: election['blockchain_election_id'] ?? election['id'],
      );
      final result = await api.request(
        '/vote/simple',
        method: 'POST',
        sessionId: widget.sessionId,
        body: {
          'electionId': election['id'],
          'candidateId': candidate['id'],
          ...proof,
        },
      );
      _safeSetState(() {
        info = result['message']?.toString() ?? 'Oyunuz havuza alındı.';
        selectedCandidate = null;
      });
      await _load(silent: true);
    } catch (e) {
      _safeSetState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      _safeSetState(() => voting = false);
    }
  }

  Future<void> _resetWallet() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Burner cüzdan sıfırlansın mı?'),
        content: const Text(
          'Mevcut cihaz cüzdanı silinir ve sonraki işlemde yeni cüzdan oluşturulur.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sıfırla'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await identity.reset();
    final address = await identity.address();
    _safeSetState(() {
      walletAddress = address;
      info = 'Cüzdan yenilendi.';
    });
  }

  void _showHistory() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (context) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          const Text(
            'Oy geçmişi',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          if (history.isEmpty)
            const Text('Henüz oy geçmişi yok.', style: TextStyle(color: muted)),
          ...history.map(
            (item) => CardPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (item['election_title'] ?? item['election_name'] ?? 'Seçim')
                        .toString(),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    (item['candidate_name'] ??
                            item['candidate'] ??
                            item['status'] ??
                            'Kaydedildi')
                        .toString(),
                  ),
                  if (item['created_at'] != null)
                    Text(
                      item['created_at'].toString(),
                      style: const TextStyle(color: muted),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openProfile() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ProfileScreen(
          user: profileUser ?? widget.user,
          sessionId: widget.sessionId,
          walletAddress: walletAddress,
          socketLive: socketLive,
          activeElectionCount: elections.length,
          voteHistoryCount: history.length,
          onShowHistory: _showHistory,
          onResetWallet: _resetWallet,
          onLogout: widget.onLogout,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const LoadingScreen();
    final selectedElection = elections
        .where((e) => e['id'] == selectedElectionId)
        .firstOrNull;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Merhaba, ${widget.user['name'] ?? 'seçmen'}',
                          style: const TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w800,
                            color: ink,
                          ),
                        ),
                        Text(
                          widget.user['role'] == 'admin'
                              ? 'Yönetici hesabı'
                              : 'Seçmen hesabı',
                          style: const TextStyle(color: muted),
                        ),
                      ],
                    ),
                  ),
                  IconButton.filledTonal(
                    onPressed: _openProfile,
                    icon: const Icon(Icons.person_outline),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    onPressed: widget.onLogout,
                    icon: const Icon(Icons.logout),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              CardPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.account_balance_wallet_outlined,
                          color: green,
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Burner wallet',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        Icon(
                          Icons.circle,
                          size: 12,
                          color: socketLive ? green : Colors.grey.shade400,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      walletAddress,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: muted),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _showHistory,
                            icon: const Icon(Icons.history),
                            label: const Text('Geçmiş'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _resetWallet,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Sıfırla'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Notice(error: error, info: info),
              Row(
                children: [
                  const Expanded(child: SectionTitle('Aktif seçimler')),
                  IconButton.filledTonal(
                    tooltip: 'Yenile',
                    onPressed: refreshing ? null : _refreshElections,
                    icon: refreshing
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                  ),
                ],
              ),
              if (elections.isEmpty)
                const EmptyBox('Şu anda oy kullanabileceğiniz aktif seçim yok.')
              else
                SizedBox(
                  height: 94,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: elections.length,
                    separatorBuilder: (_, index) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final election = elections[index];
                      final selected = election['id'] == selectedElectionId;
                      return ChoiceCard(
                        selected: selected,
                        title:
                            (election['title'] ??
                                    election['name'] ??
                                    'Seçim #${election['id']}')
                                .toString(),
                        subtitle: (election['end_date'] ?? 'Aktif').toString(),
                        onTap: () => _selectElection(election['id'] as int),
                      );
                    },
                  ),
                ),
              SectionTitle(
                'Adaylar${selectedElection == null ? '' : ' · ${selectedElection['title'] ?? selectedElection['name'] ?? ''}'}',
              ),
              if (candidates.isEmpty)
                const EmptyBox('Bu seçim için görünür aday bulunamadı.')
              else
                ...candidates.map((candidate) {
                  final selected = selectedCandidate?['id'] == candidate['id'];
                  return CandidateTile(
                    candidate: candidate,
                    selected: selected,
                    onTap: () => setState(() => selectedCandidate = candidate),
                  );
                }),
              const SizedBox(height: 8),
              AppButton(
                label: 'Oyu imzala ve gönder',
                icon: Icons.check_circle_outline,
                loading: voting,
                onPressed: selectedCandidate == null ? null : _vote,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
