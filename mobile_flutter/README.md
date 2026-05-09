# SSI Voting Flutter

Flutter ile yazılmış Android/iOS mobil istemci.

Özellikler:

- kullanıcı girişi
- OTP ile kayıt
- şifre sıfırlama
- aktif seçim ve aday listeleme
- cihazda güvenli burner wallet üretme
- EIP-712 imzalı oy gönderme
- Socket.io ile oy durum bildirimi
- oy geçmişi ve logout

## Çalıştırma

```bash
cd mobile_flutter
flutter pub get
flutter run
```

Belirli sanal cihazda çalıştırmak için:

```bash
flutter devices
flutter run -d <device-id>
```

Android emulator başlatmak için:

```bash
flutter emulators
flutter emulators --launch Pixel_9_Pro
flutter run -d Pixel_9_Pro
```

iOS Simulator için:

```bash
open -a Simulator
flutter run -d "iPhone 16e"
```

## Lokal Backend

Varsayılan ayar canlı backend'e gider:

```text
https://ssi-voting-backend.onrender.com
```

Android emulator lokal backend'e bağlanacaksa:

```bash
flutter run -d <android-device-id> --dart-define=API_URL=http://10.0.2.2:5000
```

iOS Simulator lokal backend'e bağlanacaksa:

```bash
flutter run -d "iPhone 16e" --dart-define=API_URL=http://localhost:5000
```

Fiziksel telefonda lokal backend için `localhost` yerine bilgisayarın aynı ağdaki IP adresini kullan:

```bash
flutter run --dart-define=API_URL=http://192.168.1.20:5000
```

Opsiyonel dart define değerleri:

```bash
--dart-define=SOCKET_URL=https://ssi-voting-backend.onrender.com
--dart-define=CHAIN_ID=11155111
--dart-define=CONTRACT_ADDRESS=0x62a8878de43d5d6fd9B199d92556843a57F39aae
```

## Kontrol

```bash
flutter analyze
flutter test
flutter build apk --debug
```
